# Regression dependency ledger

October 23 mobile layout: `test:mobile` covers five widths, 60 screen states, touch targets, readable fields, five accessibility audits, theme/settings disclosures and workout dock/navigation behavior. Required downstream checks: `test:ui`, `test:cancel-session`, `test:account-recovery`, `test:rewards-ui`, coaching UI and production build. Planner math, AI geometry and server contracts are unchanged, so their unit suites are not required for this presentation change.

October 23 session navigation: `test:cancel-session` covers confirmation, keeping a session, Escape/focus, guest and account storage, warm-up/lifting/recovery/unavailable-exercise paths, timer removal and reload. `test:ui`, coaching UI, workout/recovery and rewards checks cover downstream session behavior. Account recovery asserts the ChatGPT login link and unused divider are absent. Existing provider sessions are preserved. Production build also applies.

Audit baseline: `4af800f773a6e1db9c77cb7c7472462f56359368` (deployed version 22).

Scope is the changed working tree as well as any subsequent commit. Dependency evidence can be reproduced with `rg -n 'training-recommendations|coaching-plan|buildWarmup|buildFormFeedback|FormFeedbackPanel' src shared scripts`.

| Changed module | Downstream consumers | Acceptance commands |
| --- | --- | --- |
| Form-feedback geometry, squat attempt coaching and assessment statuses | AIRecording, FormFeedbackPanel | `npm run test:ai`; `node scripts/test-feedback-ui.mjs`; `node scripts/test-squat-coaching-ui.mjs` |
| Planner, curated roles and duration advice | Intake, Today/plan preview, Workout, account-storage | `npm run test:coaching`; `node scripts/test-coaching-ui.mjs`; `npm run test:workout`; `npm run test:recovery`; `npm run test:accounts` |
| Warm-up duration and shared instructions | Active workout, cold-launch recovery, exercise library | `npm run test:ui` with `FORM_TEST_URL` set to the local dev server |
| Exercise familiarity and demonstrations | Planner, library, Workout instructions, Recording and AIRecording references | `npm run test:catalog`; `node scripts/test-exercise-demo-ui.mjs`; planner and shared-instructions rows above |
| All changed TypeScript/UI | Client, PWA and Worker build | `npm run build` |
| Goal rewards, account-scoped ledger and shop | Today, Progress, workout completion, account sync and deletion | `npm run test:rewards`; `npm run test:rewards-ui`; `npm run test:accounts`; `npm run test:account-recovery`; `npm run test:workout`; `npm run test:recovery` |

Propagation: externally visible changes require all listed downstream checks. No exemptions in this release. Commands execute in the form-prototype checkout using installed dependencies; they use local fixtures, in-memory account storage or a local preview and do not write production accounts. Browser tools use the installed Edge runtime. Production build and Sites publication follow these checks.

Regression points: AI starting-position findings and check status (test-form-feedback); RECOVERY and saved sets (test-recovery, smoke-review-update); PLAN-TIME-75, all duration bands, ordering, weekly-dose bounds and gap disclosure (test-training-duration); account validation and preservation of manual plans (test-coaching-storage, test-accounts).

Known limits: synthetic pose fixtures do not validate real-video accuracy. Browser fixtures do not validate physical iPhone camera behavior or individual training outcomes. The release report must retain these limits.

October 16 familiarity/demonstration update: changed exercise selection ranking, extracted demonstration geometry/data and replaced the illustration renderer. All planner, catalog, shared-instruction, account, workout, recovery and production-build checks apply. New regression points cover stable selection regardless of catalog order, familiar staples without overriding equipment/preferences, 31 exact demonstrations, stationary elbow/knee pivots, bench contact points, continuous fixed-length limbs, static reduced-motion controls, off-screen pause and no demonstration network requests. No analyzer thresholds, recording permissions or account contracts changed.

Version 23 scope: only feedback/recording presentation and its tests changed. Reproduced dependency search: `rg -n 'squatCoaching|buildFormFeedback|FormFeedbackPanel|feedback-kinematics' src scripts`. Required checks are the feedback row and production build. Planner, warm-up, account and workout-storage commands are exempt because no code or persisted contracts in those paths changed. Added regression points: SQUAT-ATTEMPT-NO-REPS, SQUAT-FORWARD-LEAN-NO-FALSE-ALARM, COACH-POSITIVE-CLOSURE and COACH-STANCE-EXPERIMENT. The real local MOV diagnostic is an additional debugging reproduction, not a benchmark; see the feedback evidence note.

October 22 goal/intake update: one combined muscle, physique and strength choice with legacy goal aliases; three-day weekly guidance and 60–90-minute suggestions. The new-profile duration is 60 minutes. Existing saved availability is preserved. Planner/intake downstream checks and the production build apply. Added checks cover the canonical goal and aliases, progressive prescriptions, all duration bands for the combined goal, shorter availability, mobile/desktop layout and onboarding into a workout.

October 22 programming/email/usage update: planner rows plus account/rewards/workout/recovery downstream checks apply. Registration codes, reset, email updates and opt-in analytics add `test-email-security.mjs`, `test-usage.mjs` (both part of test:accounts), and `test-email-ui.mjs`. Public privacy notice and additive migration 0004 are included. Provider delivery is mocked in tests; live DNS/sending checks are separate.
