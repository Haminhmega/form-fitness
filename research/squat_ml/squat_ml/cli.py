from __future__ import annotations

import argparse
import json
import math
import random
import tempfile
from pathlib import Path
from typing import Any

import torch
from torch.utils.data import DataLoader

from . import PREPROCESSING_VERSION, SCHEMA_VERSION, TARGETS
from .core import (SquatBaseline, SquatDataset, evaluate_predictions, load_checkpoint,
                   load_jsonl, masked_loss, person_splits, save_checkpoint, split_summary)


def choose_device(requested: str) -> torch.device:
    if requested == "auto":
        return torch.device("cuda" if torch.cuda.is_available() else "cpu")
    if requested == "cuda" and not torch.cuda.is_available():
        raise RuntimeError("CUDA was requested but torch.cuda.is_available() is false")
    return torch.device(requested)


def contains_synthetic(records: list[dict[str, Any]]) -> bool:
    return any(bool(record.get("provenance", {}).get("synthetic")) for record in records)


def observed_count(records: list[dict[str, Any]]) -> int:
    return sum(record["labels"][target]["value"] in {"positive", "negative"} for record in records for target in TARGETS)


@torch.no_grad()
def predict(model: SquatBaseline, records: list[dict[str, Any]], device: torch.device, batch_size: int = 32, steps: int = 64) -> torch.Tensor:
    model.eval()
    outputs = []
    for features, _labels, _mask, _ids in DataLoader(SquatDataset(records, steps=steps), batch_size=batch_size, shuffle=False):
        outputs.append(torch.sigmoid(model(features.to(device))).cpu())
    return torch.cat(outputs) if outputs else torch.empty((0, len(TARGETS)))


def train_records(records: list[dict[str, Any]], checkpoint: Path, epochs: int, batch_size: int, learning_rate: float, seed: int, device: torch.device, allow_synthetic: bool, abstain_margin: float = .25) -> dict[str, Any]:
    if epochs < 1 or batch_size < 1 or not math.isfinite(learning_rate) or learning_rate <= 0:
        raise ValueError("epochs, batch size and learning rate must be positive")
    synthetic_flags = [bool(record.get("provenance", {}).get("synthetic")) for record in records]
    if any(synthetic_flags) and not all(synthetic_flags):
        raise ValueError("synthetic pipeline fixtures must never be mixed with real records")
    if any(synthetic_flags) and not allow_synthetic:
        raise ValueError("synthetic records are pipeline fixtures only; pass --allow-synthetic only for a smoke run")
    if not 0 <= abstain_margin <= 1:
        raise ValueError("abstain_margin must be between 0 and 1")
    random.seed(seed); torch.manual_seed(seed)
    torch.use_deterministic_algorithms(True)
    if device.type == "cuda":
        torch.cuda.manual_seed_all(seed)
    split = person_splits(records, seed)
    if observed_count(split["train"]) == 0:
        raise ValueError("training split contains no observed positive/negative labels")
    if observed_count(split["validation"]) == 0:
        raise ValueError("validation split contains no observed labels; do not substitute training loss")
    model = SquatBaseline().to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=learning_rate, weight_decay=1e-3)
    train_loader = DataLoader(SquatDataset(split["train"]), batch_size=batch_size, shuffle=True)
    validation_loader = DataLoader(SquatDataset(split["validation"]), batch_size=batch_size, shuffle=False)
    best_state, best_loss, history = None, math.inf, []
    for epoch in range(1, epochs + 1):
        model.train(); total_loss = total_weight = 0.0
        for features, labels, mask, _ids in train_loader:
            if not mask.sum():
                continue
            features, labels, mask = features.to(device), labels.to(device), mask.to(device)
            optimizer.zero_grad(set_to_none=True)
            loss = masked_loss(model(features), labels, mask)
            loss.backward(); optimizer.step()
            total_loss += float(loss.detach()) * float(mask.sum()); total_weight += float(mask.sum())
        model.eval(); validation_loss = validation_weight = 0.0
        with torch.no_grad():
            for features, labels, mask, _ids in validation_loader:
                if not mask.sum():
                    continue
                features, labels, mask = features.to(device), labels.to(device), mask.to(device)
                loss = masked_loss(model(features), labels, mask)
                validation_loss += float(loss) * float(mask.sum()); validation_weight += float(mask.sum())
        mean_train = total_loss / max(1.0, total_weight)
        mean_validation = validation_loss / validation_weight
        history.append({"epoch": epoch, "train_loss": mean_train, "validation_loss": mean_validation})
        if mean_validation < best_loss:
            best_loss = mean_validation
            best_state = {key: value.detach().cpu().clone() for key, value in model.state_dict().items()}
    assert best_state is not None
    model.load_state_dict(best_state)
    summary = split_summary(split)
    save_checkpoint(checkpoint, model, {"seed": seed, "steps": 64, "abstain_margin": abstain_margin, "split_summary": summary, "contains_synthetic": contains_synthetic(records), "synthetic_only": all(bool(record.get("provenance", {}).get("synthetic")) for record in records), "history": history})
    return {"checkpoint": str(checkpoint), "device": str(device), "best_validation_loss": best_loss, "split": summary, "history": history}


