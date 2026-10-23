# Experimental squat landmark ML

This directory is an **offline research workflow**. It is not imported by the web app, and a checkpoint produced here is not enabled for coaching. The production app continues to use the deterministic rules in `src/ai/`.

## Start here: anomaly project, no dataset required yet

The reference autoencoder (`squat_ml/anomaly.py`) is the starting experiment. It learns to reconstruct reviewed side-view squat attempts, then flags reconstruction differences relative to that reference set. This is separate from the older supervised observation baseline below. Neither is a trained product model.

Project location: `D:\projects\projects\form-fitness\research\squat_ml`. Open this folder in your editor; run the following from the repository root. The existing `.venv` is installed. CPU works on this laptop; CUDA was unavailable during verification.

```powershell
.\.venv\Scripts\python -m squat_ml.anomaly smoke --device cpu
```

This trains for two epochs on generated landmarks, saves/reopens a temporary checkpoint and exercises evaluation. The temporary model is deleted afterward. It tests plumbing, not detection quality. To inspect the format and run separate commands:

```powershell
.\.venv\Scripts\python -m squat_ml.anomaly make-demo --output research/data/demo.jsonl
.\.venv\Scripts\python -m squat_ml.anomaly train --data research/data/demo.jsonl --checkpoint research/checkpoints/demo.pt --epochs 2 --allow-synthetic --device cpu
.\.venv\Scripts\python -m squat_ml.anomaly evaluate --data research/data/demo.jsonl --checkpoint research/checkpoints/demo.pt --output research/runs/demo-test.json --allow-synthetic --device cpu
.\.venv\Scripts\python -m squat_ml.anomaly predict --data research/data/demo.jsonl --checkpoint research/checkpoints/demo.pt --output research/runs/demo-predictions.json --allow-synthetic --device cpu
```

`predict` above is a plumbing demonstration on the demo input, not held-out evaluation. Use `evaluate` for test-participant metrics. Outputs are JSON; there is no separate graphical training app yet.

### What the anomaly model measures

- Four channels: projected knee angle, hip angle, torso inclination and attempt duration; image aspect ratio is corrected before angle computation. Image-depth values are not used as 3D evidence.
- One manually reviewed upright-to-upright attempt per record, 64 resampled steps, an eight-value bottleneck and reconstruction loss. No fitted preprocessing statistics use test data.
- Conservative gates: side view and consistent capture protocol; 1–15 seconds; at least 10 frames; no invalid frame or interval over 0.25 seconds; the same visible shoulder/hip/knee/ankle chain throughout. Cropping or low confidence produces `unable`, never a motion flag.
- Stable person-disjoint splits; only reviewed `reference` examples in training and calibration. The threshold is the 95th percentile of validation-reference residuals and is frozen in the checkpoint. This does **not** guarantee a 5% false-alarm rate in new people.
- `review`, `within_reference` or `unable`, plus a residual and optional timestamp for inspection. Residuals are not probabilities, grades or explanations. The largest residual channel does not justify a coaching cue.

Only squat side views are supported. Another movement requires its own capture protocol, measurements, reference data and evaluation. Full-session consistency/tempo-change observations belong to the separate supervised baseline, not this single-attempt anomaly model.

### When you have recordings

Use the local developer export described below. No video is uploaded, stored by this project or committed. Prepare candidate attempts from its landmark JSON:

```powershell
.\.venv\Scripts\python -m squat_ml.prepare --input research/data/clip.json --output research/data/attempts.jsonl --protocol squat-side-pilot-v1
```

This preserves the participant ID and leaves view and labels unconfirmed. It refuses to overwrite an existing output. Manually review the exported start/end timestamps; automatic boundaries are only candidates. A reviewer must confirm `capture.view: "side"`, document research consent (`provenance.consent_state: "confirmed"`), and fill `reference_review.status` with `reference`, `unusual`, `uncertain` or `missing`, plus their pseudonymous `reviewer_id`. Define the reference population and annotation rules before assigning labels; do not copy the app's heuristic findings. Leave the older `labels` fields `missing` if not independently annotated.

