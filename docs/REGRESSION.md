# Regression dependency ledger

Audit baseline: `8336632df9ffaceb231c5752fe8508d5dec367c6` (previous deployed source).

Scope is the changed working tree as well as any subsequent commit. Dependency evidence can be reproduced with `rg -n 'training-recommendations|coaching-plan|buildWarmup|buildFormFeedback|FormFeedbackPanel' src shared scripts`.

| Changed module | Downstream consumers | Acceptance commands |
| --- | --- | --- |
| Form-feedback geometry and assessment statuses | AIRecording, FormFeedbackPanel | `npm run test:ai`; `node scripts/test-feedback-ui.mjs` |
| Planner, curated roles and duration advice | Intake, Today/plan preview, Workout, account-storage | `npm run test:coaching`; `node scripts/test-coaching-ui.mjs`; `npm run test:workout`; `npm run test:recovery`; `npm run test:accounts` |
| Warm-up duration and shared instructions | Active workout, cold-launch recovery, exercise library | `npm run test:ui` with `FORM_TEST_URL` set to the local dev server |
| All changed TypeScript/UI | Client, PWA and Worker build | `npm run build` |

Propagation: externally visible changes require all listed downstream checks. No exemptions in this release. Commands execute in the form-prototype checkout using installed dependencies; they use local fixtures, in-memory account storage or a local preview and do not write production accounts. Browser tools use the installed Edge runtime. Production build and Sites publication follow these checks.

Regression points: AI starting-position findings and check status (test-form-feedback); RECOVERY and saved sets (test-recovery, smoke-review-update); PLAN-TIME-75, all duration bands, ordering, weekly-dose bounds and gap disclosure (test-training-duration); account validation and preservation of manual plans (test-coaching-storage, test-accounts).

Known limits: synthetic pose fixtures do not validate real-video accuracy. Browser fixtures do not validate physical iPhone camera behavior or individual training outcomes. The release report must retain these limits.