def synthetic_record(participant: int, recording: int, frames: int = 36) -> dict[str, Any]:
    positive = (participant + recording) % 2 == 0
    points = []
    for frame in range(frames):
        phase = math.sin(math.pi * frame / (frames - 1))
        landmarks = []
        for landmark_id in (11, 12, 23, 24, 25, 26, 27, 28):
            right = landmark_id % 2 == 0
            base_y = {11: .28, 12: .28, 23: .5, 24: .5, 25: .68, 26: .68, 27: .86, 28: .86}[landmark_id]
            x = .5 + (.018 if right else -.018) + participant * .0002 + recording * .00002
            if landmark_id in (11, 12, 23, 24):
                x += (0.12 if positive else 0.03) * phase
            if landmark_id in (25, 26):
                y = base_y - (0.02 if positive else 0.12) * phase
            else:
                y = base_y
            landmarks.append({"id": landmark_id, "x": x, "y": y, "z": 0.0, "visibility": .99, "presence": .99})
        points.append({"timestamp_seconds": frame / 10, "tracking": {"valid": True, "reason": None}, "landmarks": landmarks, "world_landmarks": []})
    label = "positive" if positive else "negative"
    labels = {target: {"value": label, "annotator_id": "synthetic-generator", "annotated_at": None, "notes": "Pipeline fixture; not a human observation."} for target in TARGETS}
    return {
        "schema_version": SCHEMA_VERSION, "participant_id": f"synthetic-person-{participant:02d}", "recording_id": f"synthetic-{participant:02d}-{recording:02d}",
        "recorded_at": None, "exercise": "squat", "provenance": {"synthetic": True, "purpose": "pipeline_validation_only", "consent_state": "not_recorded"},
        "video": {"duration_seconds": (frames - 1) / 10, "width": 720, "height": 1280, "sample_rate_hz": 10},
        "pose": {"model_name": "synthetic", "model_version": "none", "model_sha256": None, "preprocessing_version": PREPROCESSING_VERSION},
        "tracking_quality": {"valid_fraction": 1.0, "valid_frames": frames, "total_frames": frames, "withheld_reasons": {}},
        "frames": points, "attempts": [], "labels": labels,
        "heuristic_output": {"version": "not_run", "status": "synthetic", "observation_ids": [], "labels": {target: "abstain" for target in TARGETS}},
    }


def write_synthetic(path: Path, participants: int = 12, recordings: int = 2) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for participant in range(participants):
            for recording in range(recordings):
                handle.write(json.dumps(synthetic_record(participant, recording), separators=(",", ":")) + "\n")


def command_validate(args: argparse.Namespace) -> None:
    records = load_jsonl(args.data)
    split = person_splits(records, args.seed)
    print(json.dumps({"records": len(records), "synthetic": contains_synthetic(records), "observed_labels": observed_count(records), "split": split_summary(split)}, indent=2))


def command_train(args: argparse.Namespace) -> None:
    records = load_jsonl(args.data)
    report = train_records(records, Path(args.checkpoint), args.epochs, args.batch_size, args.learning_rate, args.seed, choose_device(args.device), args.allow_synthetic, args.abstain_margin)
    print(json.dumps(report, indent=2))


