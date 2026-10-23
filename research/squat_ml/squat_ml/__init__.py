"""Offline research pipeline. Nothing in this package is used by the app."""

SCHEMA_VERSION = "form.squat.landmarks.v1"
PREPROCESSING_VERSION = "squat-landmarks-1.0.0"
MODEL_ARCHITECTURE_VERSION = "squat-tcn-1.0.0"
TARGETS = (
    "hip_fold_without_knee_bend",
    "torso_change",
    "range_change",
    "tempo_change",
)
LANDMARK_IDS = (11, 12, 23, 24, 25, 26, 27, 28)
