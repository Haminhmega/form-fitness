"""Convert a local landmark export into candidate attempt records for review."""
import argparse
import copy
import json
import math
from pathlib import Path

from .core import validate_record
from . import TARGETS


def prepare(record, protocol_id):
    validate_record(record)
    if not protocol_id.strip():
        raise ValueError("A capture protocol ID is required.")
    output = []
    for index, attempt in enumerate(record.get("attempts", []), 1):
        start, end = attempt.get("start_seconds"), attempt.get("end_seconds")
        if not all(isinstance(t, (int, float)) and math.isfinite(t) for t in (start, end)) or start >= end:
            raise ValueError("Attempt boundaries must be finite and increasing.")
        frames = [f for f in record["frames"] if start <= f["timestamp_seconds"] <= end]
        if len(frames) < 2:
            raise ValueError("An attempt has fewer than two sampled frames; review boundaries.")
        row = copy.deepcopy(record)
        row["recording_id"] = f"{record['recording_id']}:attempt-{index}"
        row["frames"] = copy.deepcopy(frames)
        offset = frames[0]["timestamp_seconds"]
        for frame in row["frames"]:
            frame["timestamp_seconds"] -= offset
        row["video"]["duration_seconds"] = row["frames"][-1]["timestamp_seconds"]
        row["attempts"] = []
        row["capture"] = {"view": "unconfirmed", "unit": "single_attempt", "protocol_id": protocol_id}
        row["reference_review"] = {"status": "missing", "reviewer_id": None}
        row["labels"] = {target: {"value": "missing", "annotator_id": None, "annotated_at": None, "notes": None} for target in TARGETS}
        row["heuristic_output"] = {"version": "not_run_for_attempt", "status": "unavailable", "observation_ids": [], "labels": {t: "abstain" for t in TARGETS}}
        valid = sum(f.get("tracking", {}).get("valid") is True for f in row["frames"])
        row["tracking_quality"] = {"valid_fraction": valid/len(frames), "valid_frames": valid, "total_frames": len(frames), "withheld_reasons": {}}
        validate_record(row); output.append(row)
    if not output:
        raise ValueError("No attempt boundaries found. Mark start/end timestamps before preparing records.")
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True); parser.add_argument("--output", required=True)
    parser.add_argument("--protocol", required=True)
    args = parser.parse_args()
    try:
        rows = prepare(json.loads(Path(args.input).read_text(encoding="utf-8")), args.protocol)
        path = Path(args.output); path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("x", encoding="utf-8") as stream:
            for row in rows:
                stream.write(json.dumps(row, allow_nan=False)+"\n")
        print(f"Prepared {len(rows)} candidates. Review boundaries, confirm side view and consent, then annotate; no labels were inferred.")
    except (ValueError, OSError) as error:
        raise SystemExit(f"error: {error}") from error


if __name__ == "__main__":
    main()
