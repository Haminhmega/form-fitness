# Form — local squat AI test

This is a working experimental video-analysis path for **user-declared, standard bodyweight squats filmed from the side**. Pose landmarks come from an actual machine-learning model. Counting, phase timing and within-set angle comparisons use deterministic rules. This is not a validated coaching system, a general exercise classifier, or a clinical assessment.

## Run the test

From this project directory:

```sh
npm ci
npm run prepare:ai
npm run test:ai
npm run dev
```

Open `http://127.0.0.1:5173/#form-test` in current Chrome or Edge. Select a playable **2–60 second video of at most 100 MiB**, confirm that it shows one person doing standard bodyweight squats from the side, and choose **Analyze squat video**. Start and finish standing with a short pause; keep the camera stationary and required joints comfortably in frame.

For the production build, run `npm run build` and `npm run preview`, then open the preview URL. Keep the bundled `public/ai` assets with the source and the copied `dist/ai` assets with the built application. `prepare:ai` restores the pinned runtime/model assets if needed; preparation may download public model/license files. Analyzing a selected clip does not upload it.

The single-file `Form.html` retains the illustrated prototype experience and explains how to open the served AI test. Real analysis does **not** run from `file://`: it needs same-origin model/WASM files, module workers, WebAssembly SIMD, OffscreenCanvas and ImageBitmap support. Chrome/Edge are the test targets; no Safari, Firefox, physical-phone, or cross-codec compatibility claim is made.

## Architecture and data boundary

1. `AIRecording.tsx` checks file type, size and readable duration, creates a temporary object URL, and obtains the user's movement/view confirmation. Processing starts only after an explicit analysis action.
2. `ai/analyzeVideo.ts` uses a private HTML video decoder to sample decoded pixels at approximately 10 clip positions per second. Frames are scaled to fit within 960×720 while preserving aspect ratio. Positions come from the media timeline; they are **not exact source-frame presentation timestamps**, and low-frame-rate videos can repeat pixels at neighboring sample positions.
3. `ai/pose.worker.ts` runs MediaPipe Pose Landmarker Lite on a dedicated worker using the CPU delegate, VIDEO mode, and up to two detected poses. The second-pose output supports abstention when multiple people are detected; it does not guarantee that every extra person is detected. The worker accepts only GET/HEAD requests to its exact, same-origin asset allowlist.
4. `ai/squat.ts` computes a 2D knee angle after multiplying normalized coordinates by the original video width/height. It gates visibility, framing and approximate side view; keeps one side through each uninterrupted segment; then detects complete upright–bend–upright cycles. Missing frames/angles are not filled. Tracking interruptions cannot be bridged to complete a rep.
5. Results contain clip positions, per-rep projected angle range, approximate phase times, actual sampled landmarks and withheld-frame reasons. The UI replays the user's clip with an optional sampled-joint overlay, per-rep markers and clearly separate assessment limitations. Coverage percentage describes usable sampled frames, **not technique quality**.
6. Cancel, clip replacement and leaving the screen abort the job. Worker/decoder/image-bitmap resources are released; stale callbacks cannot overwrite a later selection. The object URL is revoked when replaced or unmounted. Video, poses and real results are not written to localStorage, IndexedDB, workout history or a server. Ordinary browser caching may retain public model assets; no permanent media-erasure claim is made.

Wearable/provider sample imports are independent of this analysis. No vendor signal is used to identify an exercise, infer readiness or generate coaching. The existing workout logger remains manual; this test does not silently fill sets/reps or mark illustrated feedback as a measured result.

MediaPipe supplies 33 estimated body landmarks. Its synchronous inference is isolated on a worker so that it does not run on the interface thread. See the official [web implementation guide](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js) and [task/model overview](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker).

## Experimental measurement contract

The complete settings are exported as `SQUAT_LIMITS`. They are engineering heuristics for this test, not exercise prescriptions or clinically established cutoffs.

| Gate or calculation | Current rule |
| --- | --- |
| Required joints | Shoulder, hip, knee and ankle on the selected side; confidence ≥0.65 |
| View screen | At least one visible bilateral shoulder/hip pair at confidence ≥0.45; projected shoulder span/torso ≤0.65 and hip span/torso ≤0.55 where measurable |
| Framing/scale | Required joints at least 1.5% inside the frame; projected torso ≥8% of image height and each leg segment ≥6.5% |
| Pixel geometry | Hip–knee–ankle angle in image pixels; no 3D or anatomical angle claim |
| Temporal filtering | Timestamp-aware EMA with 0.10s time constant for segmentation; the overlay reports the raw measured angle |
| Upright hysteresis | ≥158° for at least 0.16s to confirm upright; departure below 154° |
| Bend confirmation | ≤125° for at least 0.12s |
| Candidate limits | 0.8–20s total; at least 0.25s in each phase; at least 35° projected range |
| Gap reset | Gap >max(0.35s, min(0.60s, 2.5 / requested sample rate)) resets tracking and the candidate cycle |
| Minimum evidence | Clip ≥2s; at least eight usable frames and 1.5 accumulated tracked seconds, with no interrupted cycle counted |
| Range observations | At least four completed reps within one uninterrupted segment; later-range observation requires the last two to average ≥10° smaller than the first two, with each ≥8° smaller |

