import copy
import unittest
from squat_ml.anomaly import fixtures
from squat_ml.prepare import prepare


class PrepareTests(unittest.TestCase):
    def test_preserves_person_but_never_copies_whole_clip_labels(self):
        record = fixtures()[0]
        original = copy.deepcopy(record)
        record["attempts"] = [{"start_seconds": .2, "end_seconds": 2.5}]
        result = prepare(record, "pilot-1")[0]
        self.assertEqual(result["participant_id"], record["participant_id"])
        self.assertEqual(result["frames"][0]["timestamp_seconds"], 0)
        self.assertEqual(result["reference_review"]["status"], "missing")
        self.assertEqual(result["capture"]["view"], "unconfirmed")
        self.assertTrue(all(v["value"] == "missing" for v in result["labels"].values()))
        self.assertEqual(record["frames"], original["frames"])
        self.assertEqual(result["provenance"]["consent_state"], "not_recorded")

    def test_no_or_invalid_boundaries_rejected(self):
        record = fixtures()[0]
        with self.assertRaisesRegex(ValueError, "boundaries"):
            prepare(record, "pilot-1")
        record["attempts"] = [{"start_seconds": 2, "end_seconds": 1}]
        with self.assertRaisesRegex(ValueError, "boundaries"):
            prepare(record, "pilot-1")
