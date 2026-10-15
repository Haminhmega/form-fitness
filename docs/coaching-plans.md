# Goal-based coaching plans

New accounts complete identity, optional body measurements, and four shared coaching steps. Existing accounts use Profile → Edit training preferences. Stats editing remains a separate two-step flow.

The intake saves a primary goal, up to three muscle priorities, training experience, preferred style, impact/movement preferences, session duration, available days, equipment and units. Athleticism also asks for a broad activity focus. All goals are available to everyone; body measurements and gender do not determine exercise selection.

## Recommendation behavior

`training-recommendations.ts` uses explicit rules and reviewed movement metadata from `coaching-exercises.ts`. It generates editable starting routines, not a clinical assessment or an AI-generated sport-specific program. Only known exercises with equipment and exclusion metadata enter generated plans. The large catalog and custom exercises remain available for manual programming.

Plans favor the selected goal and muscle priorities while retaining other movement patterns. New trainees start with two controlled sets and up to three weekly sessions; other users receive up to four. Available days are chosen for spacing. Estimates include warm-up, working sets, set rests, setup and both sides of unilateral movements. Time constraints can reduce sets or exercise count. Missing movement patterns and constrained schedules produce visible limitations instead of unsuitable substitutions.

Applying a plan replaces `form-recommended*` routines. The preview explains this and directs users to duplicate edited recommended routines they want to retain. Other routines and completed history are preserved. New signup installs the plan and required exercise definitions in the initial account document.

Warm-ups rehearse the chosen movements so floor/overhead exclusions do not return through generic warm-up suggestions. Rest guidance allows longer recovery. Progression cues suggest controlled reps before increasing load; the optional beginner strength introduction remains optional.

## Units and compatibility

Body values are stored as centimeters and kilograms. Metric/imperial controls render those canonical values; repeated toggles do not compound rounding. Imperial height uses feet and inches. The preference also controls workout loads. `preferences.coaching` is optional and strictly validated so older accounts remain readable.

## Verification

- `npm run test:coaching`: 350 goal/experience/equipment/time combinations, exclusions, time bounds, spacing, persistence and legacy compatibility.
- `npm run test:measurements`: optional values, imperial height, conversion bounds and repeated toggles.
- `npm run test:workout` and `npm run test:accounts`: workout behavior and account/security regressions.
- Browser checks: signup creates three tailored routines; stored measurements survive unit changes; existing profile edits save units; mobile preference editing changes the generated plan; no horizontal overflow at 390px.
- `scripts/smoke-live-accounts.mjs <origin> --live` uses a disposable synthetic account to check registration, new preference storage, login, restoration and cleanup.

## Programming basis and limits

The [ACSM 2026 resistance-training overview](https://acsm.org/resistance-training-guidelines-update-2026/) and [position stand](https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/) support individualizing goals, preferences and training dose, progressive resistance training, and consistency. Exact app rep ranges, time estimates and selection scores are conservative product starting rules, not validated personalized prescriptions. Sport skill work, rehabilitation, nutrition and automatic periodization are outside this release.