Combine reviewed JSONL records in an ignored `research/data/` file. Real-data commands are the same as above **without** `--allow-synthetic`. Checkpoints and predictions remain local. At least two training participants and one validation participant with usable references are required for the code to run; that is a software minimum, not an adequate study size. See [ANOMALY_PROTOCOL.md](ANOMALY_PROTOCOL.md) before collecting a dataset.

## What is implemented

- a browser-side JSON export of the normalized MediaPipe landmarks already produced by Form (no video bytes);
- a versioned JSONL schema and strict validation;
- participant-disjoint train/validation/test splits with duplicate-recording and leakage checks;
- a small PyTorch temporal convolutional baseline;
- masked multi-label learning: `uncertain` and `missing` labels never become negatives;
- checkpoint version checks and save/load support;
- per-observation precision, sensitivity, specificity, balanced accuracy, F1, confusion counts, and confidence-based abstention coverage;
- a separate comparison with the existing heuristic output when that output is available;
- an explicitly synthetic smoke test that proves only that the pipeline runs.

It does **not** establish real-video accuracy. No dataset was selected, downloaded or searched for in this project-first update.

## Environment

From the repository root on Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install --upgrade pip
.\.venv\Scripts\python -m pip install -r research\squat_ml\requirements-cpu.txt
.\.venv\Scripts\python -m pip install --no-deps -e research\squat_ml
```

CPU is the default installation. `requirements.txt` is an optional pinned CUDA 13.0 build from the official PyTorch index for compatible hardware. `--device auto` falls back to CPU if CUDA is unavailable. No driver or system toolkit changes are needed for the verified CPU workflow.

Verify the installation:

```powershell
.\.venv\Scripts\python -c "import torch; print(torch.__version__); print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU')"
.\.venv\Scripts\python -m unittest discover -s research\squat_ml\tests -v
.\.venv\Scripts\form-squat-ml smoke --device auto
```

The smoke command labels its results `SYNTHETIC PIPELINE VALIDATION ONLY`. Those results must not be quoted as accuracy, used for thresholds, or used to enable the model.
Synthetic thresholds exist only inside the pipeline fixture; they must not be reused for real recordings. Seeds and deterministic operations are set, but identical results across different devices or PyTorch releases are not guaranteed; see [PyTorch reproducibility](https://docs.pytorch.org/docs/2.14/notes/randomness.html). Checkpoints use state dictionaries and `weights_only=True`, following [PyTorch's save/restore guidance](https://docs.pytorch.org/tutorials/beginner/basics/saveloadrun_tutorial.html).
Synthetic fixtures are rejected unless explicitly enabled for a smoke run, and they cannot be mixed with real records.

## Collect landmark records

1. Run `npm run dev -- --port 5192` and open `http://127.0.0.1:5192/?research=1#form-test`.
2. Analyze a squat clip as usual. Video stays local.
3. In a development build, choose **Export research landmarks** and enter a stable anonymous participant ID. Do not enter a name, email, account ID, or other direct identifier.
4. Move each downloaded JSON file into a private, access-controlled annotation area. Do not commit it. The repository ignores `datasets/` and `research/data/`.
5. After annotation, write one complete record per line to `datasets/squat/records.jsonl`.

The export includes production frame timestamps, 33 normalized image landmarks, optional world landmarks, frame validity/reasons, detected repetition timestamps, tracking coverage, and pose/preprocessing versions. It does not include video, the original filename, account data, or a purported ground-truth label.

### Labels

Every target has one of four states:

- `positive`: the observation is visibly present under the annotation guide;
- `negative`: the observation is visibly absent and the view supports judging it;
- `uncertain`: the view is relevant but an annotator cannot decide;
- `missing`: the view/attempt does not support this observation or it has not been annotated.

Targets are visible observations, not diagnoses or safety grades:

