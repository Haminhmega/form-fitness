# Session navigation — October 23, 2026

Offline PyTorch project: 28 Python tests and both synthetic smoke pipelines passed on CPU. The developer-only landmark exporter, existing AI checks and production build passed; no research/model/export strings appear in the production client bundle. The short anomaly smoke did not separate the generated unusual examples (see research/squat_ml/ANOMALY_PROTOCOL.md). No real dataset or validated detection result exists. Research checkpoints/data remain ignored. GPU and physical-phone ML integration were not tested; no learned model is installed in the app.

Cancel session is available during warm-up, lifting and recovery, including an unavailable exercise. Confirmation discards the active session and its timers without saving history; Back to Today preserves it for resuming. Automated fixtures cover guest/account ownership, keeping the session, Escape/focus, phone-width layout and reload. Sign-in offers email and, when configured, Google; the ChatGPT entry and orphan separator are removed. Existing signed-in sessions remain supported. These checks use fictional local accounts, not production account writes or a physical iPhone.

# Goal rewards update — October 20, 2026

- `npm run test:rewards`: 16 passing scenario groups for goal-normalized points, daily caps, immutable awards, time zones/DST, grace boundaries, freezes/boosts, month comparisons, authentication, SQLite concurrent writes, goal changes, and deletion races.
- `npm run test:rewards-ui`: passed using the actual App, account provider, rewards hook and Worker with isolated in-memory SQLite. Covered two completed workouts on one day, repeated Save clicks, delete/undo, previous-month selection, stale-balance rejection, purchase confirmation/cancel keyboard focus, lost-response → 401 → same-ID retry after reload, inventory/balance, offline and 503 recovery, account switching, and guest sign-in entry.
- Three rewards accessibility/layout audits passed at 375×844, 390×844 and 1440×900, with no detected axe WCAG A/AA violations, horizontal overflow or measured controls smaller than 44 pixels. Rendered screenshots were reviewed. Local evidence: `../form-rewards-evidence/report.json` and its screenshots. The ECC evidence checker passed.
- `npm run test:accounts`, `npm run test:account-recovery`, `npm run test:workout`, `npm run test:recovery`, `npm run test:ui`, `npm run test:ai`, and `npm run build` passed. The build retains its existing bundle-size advisory.
- All four D1 migrations applied to an isolated local database. `node scripts/smoke-rewards-runtime.mjs` passed against workerd + D1: enrollment, automatic reward after account save, duplicate sync, insufficient-credit rejection, account deletion and cleanup.
- Rewards tests use synthetic logged sessions, never real users' workouts or production writes. Ads remain disconnected. This is browser phone-size emulation, not testing on a physical iPhone. No movement-analysis thresholds or datasets changed in this release. Older QA entries below are historical, not a claim that every past suite was rerun.

# Form — prototype verification

## Account update — October 13, 2026

- Eleven browser checks passed against the actual local Worker/D1 backend with fictional dispatch identities: sign-up, unit conversion, optional stats, profile edit, independent-device restoration, user isolation, offline reopening/edit/reconnection, CAS conflicts and resolution, a completed workout on a second device, server input rejection, and account deletion.
- The phone Profile screen had no detected axe WCAG A/AA violations or horizontal overflow. Fixed narrow-screen form overflow, explicit select labels, and a workout toast covering the Finish control.
- Automated account API tests use real in-memory SQLite and the shipped Worker code to verify identity/origin checks, parameterized ownership, schema bounds, no-store responses, simultaneous revisions, sample filtering, deletion and stale writes after recreation. These run in GitHub CI.
- All seven PWA regression groups passed again, including app-root/subpath caching, cold offline logging, explicit update behavior, and real model inference on the same clip online and offline. All 16 deterministic AI engine groups passed. TypeScript and production build passed; production dependency audit reports zero known vulnerabilities. Four moderate development-only advisories remain in the drizzle-kit/esbuild-kit dependency chain; no vulnerable development server is exposed by the deployment.
- Local browser checks emulate iPhone 13 dimensions in Chromium. They do not claim a physical-iPhone test or end-to-end hosted OAuth verification. Local test identities are never enabled in production. The live audience remains owner-private. Videos and real wearable integrations remain outside account sync.

