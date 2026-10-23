"""Offline reference-distribution experiment for single squat attempts."""
from __future__ import annotations

import argparse
import json
import math
import tempfile
from pathlib import Path

import torch
from torch import nn

from .cli import choose_device, synthetic_record
from .core import binary_metrics, load_jsonl, person_splits, split_summary, validate_record

VERSION = "squat-reference-autoencoder-1"
CHANNELS = ("knee_angle", "hip_angle", "torso_inclination", "attempt_duration")
STEPS = 64
POSE_SHA256 = "59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a"


class Withheld(ValueError):
    pass


def provenance(record: dict) -> tuple:
    return tuple(record["pose"].get(key) for key in ("model_name", "model_version", "model_sha256", "preprocessing_version"))


def features(record: dict) -> torch.Tensor:
    """Return [4, 64] fixed-scale channels; no dataset-fitted normalization."""
    validate_record(record)
    capture = record.get("capture", {})
    if record.get("exercise") != "squat" or capture.get("view") != "side" or capture.get("unit") != "single_attempt":
        raise Withheld("Requires a side-view squat, one upright-to-upright attempt per record.")
    if not isinstance(capture.get("protocol_id"), str) or not capture["protocol_id"].strip():
        raise Withheld("A frozen capture protocol ID is required.")
    frames = record["frames"]
    times = [frame["timestamp_seconds"] for frame in frames]
    duration = times[-1] - times[0]
    if len(frames) < 10 or not 1 <= duration <= 15:
        raise Withheld("Requires at least 10 frames and an attempt lasting 1–15 seconds.")
    if any(b - a > .25 for a, b in zip(times, times[1:])):
        raise Withheld("Tracking intervals exceed 0.25 seconds.")
    if any(frame.get("tracking", {}).get("valid") is not True for frame in frames):
        raise Withheld("Tracking is incomplete within the attempt.")
    points = [{p["id"]: p for p in frame["landmarks"]} for frame in frames]
    def confidence(point):
        if point is None:
            return 0.
        presence = point.get("presence")
        return min(point["visibility"], 1. if presence is None else presence)
    sides = ((11, 23, 25, 27), (12, 24, 26, 28))
    side = max(sides, key=lambda ids: min(confidence(row.get(i)) for row in points for i in ids))
    if min(confidence(row.get(i)) for row in points for i in side) < .6:
        raise Withheld("The same shoulder, hip, knee and ankle must remain visible throughout.")
    aspect = record["video"]["width"] / record["video"]["height"]
    def angle(a, b, c):
        u, v = (a[0]-b[0], a[1]-b[1]), (c[0]-b[0], c[1]-b[1])
        denominator = math.hypot(*u) * math.hypot(*v)
        if denominator < 1e-7:
            raise Withheld("Projected joint segments are too short.")
        return math.acos(max(-1., min(1., sum(x*y for x, y in zip(u, v)) / denominator))) / math.pi
    rows = []
    for row in points:
        selected = [row[i] for i in side]
        if any(not 0 <= p[axis] <= 1 for p in selected for axis in ("x", "y")):
            raise Withheld("Required joints extend outside the image.")
        shoulder, hip, knee, ankle = [(p["x"]*aspect, p["y"]) for p in selected]
        torso = math.atan2(abs(shoulder[0]-hip[0]), hip[1]-shoulder[1]) / math.pi
        rows.append((angle(hip, knee, ankle), angle(shoulder, hip, knee), torso, duration/15.))
    source = torch.tensor(rows, dtype=torch.float32)
    source_times = torch.tensor(times, dtype=torch.float32)
    target = torch.linspace(times[0], times[-1], STEPS)
    right = torch.searchsorted(source_times, target).clamp(1, len(times)-1)
    left = right-1
    weight = ((target-source_times[left])/(source_times[right]-source_times[left])).unsqueeze(1)
    return (source[left]*(1-weight)+source[right]*weight).T.contiguous()


class ReferenceAutoencoder(nn.Module):
    def __init__(self):
        super().__init__()
        self.network = nn.Sequential(nn.Flatten(), nn.Linear(4*STEPS, 48), nn.ReLU(),
                                     nn.Linear(48, 8), nn.ReLU(), nn.Linear(8, 48),
                                     nn.ReLU(), nn.Linear(48, 4*STEPS))

    def forward(self, x):
        return self.network(x).reshape(-1, 4, STEPS)


