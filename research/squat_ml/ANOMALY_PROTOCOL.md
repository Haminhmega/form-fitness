# Squat reference experiment — scaffold protocol v1

Status: no real dataset, training run, test benchmark or release approval. This protocol was written for the project-first phase. Synthetic runs are implementation tests only.

## Data contract

Use consenting participants with stable study pseudonyms, a fixed side-view protocol, and reviewed single-attempt boundaries. Reference membership means inclusion in the study's chosen movement distribution. It is not a universal technique verdict. Agree on variation, camera placement, attempt boundaries and review criteria before collecting data. Document reviewer agreement and resolve uncertain cases independently of the model. Keep both ordinary variation and labeled unusual examples in evaluation; do not select only easy examples.

No raw video input or storage is implemented by Python. The developer-only browser export downloads landmarks on explicit action. The offline project makes no network calls. Landmarks, annotations, reports and checkpoints remain in ignored local folders. Consent is recorded by the study operator; the project does not collect consent or data from app users automatically. Do not use identifiers from app accounts.

## Frozen experiment

1. Validate schema, pose provenance and capture protocol. Confirm the Lite SHA-256 matches `public/ai/manifest.json`. This checks recorded provenance, not whether a manually supplied JSON came from that model.
2. Split whole people with seed 42 (approximately 70/15/15). Multiple attempts from the same person remain together. Reject duplicate IDs and exact duplicate recording content. Split/data hashes are saved in the checkpoint; changed input is rejected during evaluation.
3. Train an eight-dimensional-bottleneck autoencoder using reference examples from the training people only. Select the checkpoint by reference validation MSE. Set the threshold to the 95th percentile of reference validation residuals. Do not consult test labels, residuals or outcomes during either step.
4. Evaluate once on the frozen held-out people for a real study. The CLI does not lock out a second evaluation; the study operator must freeze code, inputs and checkpoint and record the first test report. If test findings drive changes, obtain a new untouched test cohort.
5. Report TP/TN/FP/FN, sensitivity, specificity, F1, quality withholding and participant counts. Inspect every false flag/missed example by pseudonymous recording ID. Repeated attempts are correlated: use participant-level bootstrap intervals in a later real-data evaluation, not independent-frame confidence intervals.

Quality gates and model limits are fixed in `anomaly.py`. Their numerical values are engineering starting points, not validated biomechanical thresholds. Invalid/cropped/incomplete sequences are withheld rather than scored. Reports distinguish quality coverage from classification metrics among assessable labeled attempts. Uncertain/missing reviews do not count as negatives.

## Promotion is blocked

There is no pass bar permitting this scaffold to enter the live app. Before a real study, agree on sample size, acceptable sensitivity/false alarms with uncertainty, participant subgroup and camera-condition coverage, reviewer reliability, privacy/retention and phone latency. Record those requirements before inspecting held-out results. Do not translate a high residual into a specific coaching instruction or infer direction of a technique change from it. A separate supervised observation model can later be tested for that purpose.

## Implementation evidence — October 23, 2026

Local CPU tests exercise training, checkpoint reload, subject separation, frozen test hashes, quality withholding, aspect/mirror invariance, duration retention, absent labels, explicit synthetic mode, preparation and export contracts. Synthetic two-epoch smoke runs complete. The anomaly smoke missed all four generated unusual test examples (TP 0, TN 4, FP 0, FN 4); this deliberately short smoke is **not** a useful detector or an accuracy benchmark. Its thresholds were not adjusted to improve that output. No trained checkpoint is committed or promoted. CUDA was unavailable in the installed environment; CPU verification does not establish GPU behavior.