Evidence: work/qa-accounts-report.json and work/qa-pwa-report.json. Account architecture, operation and data limits: ACCOUNTS.md.


Date: October 13, 2026. Local preview: http://127.0.0.1:5173/. Browsers: isolated Chrome and Edge automated contexts, plus ECC Chrome DevTools rendered inspection.

## Result

The prototype now includes a working experimental, local video-analysis path for user-declared side-view bodyweight squats. TypeScript and the final production build pass. The rebuilt portable Form.html opens directly without a server and supports local logging, sample device imports and illustrated feedback; it clearly disables real AI and links to the served preview. No actual wearable connection, OAuth flow, accounts or backend integration is present. This is not validated production coaching.

## iPhone Home Screen update

Seven production-build PWA checks pass under a nested hosting path: manifest/icons/safe-area metadata, service-worker readiness, cold offline reopening with a completed set preserved, no eager AI download or clip caching, real squat inference online and then offline, deferred updates with the active-workout guard, and 390px Profile layout. No page errors occurred. These tests use Chromium phone emulation, not a physical iPhone. Basic mobile navigation/layout also passed in Windows WebKit; its missing OffscreenCanvas prevents validating iPhone AI through that environment. See IPHONE.md.

## Local AI update — final verification

The following checks were completed for this update. Suite counts describe separate scopes and can overlap; they are not a count of independent accuracy examples.

- **16 deterministic engine groups:** aspect-correct geometry, complete-cycle counting, approximate timing, pauses, sparse/irregular samples, partial starts/ends, an unconfirmed opening standing interval, tracking gaps/occlusion, recovery, stable-side selection, multiple people, view/framing gates, stationary/noisy movement, insufficient data, invalid timestamps, conservative comparisons and immutable input. `npm run test:ai` exercises synthetic pose sequences; it does not measure model accuracy on people.
- **10 direct pipeline checks:** real side-view video and blank WebM decode/inference, malformed input, cancellation before model creation and during actual model loading, cancellation after inferred frames, model-response and frame-response timeouts, retry, and no external runtime requests. Timeout cases explicitly inject a missing response and accelerate the corresponding timer; they do not claim a naturally occurring 45-second model failure. Every completed/cancelled/error path tested released its hidden decoder and worker.
- **8 independent browser pipeline cases:** the original side-view loop, two-loop derivative, the oblique TensorFlow fixture, blank MP4, raw browser-recorded WebM with initially unknown duration, malformed media, and cancellation in model/frame phases. The actual downloaded model ran on these pixels; no pose outputs were substituted.
- **10 real-AI UI checks:** actionable malformed-file error, unknown-duration WebM probing, explicit movement confirmation, cancel/retry, measured clip-specific results, replay/rep/observation markers, no-person abstention, honest unsuitable-footage behavior, no persistent video/results writes, and worker termination when leaving. Four result audits (375/768/1440px positive result and 375px unable result) found no axe A/AA violations, horizontal overflow or undersized tested buttons.
- **9 final production/portable checks:** built application boot without Vite source imports; cancellation while its actual local model request is pending; retry and real inference on single- and two-loop side-view clips; blank WebM inference; all three same-origin model/runtime assets loading under CSP; direct file boot with real AI disabled and explained; illustrated countdown/review/feedback/rep selection; a seven-day Fitbit sample import; and no external requests, page errors or CSP violations. The final single-file HTML was regenerated from this build.
- **3 AI integration checks and 3 setup accessibility audits:** direct entry, separation of real and illustrated modes, and preserving a logged set through AI entry/return. Setup fits at 375/768/1440px with zero axe A/AA violations in those states.
- **10 main-workout regression checks:** logging, rest/undo, notes/set changes, navigation/reload, illustrated recording flow, feedback controls, finishing/history, keyboard navigation, reduced motion and offline logging. Five mobile accessibility scans returned no violations.
- **7 connected-device integration checks rerun:** active-session preservation, default-off category consent, restricted sample imports, exact source selection and separate cloud preferences, unchanged manual-session totals, persistence/deep linking, and dialog keyboard containment/focus restoration. Device/Profile accessibility and device layout checks passed in the tested states.

