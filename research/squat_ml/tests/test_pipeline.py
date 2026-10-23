import tempfile
import unittest
from pathlib import Path

import torch

from squat_ml import TARGETS
from squat_ml.cli import synthetic_record, train_records
from squat_ml.core import (SquatBaseline, SquatDataset, evaluate_predictions, featurize,
                           load_checkpoint, person_splits, save_checkpoint,
                           split_summary, validate_record)


class PipelineTests(unittest.TestCase):
    def test_schema_and_features(self):
        record = synthetic_record(0, 0)
        validate_record(record)
        features = featurize(record)
        self.assertEqual(features.shape, (41, 64))
        self.assertTrue(torch.isfinite(features).all())

    def test_preprocessing_version_mismatch_is_rejected(self):
        record = synthetic_record(0, 0)
        record["pose"]["preprocessing_version"] = "different"
        with self.assertRaisesRegex(ValueError, "preprocessing_version"):
            validate_record(record)

    def test_person_splits_do_not_leak(self):
        records = [synthetic_record(person, recording) for person in range(9) for recording in range(2)]
        split = person_splits(records)
        people = [{row["participant_id"] for row in split[name]} for name in ("train", "validation", "test")]
        self.assertFalse(people[0] & people[1]); self.assertFalse(people[0] & people[2]); self.assertFalse(people[1] & people[2])

    def test_mixed_pose_provenance_is_rejected(self):
        records = [synthetic_record(person, 0) for person in range(3)]
        records[1]["pose"]["model_version"] = "different"
        with self.assertRaisesRegex(ValueError, "mixed pose"):
            person_splits(records)

    def test_synthetic_records_cannot_mix_with_real_records(self):
        records = [synthetic_record(person, 0) for person in range(3)]
        records[0]["provenance"]["synthetic"] = False
        with tempfile.TemporaryDirectory() as directory, self.assertRaisesRegex(ValueError, "never be mixed"):
            train_records(records, Path(directory) / "model.pt", 1, 2, 1e-3, 1, torch.device("cpu"), True)

    def test_split_hash_covers_labels_and_landmarks(self):
        records = [synthetic_record(person, 0) for person in range(6)]
        split = person_splits(records)
        before = split_summary(split)
        records[0]["labels"][TARGETS[0]]["value"] = "uncertain"
        after_label = split_summary(split)
        self.assertNotEqual(before, after_label)
        records[0]["frames"][0]["landmarks"][0]["x"] += .001
        self.assertNotEqual(after_label, split_summary(split))

    def test_duplicate_recording_rejected(self):
        record = synthetic_record(0, 0)
        with self.assertRaisesRegex(ValueError, "occurs more than once"):
            person_splits([record, dict(record), synthetic_record(1, 0)])

    def test_duplicate_content_under_new_ids_is_rejected(self):
        original = synthetic_record(0, 0)
        duplicate = {**original, "participant_id": "different-person", "recording_id": "different-recording"}
        with self.assertRaisesRegex(ValueError, "duplicate recording content"):
            person_splits([original, duplicate, synthetic_record(2, 0)])

    def test_checkpoint_round_trip(self):
        model = SquatBaseline()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "model.pt"
            save_checkpoint(path, model, {"steps": 64, "abstain_margin": .25, "contains_synthetic": True, "synthetic_only": True})
            loaded = load_checkpoint(path, torch.device("cpu"))
            for before, after in zip(model.parameters(), loaded.model.parameters()):
                self.assertTrue(torch.equal(before, after))

    def test_checkpoint_architecture_mismatch_is_rejected(self):
        model = SquatBaseline()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "model.pt"
            save_checkpoint(path, model, {"steps": 64, "abstain_margin": .25})
            payload = torch.load(path, weights_only=True)
            payload["model_architecture_version"] = "different"
            torch.save(payload, path)
            with self.assertRaisesRegex(ValueError, "architecture"):
                load_checkpoint(path, torch.device("cpu"))

    def test_uncertain_and_missing_are_excluded(self):
        record = synthetic_record(0, 0)
        record["labels"][TARGETS[0]]["value"] = "uncertain"
        record["labels"][TARGETS[1]]["value"] = "missing"
        probabilities = torch.full((1, len(TARGETS)), .9)
        report = evaluate_predictions([record], probabilities)
        self.assertEqual(report["targets"][TARGETS[0]]["support"], 0)
        self.assertEqual(report["targets"][TARGETS[1]]["support"], 0)
        _features, _labels, mask, _recording = SquatDataset([record])[0]
        self.assertEqual(mask[0].item(), 0)
        self.assertEqual(mask[1].item(), 0)

    def test_abstention_is_reported(self):
        records = [synthetic_record(0, 0), synthetic_record(0, 1)]
        probabilities = torch.full((2, len(TARGETS)), .5)
        report = evaluate_predictions(records, probabilities, abstain_margin=.25)
        for target in TARGETS:
            self.assertEqual(report["targets"][target]["coverage"], 0)
            self.assertEqual(report["targets"][target]["abstained"], 2)


if __name__ == "__main__":
    unittest.main()
