# Regression dependency ledger

Audit baseline: `4af800f773a6e1db9c77cb7c7472462f56359368` (deployed version 22).

Scope is the changed working tree as well as any subsequent commit. Dependency evidence can be reproduced with `rg -n 'training-recommendations|coaching-plan|buildWarmup|buildFormFeedback|FormFeedbackPanel' src shared scripts`.

| Changed module | Downstream consumers | Acceptance commands |
| --- | --- | --- |
| Form-feedback geometry, squat attempt coaching and assessment statuses | AIRecording, FormFeedbackPanel | `npm run test:ai`; `node scripts/test-feedback-ui.mjs`; `node scripts/test-squat-coaching-ui.mjs` |
| Planner, curated roles and duration advice | Intake, Today/plan preview, Workout, account-storage | `npm run test:coaching`; `node scripts/test-coaching-ui.mjs`; `npm run test:workout`; `npm run test:recovery`; `npm run test:accounts` |
| Warm-up duration and shared instructions | Active workout, cold-launch recovery, exercise library | `npm run test:ui` with `FORM_TEST_URL` set to the local dev server |
| Exercise familiarity and demonstrations | Planner, library, Workout instructions, Recording and AIRecording references | `npm run test:catalog`; `node scripts/test-exercise-demo-ui.mjs`; planner and shared-instructions rows above |
| All changed TypeScript/UI | Client, PWA and Worker build | `npm run build` |

Propagation: externally visible changes require all listed downstream checks. No exemptions in this release. Commands execute in the form-prototype checkout using installed dependencies; they use local fixtures, in-memory account storage or a local preview and do not write production accounts. Browser tools use the installed Edge runtime. Production build and Sites publication follow these checks.

Regression points: AI starting-position findings and check status (test-form-feedback); RECOVERY and saved sets (test-recovery, smoke-review-update); PLAN-TIME-75, all duration bands, ordering, weekly-dose bounds and gap disclosure (test-training-duration); account validation and preservation of manual plans (test-coaching-storage, test-accounts).

Known limits: synthetic pose fixtures do not validate real-video accuracy. Browser fixtures do not validate physical iPhone camera behavior or individual training outcomes. The release report must retain these limits.

October 16 familiarity/demonstration update: changed exercise selection ranking, extracted demonstration geometry/data and replaced the illustration renderer. All planner, catalog, shared-instruction, account, workout, recovery and production-build checks apply. New regression points cover stable selection regardless of catalog order, familiar staples without overriding equipment/preferences, 31 exact demonstrations, stationary elbow/knee pivots, bench contact points, continuous fixed-length limbs, static reduced-motion controls, off-screen pause and no demonstration network requests. No analyzer thresholds, recording permissions or account contracts changed.

Version 23 scope: only feedback/recording presentation and its tests changed. Reproduced dependency search: `rg -n 'squatCoaching|buildFormFeedback|FormFeedbackPanel|feedback-kinematics' src scripts`. Required checks are the feedback row and production build. Planner, warm-up, account and workout-storage commands are exempt because no code or persisted contracts in those paths changed. Added regression points: SQUAT-ATTEMPT-NO-REPS, SQUAT-FORWARD-LEAN-NO-FALSE-ALARM, COACH-POSITIVE-CLOSURE and COACH-STANCE-EXPERIMENT. The real local MOV diagnostic is an additional debugging reproduction, not a benchmark; see the feedback evidence note.