def check_records(records: list[dict], allow_synthetic: bool) -> None:
    flags = [r.get("provenance", {}).get("synthetic") is True for r in records]
    if any(flags) and (not all(flags) or not allow_synthetic):
        raise ValueError("Synthetic fixtures require --allow-synthetic and cannot mix with real records.")
    protocols = set()
    for r in records:
        validate_record(r)
        if not r.get("provenance", {}).get("synthetic"):
            if r.get("provenance", {}).get("consent_state") != "confirmed":
                raise ValueError("Real records require confirmed research consent.")
            if r["pose"].get("model_sha256") != POSE_SHA256:
                raise ValueError("Pose provenance must match the production Lite model SHA-256.")
        capture = r.get("capture", {})
        protocol = capture.get("protocol_id")
        if not isinstance(protocol, str) or not protocol.strip():
            raise ValueError("Every record requires a capture protocol ID.")
        protocols.add(protocol)
        review = r.get("reference_review", {})
        if review.get("status") not in ("reference", "unusual", "uncertain", "missing"):
            raise ValueError("reference_review.status is missing or invalid.")
        if review["status"] in ("reference", "unusual") and not review.get("reviewer_id"):
            raise ValueError("Reviewed records require a reviewer pseudonym.")
    if len(protocols) != 1:
        raise ValueError("Do not combine capture protocols in one model.")


def collect(rows: list[dict]):
    accepted, tensors, withheld = [], [], []
    for record in rows:
        try:
            tensors.append(features(record)); accepted.append(record)
        except Withheld as error:
            withheld.append({"recording_id": record["recording_id"], "reason": str(error)})
    return accepted, tensors, withheld


def train(records, destination: Path, *, epochs=60, seed=42, device="cpu", allow_synthetic=False):
    if epochs < 1:
        raise ValueError("epochs must be positive")
    check_records(records, allow_synthetic)
    split = person_splits(records, seed)
    train_rows = [r for r in split["train"] if r["reference_review"]["status"] == "reference"]
    val_rows = [r for r in split["validation"] if r["reference_review"]["status"] == "reference"]
    accepted, tensors, rejected = collect(train_rows)
    val_accepted, val_tensors, val_rejected = collect(val_rows)
    if len({r["participant_id"] for r in accepted}) < 2 or not val_tensors:
        raise ValueError("Need usable references from >=2 training participants and >=1 validation participant.")
    torch.manual_seed(seed)
    torch.use_deterministic_algorithms(True)
    device = choose_device(str(device))
    model = ReferenceAutoencoder().to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3)
    data = torch.stack(tensors).to(device)
    best_loss, best_state = math.inf, None
    history = []
    validation = torch.stack(val_tensors).to(device)
    for epoch in range(epochs):
        model.train()
        for indices in torch.randperm(len(data), device=device).split(32):
            batch = data[indices]
            optimizer.zero_grad(set_to_none=True)
            loss = (model(batch)-batch).square().mean()
            loss.backward(); nn.utils.clip_grad_norm_(model.parameters(), 1.); optimizer.step()
        model.eval()
        with torch.no_grad():
            val_loss = (model(validation)-validation).square().mean().item()
        history.append({"epoch": epoch+1, "validation_mse": val_loss})
        if val_loss < best_loss:
            best_loss = val_loss
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
    model.load_state_dict(best_state)
    with torch.no_grad():
        errors = (model(validation)-validation).square().mean(dim=(1, 2))
    threshold = float(torch.quantile(errors, .95))
    payload = {"version": VERSION, "state_dict": best_state, "threshold": threshold,
               "threshold_rule": "95th percentile of validation reference reconstruction MSE",
               "seed": seed, "split": split_summary(split), "pose": provenance(records[0]),
               "protocol_id": records[0]["capture"]["protocol_id"],
               "synthetic_only": all(r["provenance"]["synthetic"] for r in records),
               "history": history, "training_references": len(tensors), "calibration_references": len(val_tensors),
               "withheld_training": len(rejected), "withheld_validation": len(val_rejected)}
    destination.parent.mkdir(parents=True, exist_ok=True)
    torch.save(payload, destination)
    return {k: v for k, v in payload.items() if k != "state_dict"}


def restore(path, device="cpu"):
    payload = torch.load(path, map_location=device, weights_only=True)
    if payload.get("version") != VERSION:
        raise ValueError("Incompatible anomaly checkpoint version.")
    threshold = payload.get("threshold")
    if not isinstance(threshold, (float, int)) or not math.isfinite(threshold) or threshold < 0:
        raise ValueError("Invalid checkpoint threshold.")
    model = ReferenceAutoencoder().to(device)
    model.load_state_dict(payload["state_dict"]); model.eval()
    return model, payload


