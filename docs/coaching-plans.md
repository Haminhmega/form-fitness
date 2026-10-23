# Goal-based coaching plans

New accounts complete identity, optional body measurements, and four shared coaching steps. Existing accounts use Profile → Edit training preferences. Stats editing remains a separate two-step flow.

The intake saves a primary goal, up to three muscle priorities, training experience, multiple preferred styles, movement exclusions, a 10–120 minute time budget, available weekdays, equipment and units. Athleticism also asks for a broad activity focus. Optional profile age supplies youth or older-adult context. All goals are available to everyone; gender does not determine exercise selection.

## Recommendation behavior

`training-recommendations.ts` uses explicit rules and reviewed movement metadata from `coaching-exercises.ts`. It generates editable starting routines, not a clinical assessment or an AI-generated sport-specific program. Only known exercises with equipment and exclusion metadata enter generated plans. The large catalog and custom exercises remain available for manual programming.

Plans favor the selected goal and muscle priorities while retaining other movement patterns. Every selected weekday remains represented. Separated days can use full-body sessions; denser weeks split lower-body, pushing and pulling work, with explicit easy recovery sessions when resistance work cannot fit. Recurring-week spacing includes Sunday into Monday and meaningful secondary muscle loading. The two-calendar-day minimum and three-day preference approximate 48–72 hours only at similar session times; they cannot measure actual recovery.

The weekly set budget is distributed across selected days, rather than multiplied by day count. New trainees use controlled, manageable sets; ages 13–17 get light supervised technique practice on at most three separated resistance days, retaining other selected days as recovery. Older adults retain their selected experience and receive ability/recovery guidance rather than an age-only downgrade. Manual exercise suggestions also honor youth context. Estimates include warm-up, working sets, set rests, setup and both sides of unilateral movements. Time constraints can reduce sets or exercise count. Ten- and fifteen-minute sessions are labeled limited-volume practice; longer budgets are not filled with unnecessary sets. Missing movement patterns and constrained schedules produce visible limitations instead of unsuitable substitutions.

Applying a plan replaces `form-recommended*` routines. The preview explains this and directs users to duplicate edited recommended routines they want to retain. Other routines and completed history are preserved. New signup installs the plan and required exercise definitions in the initial account document.

Warm-ups rehearse the chosen movements so floor/overhead exclusions do not return through generic warm-up suggestions. Rest guidance allows longer recovery. Progression cues suggest controlled reps before increasing load; the optional beginner strength introduction remains optional.

Recovery sessions have their own easy-activity instructions and optional timer, and save as recovery history without invented repetitions or lifting volume. Today selects the appropriate scheduled weekday. Duplicating a generated routine creates an unscheduled manual copy.

## Units and compatibility

Body values are stored as centimeters and kilograms. Metric/imperial controls render those canonical values; repeated toggles do not compound rounding. Imperial height uses feet and inches. The preference also controls workout loads. `preferences.coaching` is optional and strictly validated so older accounts remain readable.

## Verification

- `npm run test:coaching`: 700 goal/experience/equipment/time combinations and all 127 nonempty weekday selections at three age contexts plus a barbell-only recovery matrix (508 cyclic schedule checks), plus exclusions, cyclic muscle spacing, time bounds, weekly dose, persistence and legacy compatibility.
- `npm run test:measurements`: optional values, imperial height, conversion bounds and repeated toggles.
- `npm run test:workout` and `npm run test:accounts`: workout behavior and account/security regressions.
- Browser checks cover mixed style selection, duration endpoints, exact weekday coverage, saving/restoring preferences, and recovery sessions on desktop and at a 390px phone viewport. These are browser simulations, not physical-phone certification.
- `scripts/smoke-live-accounts.mjs <origin> --live` uses a disposable synthetic account to check registration, new preference storage, login, restoration and cleanup.

## Programming basis and limits

See [training-evidence.md](training-evidence.md) for the reviewed ACSM, AAP, NSCA and original-review evidence and its limits. Full-body and split arrangements can produce comparable results at matched volume; the planner fits the arrangement to actual availability rather than claiming a universal best split. Exact app rep ranges, time estimates and selection scores are conservative product starting rules, not validated personalized prescriptions. Sport skill work, rehabilitation, nutrition and automatic periodization are outside this release.


## Current duration-aware structure (16 October 2026)

The time selector includes a suggested 60–90-minute general starting range, individualized context, and quick choices. It explicitly recognizes that shorter sessions can be effective. Each plan card compares the requested target with its actual estimate and separates warm-up from working sets/rest/setup. Applying a new recommendation remains explicit: it replaces recommended routines while preserving manually built routines and active-session snapshots.

Complementary role templates replace the old one-exercise-per-pattern ceiling. Weekly cluster, role and approximate muscle budgets constrain growth toward the time target. Compound lifts precede assistance. Available exercises are filtered by equipment and movement exclusions, and the actual recurring calendar controls recovery. The 75-minute experienced full-gym six-day fixture now returns 61–68 minute sessions with 5–6 movements, rather than two-exercise placeholders. Beginner and restricted-equipment exceptions are explained per day. No cardio filler is introduced.

See [training evidence](training-evidence.md) for sources, all duration bands, accounting assumptions and limits. Run `npm run test:coaching`, `node scripts/test-coaching-ui.mjs`, and the downstream commands in [REGRESSION.md](REGRESSION.md).
