# 100-exercise beta motion-check expansion

## Scope

The explicit shortlist now contains 100 distinct catalog IDs across 31 movement/setup families, up from 60 IDs across 18 families. This is an editorial selection of common gym exercises, not measured app usage. Exact generated IDs and family assignments are in `src/ai/priority-profiles.ts`; selection and regeneration are in `scripts/generate-priority-ai.mjs`.

Thirty-four added IDs did not previously have any registered analyzer. Six added IDs previously used a generic joint-cycle profile and now use the more specific setup rules. The full registry contains 170 unique entries after overlap, all marked beta. These are shared rule families, not 170 independently trained exercise-recognition models.

## Added coverage

| Exercise group | New shortlist entries | Measurement and setup |
| --- | --- | --- |
| Pull-ups | Pullups, neutral-grip pull-up, chin-up, assisted chin-up | Elbow cycles; upright torso and wrists above shoulders; begins in an extended-arm hang |
| Dips | Chest dip, triceps dip | Elbow cycles; upright torso and hands below shoulders; begins at the top |
| Seated chest press | Leverage incline chest press, leverage chest press, machine chest press | Elbow cycles; seated upright torso and hands around chest height; begins with elbows bent |
| Hip thrust | Barbell hip thrust, dumbbell single-leg hip thrust | Hip cycles; bench-side setup and lowered-hip starting phase |
| Step-up | Barbell step-up, dumbbell step-up | Working-knee cycles; begins with that foot on the step, counts one side at a time |
| Supported squat and leg press | Hack squat, single-leg press, leg press | Knee cycles; permits inclined machine posture; requires visible hip/knee/ankle |
| Leg curls | Seated leg curl, standing leg curl | Knee cycles; distinguishes horizontal supported thigh from standing thigh setup |
| Standing calf raises | Standing barbell calf raise, standing dumbbell calf raise, single-leg standing dumbbell calf raise, standing calf raises | Ankle cycles; nearly straight knee; visible ankle, heel and toes |
| Seated calf raises | Barbell seated calf raise, seated calf raise | Ankle cycles; bent knee and supported-thigh setup; visible heel and toes |
| Back extension | Back extension, weighted back extension | Hip cycles on an extension bench; does not measure spinal curvature |
| Lunges and split squats | Barbell forward lunge, barbell Bulgarian split squat, dumbbell lunges | Working-knee cycles, one side at a time |
| Hip hinges | Good morning, single-leg kettlebell deadlift, single-leg dumbbell Romanian deadlift | Shoulder/hip/knee angle through a completed hinge |
| Push-ups | Incline push-up, push-up wide | Elbow cycles; incline setup has its own torso-orientation allowance |
| Curls | Incline dumbbell biceps curl, incline hammer curls | Working-elbow cycles from the extended starting phase |
| Triceps | Cable rope push-down, cable straight-bar push-down, rope overhead triceps extension | Elbow cycles with matching extension/return phase labels |
| Seated row | Single-arm cable seated row | Working-elbow cycles with upright torso setup |

## Corrections and rejection behavior

- Corrected the older profile generator's leg-curl classification from hip motion to knee flexion. A regression check covers every selected leg-curl/hamstring-curl entry.
- Added ankle-angle geometry, required foot landmarks, a minimum visible foot size and standing/seated knee-angle checks. Small pose jitter or absent toes produces no calf-raise count. The lower 12-degree excursion threshold is experimental and is not a prescribed exercise range.
- Side-view gating now checks the original shoulder landmarks for both sides so rejecting one side cannot accidentally bypass the other side's view check. Front-view lateral raises require visibly separated shoulders.
- Added movement-specific hand-position checks for pull-ups, dips and chest presses, and thigh-orientation checks for seated/standing leg curls.
- Invalid frame dimensions and non-finite presence confidence are rejected. Input poses are copied before filtering; analysis does not alter the uploaded landmarks.
- Corrected the squat registry's unsupported `verified` label to `beta`. No real-video evidence supports a verified label for any analyzer.

## Current evidence

`npm run test:ai` runs all four analysis suites. The priority suite currently passes **1,611 deterministic synthetic scenarios**: 16 scenarios for each of 100 entries, plus 11 additional family-specific adversarial cases. Per-entry scenarios cover complete cycles, reversed starts, stationary input, multiple/absent people, hidden hips, tracking gaps, repeated timestamps, non-finite landmarks, low confidence, cropped joints, invalid dimensions, right-side tracking, incomplete returns, small jitter and the wrong camera view. Additional fixtures reject mismatched pull-up/dip/press setups, seated/standing leg-curl setups, incompatible calf knee positions and missing foot landmarks.

The squat suite separately tests pixel-aspect geometry, noise, partial repetitions, dwell time, tracking gaps and immutable input. Generic tests cover five joint metrics and corrected leg-curl mapping. Dedicated-movement tests cover eight dynamic patterns and timed plank tracking.

These fixtures begin after pose extraction. They do **not** test MediaPipe's accuracy on real people, clothing, shoes, gym machines, lighting or iPhone video capture. They do not establish exercise identification, rep-count accuracy on real videos, technique quality, depth, load, muscle activation or safety. Wrong motions that share the measured joint cycle and setup can still produce counts.

## Before real-world verification

Collect consented clips across people, body proportions, devices, supported views and gym equipment, including incomplete reps, occlusion and wrong movements. Separate evaluation participants from tuning participants. Use independent human annotations of rep boundaries and visible observations, and resolve annotator disagreements. Predefine acceptance thresholds and report per-exercise rep-count error, boundary timing error, tracking coverage and abstention rates with sample sizes and failure groups. Evaluate coaching claims separately with qualified reviewers. Rep-count agreement alone does not validate technique assessment.