The original prototype's **53 functional/state checks were not all rerun** for this AI update. The rerun main-flow and device-integration suites above cover affected cross-feature paths; historical suite coverage is retained below rather than represented as fresh verification.

### Observed outputs and limits

The 2.72-second side-view fixture yields 28 usable samples but no counted cycle because it begins descending before the required standing-confirmation interval. The UI explains the withheld opening movement. A test derivative repeats the same original motion twice at unchanged timing: 55 usable samples, one detected cycle and a **partial** assessment. Its measured UI marker starts at 2.9s, with the bottom observation at 4.2s and approximate lowering/rising values of 1.3s/1.0s. This is one repeated source motion, not an independently filmed two-rep set or a timing-accuracy benchmark. Blank footage yields no person and no fabricated rep measurements.

The public oblique elastic-band clip also produced one partial cycle through the user-declared squat path. This is a limitation: the view gates do not certify exercise identity, absence of equipment or correct camera orientation. The test supports a user-declared movement; it is not a general exercise recognizer. No thresholds were tuned to force the positive fixture to pass. AI-TEST.md specifies the gates and known limitations.

Sampling uses decoded pixels at approximately 10 clip positions per second, bounded to 960×720. Reported timestamps are media sampling positions, not exact encoded-frame presentation timestamps. Repeated frames in low-frame-rate sources and the sample interval limit timing precision. The overlay contains estimated landmarks from the selected clip, and its coverage percentage is not a technique score.

The selected MediaPipe runtime is pinned to 0.10.35. An earlier investigation found an external logging request in 1.1.0; that version was removed. The final worker/pipeline/UI/production runs observed no external HTTP requests or network writes. The owned worker restricts fetch/XHR to exact local GET/HEAD asset URLs, with the app's CSP as a second boundary. This evidence does not constitute a complete security audit or a guarantee about future dependency versions.

### Test-media provenance and scope