@torch.no_grad()
def assess(record, model, metadata, device="cpu"):
    output = {"recording_id": record["recording_id"], "experiment": VERSION,
              "synthetic_only": metadata["synthetic_only"]}
    if provenance(record) != tuple(metadata["pose"]) or record.get("capture", {}).get("protocol_id") != metadata["protocol_id"]:
        return {**output, "status": "unable", "reason": "Capture protocol or pose provenance differs from the model."}
    if bool(record.get("provenance", {}).get("synthetic")) != metadata["synthetic_only"]:
        return {**output, "status": "unable", "reason": "Synthetic and real inputs cannot share this checkpoint."}
    try:
        x = features(record).unsqueeze(0).to(device)
    except Withheld as error:
        return {**output, "status": "unable", "reason": str(error)}
    model.eval()
    error = (model(x)-x).square()[0].cpu()
    mse = error.mean().item()
    channel = int(error.mean(dim=1).argmax())
    moment = int(error[channel].argmax())
    start, end = record["frames"][0]["timestamp_seconds"], record["frames"][-1]["timestamp_seconds"]
    return {**output, "status": "review" if mse > metadata["threshold"] else "within_reference",
            "reconstruction_mse": mse, "reference_threshold": metadata["threshold"],
            "largest_residual_channel": CHANNELS[channel],
            "review_time_seconds": None if channel == 3 else start+(end-start)*moment/(STEPS-1),
            "interpretation": "Relative to this reference set only; residuals do not explain a movement cause."}


def evaluate(records, path, *, device="cpu", allow_synthetic=False):
    check_records(records, allow_synthetic)
    model, metadata = restore(path, device)
    split = person_splits(records, metadata["seed"])
    if split_summary(split) != metadata["split"]:
        raise ValueError("Frozen dataset/split hashes differ from the checkpoint.")
    predictions = [assess(r, model, metadata, device) for r in split["test"]]
    truths, scores, failures = [], [], []
    withheld = 0
    for record, prediction in zip(split["test"], predictions):
        label = record["reference_review"]["status"]
        if label not in ("reference", "unusual"):
            continue
        if prediction["status"] == "unable":
            withheld += 1; continue
        truth, decision = int(label == "unusual"), int(prediction["status"] == "review")
        truths.append(truth); scores.append(float(decision))
        if truth != decision:
            failures.append(record["recording_id"])
    metrics = binary_metrics(truths, scores, 0.)
    metrics["quality_withheld_labeled"] = withheld
    metrics["quality_coverage_labeled"] = len(truths)/(len(truths)+withheld) if truths or withheld else None
    return {"warning": "SYNTHETIC PIPELINE CHECK ONLY" if metadata["synthetic_only"] else "Public use has not been validated.",
            "split": "person-disjoint test", "metrics": metrics, "failure_recording_ids": failures,
            "predictions": predictions, "threshold": metadata["threshold"]}


def fixtures():
    rows = [synthetic_record(p, r) for p in range(12) for r in range(4)]
    for row in rows:
        row["capture"] = {"view": "side", "unit": "single_attempt", "protocol_id": "synthetic-v1"}
        row["reference_review"] = {"status": "reference" if row["labels"]["torso_change"]["value"] == "negative" else "unusual", "reviewer_id": "synthetic-generator"}
    return rows


def main():
    parser = argparse.ArgumentParser(description="Offline squat reference-distribution experiment")
    parser.add_argument("command", choices=("smoke", "train", "evaluate", "predict", "make-demo"))
    parser.add_argument("--data"); parser.add_argument("--checkpoint"); parser.add_argument("--output")
    parser.add_argument("--epochs", type=int, default=60); parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--device", choices=("auto", "cpu", "cuda"), default="auto")
    parser.add_argument("--allow-synthetic", action="store_true")
    args = parser.parse_args()
    try:
        device = choose_device(args.device)
        if args.command == "make-demo":
            if not args.output:
                raise ValueError("--output must be an ignored research/data/*.jsonl path")
            destination = Path(args.output); destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text("\n".join(json.dumps(r) for r in fixtures())+"\n", encoding="utf-8")
            print("Created synthetic fixtures only."); return
        if args.command == "smoke":
            with tempfile.TemporaryDirectory(prefix="form-anomaly-") as directory:
                data, checkpoint = fixtures(), Path(directory)/"smoke.pt"
                train(data, checkpoint, epochs=2, device=device, allow_synthetic=True)
                report = evaluate(data, checkpoint, device=device, allow_synthetic=True)
        else:
            if not args.data or not args.checkpoint:
                raise ValueError("--data and --checkpoint are required")
            data = load_jsonl(args.data)
            if args.command == "train":
                report = train(data, Path(args.checkpoint), epochs=args.epochs, seed=args.seed, device=device, allow_synthetic=args.allow_synthetic)
            elif args.command == "evaluate":
                report = evaluate(data, args.checkpoint, device=device, allow_synthetic=args.allow_synthetic)
            else:
                check_records(data, args.allow_synthetic)
                model, metadata = restore(args.checkpoint, device)
                report = [assess(r, model, metadata, device) for r in data]
        output = json.dumps(report, indent=2, allow_nan=False)
        if args.output:
            destination = Path(args.output); destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(output+"\n", encoding="utf-8")
        print(output)
    except (ValueError, RuntimeError, OSError) as error:
        raise SystemExit(f"error: {error}") from error


if __name__ == "__main__":
    main()