def command_evaluate(args: argparse.Namespace) -> None:
    records = load_jsonl(args.data)
    if contains_synthetic(records) and not args.allow_synthetic:
        raise ValueError("synthetic evaluation is not evidence of accuracy; pass --allow-synthetic only for pipeline validation")
    device = choose_device(args.device)
    checkpoint = load_checkpoint(args.checkpoint, device)
    if checkpoint.metadata.get("contains_synthetic") and not args.allow_synthetic:
        raise ValueError("this checkpoint used synthetic pipeline fixtures and cannot be evaluated as real evidence without --allow-synthetic")
    seed = int(checkpoint.metadata["seed"])
    split = person_splits(records, seed)
    summary = split_summary(split)
    if summary != checkpoint.metadata.get("split_summary"):
        raise ValueError("data/split hashes do not match the checkpoint; evaluate with the same frozen dataset used for training")
    test_records = split["test"]
    steps = int(checkpoint.metadata["steps"])
    margin = float(checkpoint.metadata["abstain_margin"])
    probabilities = predict(checkpoint.model, test_records, device, args.batch_size, steps)
    report = {
        "warning": "SYNTHETIC PIPELINE VALIDATION ONLY" if contains_synthetic(records) else None,
        "schema_version": SCHEMA_VERSION, "preprocessing_version": PREPROCESSING_VERSION,
        "checkpoint": checkpoint.metadata, "records": len(test_records), "split": "test",
        "metrics": evaluate_predictions(test_records, probabilities, margin),
    }
    output = json.dumps(report, indent=2)
    if args.output:
        Path(args.output).parent.mkdir(parents=True, exist_ok=True); Path(args.output).write_text(output + "\n", encoding="utf-8")
    print(output)


def command_smoke(args: argparse.Namespace) -> None:
    with tempfile.TemporaryDirectory(prefix="form-squat-smoke-") as directory:
        root = Path(directory); data = root / "synthetic.jsonl"; checkpoint = root / "model.pt"
        write_synthetic(data)
        records = load_jsonl(data); device = choose_device(args.device)
        train_report = train_records(records, checkpoint, 2, 8, 1e-3, 20261018, device, True)
        loaded = load_checkpoint(checkpoint, device)
        test_records = person_splits(records, 20261018)["test"]
        steps = int(loaded.metadata["steps"]); margin = float(loaded.metadata["abstain_margin"])
        metrics = evaluate_predictions(test_records, predict(loaded.model, test_records, device, steps=steps), margin)
        print(json.dumps({"warning": "SYNTHETIC PIPELINE VALIDATION ONLY - NOT AN ACCURACY RESULT", "device": str(device), "cuda_name": torch.cuda.get_device_name(0) if device.type == "cuda" else None, "train": train_report, "metrics": metrics}, indent=2))


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description="Experimental Form squat landmark ML pipeline")
    sub = root.add_subparsers(dest="command", required=True)
    validate = sub.add_parser("validate"); validate.add_argument("--data", required=True); validate.add_argument("--seed", type=int, default=20261018); validate.set_defaults(func=command_validate)
    train = sub.add_parser("train"); train.add_argument("--data", required=True); train.add_argument("--checkpoint", required=True); train.add_argument("--epochs", type=int, default=60); train.add_argument("--batch-size", type=int, default=16); train.add_argument("--learning-rate", type=float, default=1e-3); train.add_argument("--seed", type=int, default=20261018); train.add_argument("--abstain-margin", type=float, default=.25, help="freeze before test evaluation; stored in checkpoint"); train.add_argument("--device", choices=("auto", "cpu", "cuda"), default="auto"); train.add_argument("--allow-synthetic", action="store_true"); train.set_defaults(func=command_train)
    evaluate = sub.add_parser("evaluate"); evaluate.add_argument("--data", required=True); evaluate.add_argument("--checkpoint", required=True); evaluate.add_argument("--output"); evaluate.add_argument("--batch-size", type=int, default=32); evaluate.add_argument("--device", choices=("auto", "cpu", "cuda"), default="auto"); evaluate.add_argument("--allow-synthetic", action="store_true"); evaluate.set_defaults(func=command_evaluate)
    smoke = sub.add_parser("smoke"); smoke.add_argument("--device", choices=("auto", "cpu", "cuda"), default="auto"); smoke.set_defaults(func=command_smoke)
    return root


def main() -> None:
    args = parser().parse_args()
    try:
        args.func(args)
    except (ValueError, RuntimeError) as error:
        raise SystemExit(f"error: {error}") from error


if __name__ == "__main__":
    main()
