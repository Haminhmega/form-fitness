import copy
import tempfile
import unittest
from pathlib import Path

import torch

from squat_ml.anomaly import (Withheld, assess, check_records, evaluate, features,
                              fixtures, restore, train)
from squat_ml.core import binary_metrics, featurize, person_splits, validate_record


class AnomalyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        torch.set_num_threads(1)
        cls.directory = tempfile.TemporaryDirectory()
        cls.path = Path(cls.directory.name)/"model.pt"
        cls.rows = fixtures()
        cls.metadata = train(cls.rows, cls.path, epochs=2, allow_synthetic=True)
        cls.model, cls.payload = restore(cls.path)

    @classmethod
    def tearDownClass(cls):
        cls.directory.cleanup()

    def test_feature_shape_and_aspect_correction(self):
        original = self.rows[0]
        scaled = copy.deepcopy(original)
        scaled["video"]["width"] *= 2
        for f in scaled["frames"]:
            for p in f["landmarks"]:
                p["x"] /= 2
        self.assertEqual(tuple(features(original).shape), (4, 64))
        torch.testing.assert_close(features(original), features(scaled))

    def test_mirror_invariance(self):
        mirror = copy.deepcopy(self.rows[0])
        for f in mirror["frames"]:
            for p in f["landmarks"]:
                p["x"] = 1-p["x"]
        torch.testing.assert_close(features(mirror), features(self.rows[0]))

    def test_duration_is_retained(self):
        slower = copy.deepcopy(self.rows[0])
        slower["video"]["duration_seconds"] *= 2
        for f in slower["frames"]:
            f["timestamp_seconds"] *= 2
        self.assertAlmostEqual(float(features(slower)[3, 0]), 2*float(features(self.rows[0])[3, 0]))

    def test_tracking_gap_does_not_become_anomaly(self):
        row = copy.deepcopy(self.rows[0]); row["frames"][4]["tracking"]["valid"] = False
        result = assess(row, self.model, self.payload)
        self.assertEqual(result["status"], "unable")
        self.assertNotIn("reconstruction_mse", result)

    def test_low_visibility_cropped_missing_and_long_gap_abstain(self):
        for mutation in ("visibility", "crop", "missing", "gap"):
            row = copy.deepcopy(self.rows[0])
            if mutation == "gap":
                del row["frames"][4:8]
            else:
                for f in row["frames"]:
                    if mutation == "missing":
                        f["landmarks"] = [p for p in f["landmarks"] if p["id"] not in (27, 28)]
                    else:
                        for p in f["landmarks"]:
                            if p["id"] in (27, 28):
                                p["visibility" if mutation == "visibility" else "x"] = .1 if mutation == "visibility" else 1.5
            with self.subTest(mutation=mutation), self.assertRaises(Withheld):
                features(row)

    def test_front_view_or_other_protocol_abstain(self):
        for key, value in (("view", "front"), ("protocol_id", "different")):
            row = copy.deepcopy(self.rows[0]); row["capture"][key] = value
            self.assertEqual(assess(row, self.model, self.payload)["status"], "unable")

    def test_positive_and_negative_threshold_branches(self):
        row = self.rows[0]
        yes = assess(row, self.model, {**self.payload, "threshold": 0.})
        no = assess(row, self.model, {**self.payload, "threshold": 1e6})
        self.assertEqual(yes["status"], "review")
        self.assertEqual(no["status"], "within_reference")
        self.assertNotIn("grade", yes)

    def test_synthetic_requires_explicit_flag_and_real_consent(self):
        with self.assertRaisesRegex(ValueError, "Synthetic fixtures"):
            check_records(self.rows, False)
        row = copy.deepcopy(self.rows[0]); row["provenance"]["synthetic"] = False
        with self.assertRaisesRegex(ValueError, "consent"):
            check_records([row], False)
        row["provenance"]["consent_state"] = "confirmed"
        with self.assertRaisesRegex(ValueError, "SHA-256"):
            check_records([row], False)

    def test_test_changes_do_not_change_training_or_threshold(self):
        rows = copy.deepcopy(self.rows)
        split = person_splits(rows, 42)
        for row in split["test"]:
            row["reference_review"]["status"] = "uncertain"
            for p in row["frames"][0]["landmarks"]:
                p["x"] += .001
        other = Path(self.directory.name)/"other.pt"
        result = train(rows, other, epochs=2, allow_synthetic=True)
        second, _ = restore(other)
        self.assertEqual(self.metadata["threshold"], result["threshold"])
        for a, b in zip(self.model.parameters(), second.parameters()):
            self.assertTrue(torch.equal(a, b))
        with self.assertRaisesRegex(ValueError, "hashes"):
            evaluate(rows, self.path, allow_synthetic=True)

    def test_evaluation_marks_synthetic_and_keeps_threshold(self):
        result = evaluate(self.rows, self.path, allow_synthetic=True)
        self.assertIn("SYNTHETIC", result["warning"])
        self.assertEqual(result["threshold"], self.metadata["threshold"])
        self.assertIn("quality_coverage_labeled", result["metrics"])

    def test_checkpoint_rejects_wrong_version(self):
        path = Path(self.directory.name)/"wrong.pt"
        torch.save({**self.payload, "version": "future"}, path)
        with self.assertRaisesRegex(ValueError, "version"):
            restore(path)

    def test_missing_labels_never_become_reference_training(self):
        rows = copy.deepcopy(self.rows)
        for row in rows:
            row["reference_review"]["status"] = "missing"
        with self.assertRaisesRegex(ValueError, "usable references"):
            train(rows, Path(self.directory.name)/"missing.pt", epochs=1, allow_synthetic=True)

    def test_metadata_nan_and_confidence_bounds(self):
        row = copy.deepcopy(self.rows[0]); row["video"]["width"] = float("nan")
        with self.assertRaises(ValueError):
            validate_record(row)
        row = copy.deepcopy(self.rows[0]); row["frames"][0]["landmarks"][0]["visibility"] = 2.
        with self.assertRaises(ValueError):
            validate_record(row)

    def test_optional_presence_and_zero_f1(self):
        row = copy.deepcopy(self.rows[0]); row["frames"][0]["landmarks"][0]["presence"] = None
        self.assertTrue(torch.isfinite(featurize(row)).all())
        self.assertEqual(binary_metrics([0, 1], [1., 0.], 0.)["f1"], 0.)


if __name__ == "__main__":
    unittest.main()
