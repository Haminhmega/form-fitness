from __future__ import annotations

import hashlib
import json
import math
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import torch
from torch import nn
from torch.utils.data import Dataset

from . import LANDMARK_IDS, MODEL_ARCHITECTURE_VERSION, PREPROCESSING_VERSION, SCHEMA_VERSION, TARGETS

OBSERVED = {"positive": 1.0, "negative": 0.0}


def load_jsonl(path: str | Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    with Path(path).open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            if not line.strip():
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError as error:
                raise ValueError(f"{path}:{line_number}: invalid JSON: {error}") from error
            validate_record(record, f"{path}:{line_number}")
            records.append(record)
    if not records:
        raise ValueError(f"{path}: no records")
    return records


def validate_record(record: dict[str, Any], where: str = "record") -> None:
    if not isinstance(record, dict):
        raise ValueError(f"{where}: record must be an object")
    required = ("schema_version", "participant_id", "recording_id", "video", "pose", "frames", "labels")
    missing = [key for key in required if key not in record]
    if missing:
        raise ValueError(f"{where}: missing {', '.join(missing)}")
    if record["schema_version"] != SCHEMA_VERSION:
        raise ValueError(f"{where}: unsupported schema_version {record['schema_version']!r}")
    if record.get("exercise") != "squat":
        raise ValueError(f"{where}: exercise must be squat")
    provenance = record.get("provenance", {})
    if not isinstance(provenance, dict) or not isinstance(provenance.get("synthetic"), bool) or provenance.get("consent_state") not in ("confirmed", "not_recorded", "withdrawn"):
        raise ValueError(f"{where}: provenance must record synthetic status and consent state")
    pose = record["pose"]
    if not isinstance(pose, dict) or pose.get("preprocessing_version") != PREPROCESSING_VERSION:
        raise ValueError(f"{where}: pose.preprocessing_version must be {PREPROCESSING_VERSION!r}")
    if any(not isinstance(pose.get(key), str) or not pose[key].strip() for key in ("model_name", "model_version")):
        raise ValueError(f"{where}: pose model_name/model_version must be non-empty strings")
    if pose.get("model_sha256") is not None and not isinstance(pose["model_sha256"], str):
        raise ValueError(f"{where}: pose.model_sha256 must be a string or null")
    for key in ("participant_id", "recording_id"):
        value = record[key]
        if not isinstance(value, str) or not value.strip() or len(value) > 128:
            raise ValueError(f"{where}: {key} must be a non-empty anonymous identifier <=128 chars")
        if any(char.isspace() or char in '@/\\' for char in value):
            raise ValueError(f"{where}: {key} must be a study pseudonym without contact details or paths")
    video = record["video"]
    if not isinstance(video, dict) or any(not isinstance(video.get(key), (int, float)) for key in ("duration_seconds", "width", "height", "sample_rate_hz")):
        raise ValueError(f"{where}: video metadata is incomplete")
    if any(not math.isfinite(video[k]) or isinstance(video[k], bool) or video[k] <= 0 for k in ("duration_seconds", "width", "height", "sample_rate_hz")):
        raise ValueError(f"{where}: video metadata must be positive")
    if not isinstance(record["frames"], list) or len(record["frames"]) < 2:
        raise ValueError(f"{where}: at least two frames are required")
    previous = -math.inf
    for index, frame in enumerate(record["frames"]):
        if not isinstance(frame, dict) or not isinstance(frame.get("tracking"), dict) or not isinstance(frame["tracking"].get("valid"), bool):
            raise ValueError(f"{where}: frame {index} must include tracking.valid")
        timestamp = frame.get("timestamp_seconds")
        if not isinstance(timestamp, (int, float)) or not math.isfinite(timestamp) or timestamp < 0 or timestamp <= previous:
            raise ValueError(f"{where}: frame {index} timestamps must be finite and strictly increasing")
        if timestamp > video["duration_seconds"] + 0.001:
            raise ValueError(f"{where}: frame {index} timestamp exceeds video duration")
        previous = timestamp
        landmarks = frame.get("landmarks")
        if not isinstance(landmarks, list):
            raise ValueError(f"{where}: frame {index} landmarks must be a list")
        if any(not isinstance(p, dict) or not isinstance(p.get("id"), int) for p in landmarks):
            raise ValueError(f"{where}: frame {index} landmarks must have integer IDs")
        ids = {point.get("id") for point in landmarks if isinstance(point, dict)}
        if len(ids) != len(landmarks):
            raise ValueError(f"{where}: frame {index} landmark ids must be unique")
        for point in landmarks:
            if not isinstance(point, dict) or not isinstance(point.get("id"), int) or not 0 <= point["id"] <= 32:
                raise ValueError(f"{where}: frame {index} has an invalid landmark id")
            for field in ("x", "y", "z", "visibility"):
                value = point.get(field)
                if not isinstance(value, (int, float)) or not math.isfinite(value):
                    raise ValueError(f"{where}: frame {index} landmark {point['id']} has invalid {field}")
            presence = point.get("presence")
            if presence is not None and (not isinstance(presence, (int, float)) or not math.isfinite(presence)):
                raise ValueError(f"{where}: frame {index} landmark {point['id']} has invalid presence")
            if not 0 <= point["visibility"] <= 1 or (presence is not None and not 0 <= presence <= 1):
                raise ValueError(f"{where}: confidence must be between zero and one")
    labels = record["labels"]
    if not isinstance(labels, dict):
        raise ValueError(f"{where}: labels must be an object")
    for target in TARGETS:
        label = labels.get(target)
        if not isinstance(label, dict) or label.get("value") not in {"positive", "negative", "uncertain", "missing"}:
            raise ValueError(f"{where}: labels.{target}.value is invalid")


def assert_unique_recordings(records: Iterable[dict[str, Any]]) -> None:
    seen: dict[str, str] = {}
    content_seen: dict[str, tuple[str, str]] = {}
    pose_signature: tuple[Any, ...] | None = None
    for record in records:
        recording = record["recording_id"]
        participant = record["participant_id"]
        if recording in seen:
            raise ValueError(f"recording_id {recording!r} occurs more than once (participants {seen[recording]!r} and {participant!r})")
        seen[recording] = participant
        fingerprint_source = {
            "exercise": record.get("exercise"), "video": record["video"],
            "pose": record["pose"], "frames": record["frames"],
        }
        fingerprint = hashlib.sha256(json.dumps(fingerprint_source, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
        if fingerprint in content_seen:
            prior_recording, prior_participant = content_seen[fingerprint]
            raise ValueError(
                f"duplicate recording content occurs under {prior_recording!r}/{prior_participant!r} "
                f"and {recording!r}/{participant!r}"
            )
        content_seen[fingerprint] = (recording, participant)
        current_pose = tuple(record["pose"].get(key) for key in ("model_name", "model_version", "model_sha256", "preprocessing_version"))
        if pose_signature is None:
            pose_signature = current_pose
        if current_pose != pose_signature:
            raise ValueError("mixed pose model or preprocessing provenance is not allowed in one split dataset")


def person_splits(records: list[dict[str, Any]], seed: int = 20261018) -> dict[str, list[dict[str, Any]]]:
    assert_unique_recordings(records)
    participants = sorted({record["participant_id"] for record in records})
    if len(participants) < 3:
        raise ValueError("person-separated train/validation/test splits require at least 3 participants")
    rng = random.Random(seed)
    rng.shuffle(participants)
    count = len(participants)
    test_count = max(1, round(count * 0.15))
    validation_count = max(1, round(count * 0.15))
    if test_count + validation_count >= count:
        test_count = validation_count = 1
    assignments = {}
    for index, participant in enumerate(participants):
        assignments[participant] = "test" if index < test_count else "validation" if index < test_count + validation_count else "train"
    split = {name: [] for name in ("train", "validation", "test")}
    for record in records:
        split[assignments[record["participant_id"]]].append(record)
    participant_sets = {name: {r["participant_id"] for r in rows} for name, rows in split.items()}
    if any(participant_sets[a] & participant_sets[b] for a, b in (("train", "validation"), ("train", "test"), ("validation", "test"))):
        raise AssertionError("participant leakage detected")
    return split


def split_summary(split: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    return {
        name: {
            "records": len(rows),
            "participants": len({row["participant_id"] for row in rows}),
            "recording_ids_sha256": hashlib.sha256("\n".join(sorted(row["recording_id"] for row in rows)).encode()).hexdigest(),
            "records_sha256": hashlib.sha256("\n".join(
                json.dumps(row, sort_keys=True, separators=(",", ":"))
                for row in sorted(rows, key=lambda item: item["recording_id"])
            ).encode()).hexdigest(),
        }
        for name, rows in split.items()
    }


def _point_map(frame: dict[str, Any]) -> dict[int, dict[str, Any]]:
    return {int(point["id"]): point for point in frame["landmarks"] if isinstance(point, dict) and isinstance(point.get("id"), int)}


def featurize(record: dict[str, Any], steps: int = 64) -> torch.Tensor:
    """Normalize with mid-hip origin/torso scale, then linearly resample time.

    Each selected landmark contributes x/y/z, confidence, and a present mask.
    A final channel carries the production frame-valid flag.
    """
    rows: list[list[float]] = []
    times: list[float] = []
    for frame in record["frames"]:
        points = _point_map(frame)
        hips = [points.get(23), points.get(24)]
        shoulders = [points.get(11), points.get(12)]
        anchors = [point for point in hips if point]
        shoulder_anchors = [point for point in shoulders if point]
        if not anchors or not shoulder_anchors:
            origin = (0.5, 0.5, 0.0)
            scale = 1.0
        else:
            origin = tuple(sum(float(point.get(axis, 0.0)) for point in anchors) / len(anchors) for axis in ("x", "y", "z"))
            shoulder = tuple(sum(float(point.get(axis, 0.0)) for point in shoulder_anchors) / len(shoulder_anchors) for axis in ("x", "y", "z"))
            scale = max(0.05, math.sqrt(sum((origin[i] - shoulder[i]) ** 2 for i in range(3))))
        values: list[float] = []
        for landmark_id in LANDMARK_IDS:
            point = points.get(landmark_id)
            presence = None if not point else point.get("presence")
            confidence = 0.0 if not point else min(float(point.get("visibility", 0.0)), 1.0 if presence is None else float(presence))
            present = float(point is not None and confidence >= 0.05)
            for axis_index, axis in enumerate(("x", "y", "z")):
                coordinate = origin[axis_index] if not point else float(point.get(axis, origin[axis_index]))
                values.append((coordinate - origin[axis_index]) / scale if present else 0.0)
            values.extend((confidence if present else 0.0, present))
        values.append(float(bool(frame.get("tracking", {}).get("valid", frame.get("valid", False)))))
        rows.append(values)
        times.append(float(frame["timestamp_seconds"]))
    source = torch.tensor(rows, dtype=torch.float32)
    source_times = torch.tensor(times, dtype=torch.float32)
    targets = torch.linspace(source_times[0], source_times[-1], steps)
    right = torch.searchsorted(source_times, targets).clamp(1, len(times) - 1)
    left = right - 1
    span = (source_times[right] - source_times[left]).clamp_min(1e-6)
    weight = ((targets - source_times[left]) / span).unsqueeze(1)
    return (source[left] * (1 - weight) + source[right] * weight).transpose(0, 1).contiguous()


class SquatDataset(Dataset):
    def __init__(self, records: list[dict[str, Any]], steps: int = 64):
        self.records = records
        self.steps = steps

    def __len__(self) -> int:
        return len(self.records)

    def __getitem__(self, index: int):
        record = self.records[index]
        labels, mask = [], []
        for target in TARGETS:
            value = record["labels"][target]["value"]
            labels.append(OBSERVED.get(value, 0.0))
            mask.append(float(value in OBSERVED))
        return featurize(record, self.steps), torch.tensor(labels), torch.tensor(mask), record["recording_id"]


class SquatBaseline(nn.Module):
    def __init__(self, input_channels: int = len(LANDMARK_IDS) * 5 + 1, targets: int = len(TARGETS)):
        super().__init__()
        self.network = nn.Sequential(
            nn.Conv1d(input_channels, 48, 5, padding=2), nn.ReLU(), nn.Dropout(0.15),
            nn.Conv1d(48, 64, 5, padding=2), nn.ReLU(),
            nn.AdaptiveAvgPool1d(1), nn.Flatten(), nn.Linear(64, targets),
        )

    def forward(self, features: torch.Tensor) -> torch.Tensor:
        return self.network(features)


def masked_loss(logits: torch.Tensor, labels: torch.Tensor, mask: torch.Tensor) -> torch.Tensor:
    losses = nn.functional.binary_cross_entropy_with_logits(logits, labels, reduction="none")
    if mask.sum() == 0:
        raise ValueError("batch contains no observed labels")
    return (losses * mask).sum() / mask.sum()


def binary_metrics(labels: list[int], probabilities: list[float], abstain_margin: float) -> dict[str, Any]:
    accepted = [(truth, probability >= 0.5) for truth, probability in zip(labels, probabilities) if abs(probability - 0.5) * 2 >= abstain_margin]
    total = len(labels)
    tp = sum(truth == 1 and prediction for truth, prediction in accepted)
    tn = sum(truth == 0 and not prediction for truth, prediction in accepted)
    fp = sum(truth == 0 and prediction for truth, prediction in accepted)
    fn = sum(truth == 1 and not prediction for truth, prediction in accepted)
    divide = lambda numerator, denominator: numerator / denominator if denominator else None
    precision = divide(tp, tp + fp)
    recall = divide(tp, tp + fn)
    specificity = divide(tn, tn + fp)
    f1 = divide(2 * tp, 2 * tp + fp + fn)
    return {
        "support": total, "accepted": len(accepted), "abstained": total - len(accepted),
        "coverage": divide(len(accepted), total), "accuracy": divide(tp + tn, len(accepted)),
        "precision": precision, "recall_sensitivity": recall, "specificity": specificity,
        "balanced_accuracy": None if recall is None or specificity is None else (recall + specificity) / 2,
        "f1": f1, "confusion": {"tp": tp, "tn": tn, "fp": fp, "fn": fn},
    }


def evaluate_predictions(records: list[dict[str, Any]], probabilities: torch.Tensor, abstain_margin: float = 0.25) -> dict[str, Any]:
    output: dict[str, Any] = {"abstain_margin": abstain_margin, "targets": {}, "heuristic_comparison": {}}
    for target_index, target in enumerate(TARGETS):
        truths, scores, heuristic_truths, heuristic_scores = [], [], [], []
        for row_index, record in enumerate(records):
            value = record["labels"][target]["value"]
            if value not in OBSERVED:
                continue
            truth = int(OBSERVED[value])
            truths.append(truth)
            scores.append(float(probabilities[row_index, target_index]))
            heuristic = record.get("heuristic_output", {}).get("labels", {}).get(target)
            if heuristic in ("positive", "negative"):
                heuristic_truths.append(truth)
                heuristic_scores.append(1.0 if heuristic == "positive" else 0.0)
        output["targets"][target] = binary_metrics(truths, scores, abstain_margin)
        output["heuristic_comparison"][target] = binary_metrics(heuristic_truths, heuristic_scores, 0.0)
    return output


@dataclass(frozen=True)
class Checkpoint:
    model: SquatBaseline
    metadata: dict[str, Any]


def save_checkpoint(path: str | Path, model: SquatBaseline, metadata: dict[str, Any]) -> None:
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    torch.save({"state_dict": model.state_dict(), "schema_version": SCHEMA_VERSION, "preprocessing_version": PREPROCESSING_VERSION, "model_architecture_version": MODEL_ARCHITECTURE_VERSION, "targets": TARGETS, "landmark_ids": LANDMARK_IDS, **metadata}, destination)


def load_checkpoint(path: str | Path, device: torch.device) -> Checkpoint:
    payload = torch.load(Path(path), map_location=device, weights_only=True)
    if payload.get("schema_version") != SCHEMA_VERSION or payload.get("preprocessing_version") != PREPROCESSING_VERSION:
        raise ValueError("checkpoint schema/preprocessing version does not match this code")
    if payload.get("model_architecture_version") != MODEL_ARCHITECTURE_VERSION:
        raise ValueError("checkpoint model architecture version does not match this code")
    if tuple(payload.get("targets", ())) != TARGETS or tuple(payload.get("landmark_ids", ())) != LANDMARK_IDS:
        raise ValueError("checkpoint target or landmark definition does not match this code")
    if not isinstance(payload.get("steps"), int) or payload["steps"] < 2:
        raise ValueError("checkpoint preprocessing step count is invalid")
    margin = payload.get("abstain_margin")
    if not isinstance(margin, (int, float)) or not 0 <= margin <= 1:
        raise ValueError("checkpoint abstention margin is invalid")
    model = SquatBaseline().to(device)
    model.load_state_dict(payload["state_dict"])
    return Checkpoint(model=model, metadata={key: value for key, value in payload.items() if key != "state_dict"})