- The side-view photographic motion GIF is [Bodyweight Squats by Danielflefil](https://commons.wikimedia.org/wiki/File:Bodyweight_Squats.gif), under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The test conversion preserved the original 40ms-per-frame timing, resized 1080×1080 to 720×720, and encoded H.264 without audio. The two-loop derivative repeats that encoded loop without interpolation, added holds or speed changes; the same attribution/license apply.
- The [TensorFlow pose test video](https://github.com/tensorflow/tfjs-models/blob/master/pose-detection/src/blazepose_tfjs/blazepose_test.ts) attributes its footage to [Anna Shvets on Pexels](https://www.pexels.com/video/woman-doing-squats-4838220/), under the [Pexels media license](https://www.pexels.com/license/). Upstream reduced it to 5fps. It is a decoding/inference stress example of an unsupported oblique elastic-band variation, not bodyweight-squat accuracy evidence.
- Blank files were generated from a solid canvas; the malformed file is text with a video extension. No real user media was used. Test photos/videos/GIFs and extracted poses remain under work/ and are **not shipped** in the application/source archive. No actor is represented as a Form user or endorser.

Full source links, transformations and hashes are recorded in `work/ai-fixtures/PROVENANCE.md` and fixture metadata. Verification reports: `work/qa-ai-pipeline-report.json`, `work/ai-fixtures/pipeline-smoke-report.json`, `work/ai-fixtures/ui-qa-report.json`, `work/qa-ai-production.json`, `work/qa-ai/layout-report.json`, `work/qa-ai-regression/main-report.json`, and `work/qa-devices/integration-report.json`. These are workspace evidence, not dependencies of the delivered app.

The browser tests used local Chrome/Edge contexts with MP4/WebM files, not physical phone cameras. There is no real camera/microphone capture in this test. No coach-labeled accuracy benchmark, population validation, real-phone performance study, anatomical/clinical measurement validation, injury assessment or cross-browser/codec guarantee is claimed. The portable HTML is a design preview; real analysis requires the served app and its bundled model assets.

## Original prototype baseline

- Main flow: start routine, edit and complete a set, undo, rest timer add/skip, notes, navigate/reload/resume, recording setup/countdown/stop/review, simulated pending/results, highlighted rep 8, overlay, flag, return, finish confirmation, saved history.
- Manual-only workouts, active session preservation, mobile persistent rest/finish controls, and offline logging after load.
- Routine creation, target editing, reorder, replacement, removal/undo, renaming, duplication, deletion/undo, token-based exercise search/filter/empty results, paginated browsing of 2,906 on-demand CC0 catalog movements, catalog-to-routine persistence, movement details/source labeling, custom logging-only exercise, local persistence.
- Recording: all nine preview failure/uncertainty states and recovery, unsupported variation disabled state, pending continuation, new-set reset, local generated WebM preview, object URL release, reduced-motion autoplay behavior, standalone exercise choice and return navigation.
- History: sample/local filters, exact trend table, explicitly partial sample breakdown, defined PRs, independent comparison rep selection, limited-data and empty states.
- Profile: units and conversion, independent default-off cloud/contribution preferences, illustrative reminders, retention/deletion explanations, first-time experience and all five onboarding steps.

The four original fitness-prototype suites recorded 53 passing functional/state checks (10 main, 12 routines, 8 progress/profile, 23 recording), plus five portable/mobile smoke checks. Those full suites were run before the connected-device addition; they were not all repeated for this update. The current integration checks below specifically recheck active-workout preservation, device navigation, source readings, consent separation, and unchanged Form history totals.

## Connected-device baseline

The connected-device addition recorded 57 checks across five suites. The seven integration checks were rerun for the AI update as noted above; the complete baseline is retained here for scope clarity:

- **13 model checks:** five disconnected initial providers; seven deterministic consent-filtered sample dates; unsupported WHOOP steps omitted; repeated sync without duplicate dates/workouts; immediate scope revocation; grants waiting for explicit sync; exact preferred-source selection and deterministic fallback; connected-source preference under Auto; zero versus absent/nonfinite values; no cross-provider HRV averaging; retained disconnected data marked stale; deletion and preference behavior; expired consent protection; immutable state transforms.
- **22 device-hub checks:** opt-in consent, cancellation, simulated import/loading, permission editing, repeated sync, WHOOP capability explanation, source selection, revoking every scope, stale/error/expired/empty recovery, explicit reconnection consent, disconnect with optional data retention, confirmed provider deletion, browser reload, accessibility, phone layout, and no external account/data-service requests.
- **8 Today/Progress widget checks:** workout action remains ahead of device context; management entry works; values retain exact source/date attribution; imported workouts remain outside Form session totals; WHOOP steps remain missing; retained and stale records are labeled; zero, missing and older records are distinct. Eight rendered accessibility/layout audits cover empty, imported and missing-data states across 375, 768 and 1440px.
- **7 cross-feature integration checks:** a completed set survives the device-management flow; consent begins off and can be declined; imports contain only approved categories; source choice changes readings without combining totals or enabling cloud/model-contribution consent; imported workouts leave manual session totals unchanged; the device deep link and local data survive reload; mobile modal Tab containment and Escape focus restoration work. Device and Profile screens returned no axe A/AA violations in the tested 375px states, and device layouts fit at 375, 768 and 1440px.
- **7 portable-file checks:** direct file opening and device navigation; consent-filtered sample connection; repeat refresh without duplicates; correct Today readings with unapproved vitals absent; modal keyboard containment and focus restoration; reload persistence; 375px and 1440px layouts without horizontal overflow. This run made **zero external requests** and reported **zero runtime errors**.

A Tab containment issue in the mobile consent dialog was fixed and the unchanged integration suite passed after the fix. Additional diagnostic checks covered twelve forward and twelve reverse Tab presses. Clean device screenshots at phone, tablet and desktop sizes were inspected separately from automated screenshots.

Evidence: `work/qa-device-model-results.json`, `work/qa-devices-report.json`, `work/qa-device-insights/report.json`, `work/qa-devices/integration-report.json`, `work/qa-devices/evidence.json`, and `work/qa-devices-portable.json`. These are workspace verification artifacts; the deliverable includes the application source and this summary, not the browser automation environment.

All imported device records are fictional October 7–13, 2026 examples. These tests do not validate vendor API availability, real OAuth scopes, real wearable data, native HealthKit/Health Connect permissions, background refresh, health interpretation, or production privacy/security behavior. No network integration or secrets are included.

## Layout and accessibility

Rendered screenshots and overflow measurements cover 375×812, 768×1024, and 1440×900. Additional routine checks cover 320px; recording checks also cover 1366px. The primary action remains visible early on the phone. Large inputs, persistent controls and clear hierarchy support gym use.

Automated axe scans using WCAG A/AA rule tags returned no violations on Today, active workout, recording setup/results, routine library/editor, Progress, Profile, and onboarding in the tested states. Focus ring/keyboard navigation, labels, contrast checks, reduced-motion behavior and target sizing were checked. A 34px toast dismissal hit target found during testing was enlarged to 44px and verified in the final smoke check. No runtime errors or failed application requests were observed in the main flow.

These checks are not a complete accessibility certification. A manual screen-reader evaluation, physical touch-device testing, real camera permissions/capture, codec/browser compatibility beyond the tested Chrome/Edge MP4/WebM files, storage denial/quota testing, and representative production performance evaluation remain future work.

## Visual regression and performance limits

This is the initial visual baseline. Regression comparison is **inconclusive** because no earlier approved screenshots exist. Screenshots were inspected directly for layout, text fit, and control placement. Core Web Vitals were not measured as representative production metrics; no LCP/CLS/INP pass is claimed.

Evidence and browser scripts remain in the workspace’s work/ directory. DESIGN.md documents the contract and README.md documents operation, mock boundaries and next milestones.

## Familiar workout and illustration update — October 16, 2026

- Planner: familiar staples are preferred within the same role; explicit training styles, equipment, movement exclusions, experience and athletic goals remain effective. Tests cover reversed catalog order and introductory-drill fallback.
- Existing coaching suites passed: 700 goal/equipment/time combinations, 508 repeating weekly schedules and 3,381 duration plans. The experienced six-day, 75-minute gym fixture remains 61–68 estimated minutes with 5–6 exercises per day.
- Demonstrations: 31 named variants, with fixed-length limbs, smooth motion, stationary isolation pivots and bench contact points checked. Bench presses, shoulder presses, hammer curls, cable pushdowns and seated leg movements have distinct references.
- Browser checks: keyboard slider and position buttons, pause/play, pause off-screen, reduced motion, custom-exercise fallback, 44px control heights, no overflow at 375/390/1440px, and no scoped axe A/AA violations. Demonstration fixtures made zero external requests.
- Existing workout/library UI smoke passed, including collapsible instructions, preserved sets/rest timer after reopening, library sorting/filtering and recording deep links. Account, workout and recovery suites passed.
- Production build passed, including the PWA and Worker. The existing large-bundle warning remains; this update does not claim a production performance improvement.
- Illustrations remain schematic, and machine geometry varies. These checks do not validate individual training outcomes, biomechanical accuracy or AI video-analysis accuracy. The visual contract and selection rationale are in [workout-demonstration-design.md](docs/workout-demonstration-design.md).

## Email and usage regression (22 October 2026)

Run `npm run test:accounts` (includes email security and usage tests), `node scripts/test-email-ui.mjs`, and `npm run test:account-recovery`. Verify registration requires the received code, reset invalidates prior sessions, changing email requires the current password and new-address code, and provider users preserve the same workout owner ID when adding password sign-in. Check missing mail configuration fails closed; no test sends real email. Usage is off by default, its dashboard is owner-only, client timestamps and arbitrary data are rejected, repeated event IDs deduplicate, and opt-out erases events. Delivery/DNS must also be checked against Resend before calling email production-ready.