| Target | Annotation unit and minimum evidence |
| --- | --- |
| `hip_fold_without_knee_bend` | Recording/attempt: an upright-to-upright excursion visibly folds at the hips while knee flexion remains limited. Requires a continuous side view of shoulder, hip, knee and ankle. |
| `torso_change` | Recording/set: repeated or sustained change in projected shoulder-to-hip orientation relative to the recording's own upright reference. This is not spinal curvature. |
| `range_change` | Recording/set: later complete, comparable attempts visibly use a different projected knee excursion than opening attempts. Requires at least three uninterrupted same-side attempts. |
| `tempo_change` | Recording/set: later complete, comparable attempts visibly take a different total time than opening attempts. Deliberate pauses should be annotated in notes. |

Before real collection, freeze a fuller annotation guide with examples, have qualified reviewers label independently, retain reviewer IDs that are anonymous within the study, adjudicate disagreements without overwriting originals, and report agreement. For pilot planning, 30+ consenting people is a practical starting estimate, with representation across devices, body proportions, clothing, lighting, skin tones, mobility patterns, camera distances, and both sides. This is not an evidence-backed universal minimum. The required sample depends on target prevalence, desired uncertainty and subgroup analyses. A release decision needs substantially more independent participants and enough positive/negative examples per target in the untouched test set.

Never copy `heuristic_output.labels` into `labels`. That would train on the current rules and then incorrectly score those same rules as independent truth.

## Validate, train, and evaluate

```powershell
.\.venv\Scripts\form-squat-ml validate --data datasets\squat\records.jsonl
.\.venv\Scripts\form-squat-ml train --data datasets\squat\records.jsonl --checkpoint research\checkpoints\squat-baseline.pt --epochs 60 --abstain-margin 0.25 --device auto
.\.venv\Scripts\form-squat-ml evaluate --data datasets\squat\records.jsonl --checkpoint research\checkpoints\squat-baseline.pt --output research\runs\squat-evaluation.json --device auto
```

`train` deterministically assigns whole anonymous participants to train/validation/test. Exact duplicate recording content is rejected even when IDs differ. Geometric normalization is computed within each recording; there are no dataset-wide means, variances or other fitted preprocessing statistics that could leak test data. `evaluate` regenerates the split, verifies its recording hashes against the checkpoint, uses the same checkpointed resampling length, and reports only the untouched test participants. The checkpoint stores only hashes of split recording IDs, not the IDs themselves. The abstention margin is chosen before test review and stored in the checkpoint; evaluation cannot replace it. For a formal evaluation, freeze and archive the split manifest separately in the private study area before tuning. Do not tune architecture, preprocessing, labels, or the abstention threshold after reviewing test metrics.

The default abstention margin of `0.25` accepts probabilities at or below 0.375 and at or above 0.625. The report always includes coverage, so accuracy cannot hide withheld cases. Metrics are `null` when the needed class or denominator is absent.

## Schema and privacy

The normative shape is in `schema/squat-record.schema.json`. Important fields are:

- `participant_id`: a stable study pseudonym used only to prevent person leakage;
- `recording_id`: unique per recording;
- `recorded_at`: optional ISO timestamp, which may be removed if unnecessary;
- `attempts`: production rep timestamps and sides, not expert labels;
- `labels`: human observations with uncertainty/missingness retained;
- `heuristic_output`: current deterministic output, kept separate for comparison;
- `tracking_quality`: coverage and withholding reasons;
- `pose` and `schema_version`: model and preprocessing provenance.

Landmarks can still be biometric/sensitive motion data. Obtain consent, minimize metadata, define retention/deletion rules, restrict access, and do not treat pseudonyms as anonymous against a motivated attacker.

## Promotion gate

Do not import a checkpoint into the PWA or change coaching behavior until all of the following are reviewed: label definitions and agreement, participant-disjoint held-out results, subgroup and capture-condition slices, abstention behavior, comparison against deterministic rules, failure examples, model size/latency on target phones, privacy/consent handling, and rollback/versioning. Promotion is a separate product decision.