The range is a change in projected knee angle, not squat depth. Lowering/rising durations are threshold-based estimates and can include pauses. Threshold crossing and approximately 10Hz sampling limit their precision. The system assumes the exercise selected by the user; it does not verify absence of a load, classify arbitrary movements, or reliably recover camera orientation. The view gates are heuristics: they cannot certify side view, exercise identity or equipment. A different exercise with similar visible knee motion can satisfy the same rules.

An opening/closing partial movement is not a complete rep. A clip that begins moving before the upright confirmation interval can be withheld even when a person would recognize a full squat. Invalid tracking, a changed side or a long sample gap starts a new segment. Valid cycles can remain useful as a **partial** assessment. Stationary clips or clips without a qualifying completed cycle return **unable**, not a fabricated score or zero-rep ground truth.

## Model version and license

`@mediapipe/tasks-vision` is pinned exactly to **0.10.35** in both package manifests. This keeps the JavaScript runtime and module WASM pair aligned with the version exercised here and avoids silent changes to APIs or network behavior. Upgrading requires inference, cancellation, privacy/network and browser regression checks; this document does not claim that the pin is the newest release.

The bundled model is Pose Landmarker Lite, float16, version 1. Asset provenance, byte sizes, SHA-256 digests and license text are in `public/ai/README.md`, `public/ai/manifest.json` and the adjacent license file. `prepare:ai` checks the installed runtime version and the model's pinned digest. This project trains no model and uses no cloud inference service.

## Verification and limits

`npm run test:ai` currently passes **16 deterministic groups** covering aspect-correct geometry, counting and timing, pauses, 5fps/irregular samples, partial starts/ends, an unconfirmed opening upright hold, occlusions/gaps, later recovery, fixed side choice, multiple people, frontal/cropped/unknown views, stationary/noisy/impulse clips, insufficient data, invalid timestamps, conservative same-segment comparisons and immutability. These are synthetic pose fixtures: they test the rule implementation, not the pose model's accuracy on people.

Actual browser tests separately run the downloaded model on public motion footage and locally generated negative files. The short side-view Commons fixture produces tracked joints but withholds its opening cycle because it lacks the required upright confirmation interval. This is a known conservative limit, not evidence that no squat occurred. A derivative plays two original GIF loops in sequence with unchanged native timing: standing at the loop boundary permits the second cycle to qualify. This repeats the same source motion; it is not an independently filmed two-repetition set, and its timing is not ground-truth annotation. Blank footage yields no assessed reps; malformed input returns a decoding error. Cancellation, cleanup, timeout and retry cases are tested separately. Consult the final `QA.md` for the completed browser/UI checks and their results.

Public test-media attribution, licenses, transformations and hashes are recorded under the workspace's `work/ai-fixtures/PROVENANCE.md` and fixture metadata. The Commons photographic motion GIF is by Danielflefil under CC BY-SA 4.0. The official TensorFlow smoke video originates from a Pexels clip by Anna Shvets and shows an elastic-band variation in an oblique view; it is used to check inference/decoding, **not** standard-bodyweight-squat accuracy. It produced a partial one-cycle result when passed through the user-declared squat path. This demonstrates that view/equipment restrictions are not an automatic classifier and unsuitable footage is not reliably rejected. Test media is not shipped as an app asset, training set, endorsement or user testimonial.

There is no coach-labeled benchmark, population coverage study, rep-count error bound, phase-timing ground truth, clinical validation, real-phone camera test or reliable injury/technique assessment. Lighting, clothing, occlusion, camera angle, lens distortion, framing, compression and model errors can change the output. No overall form grade, safety guarantee, diagnosis, injury prediction or prescriptive load advice is produced. Further work requires broader consented recordings, independent annotations, rejection-quality evaluation and browser/device testing before expanding supported movements.
# Offline PyTorch scaffold — October 23, 2026

`research/squat_ml` adds a separate reference-autoencoder experiment plus a supervised observation baseline. It consumes landmark JSON only. No dataset was downloaded or real video used to validate either model in this update. Python synthetic checks exercise shape/provenance validation, person-separated splits, masked labels, checkpoint round trips, quality withholding, unchanged thresholds when test data changes and candidate-attempt preparation. The local developer export is explicit and absent from the production build. See `research/squat_ml/README.md` for running it and `ANOMALY_PROTOCOL.md` for the unsuccessful short synthetic detection result and remaining validation work. Existing on-device analyzers and their thresholds are unchanged.
