# Form

A React + TypeScript fitness beta with account sync, workout logging, personalized routines, exercise instructions, and experimental on-device motion measurements.

Live app: https://formfitness.fit. Open in iPhone Safari and choose Share → Add to Home Screen to install. A ChatGPT account is not required for email/password sign-in.

## Run and verify

Run npm install, npm run prepare:ai, then npm run dev -- --port 5192.

Checks: npm run test:ai, npm run test:camera, npm run test:accounts, npm run test:workout, npm run test:coaching, npm run test:measurements, npm run test:catalog, npm run test:anatomy, npm run test:recovery, and npm run build.

scripts/test-account-recovery.mjs runs isolated browser account fixtures; scripts/smoke-review-update.mjs checks the integrated workout and library at port 5192 (override with FORM_TEST_URL). Set PLAYWRIGHT_CHROMIUM_EXECUTABLE to use an existing browser executable.

## Training

- Coaching intake asks about the main goal (including hypertrophy, glute development and athletic foundations), up to three muscle priorities, experience, multiple training styles, movements to avoid, a 10–120-minute time budget, equipment and actual weekdays. Optional age adds youth/older-adult context. Every selected weekday stays scheduled, with cyclic muscle recovery checks and explicit easy recovery sessions when needed. New accounts save a weekly starter plan; existing users can update it from Profile. The plan explains selections and any constraints. Recommendations remain editable and preserve self-built routines. A beginner strength check is optional and does not ask for maximum lifts. Research and planning limits are documented in `docs/training-evidence.md`.
- Metric and imperial controls cover both body stats and workout loads. Imperial height uses feet and inches; switching units preserves the original metric values without repeated rounding.
- Profile includes app and logo color controls: six accessible presets plus custom color pickers. Appearance saves with the rest of the user preferences and applies across highlights, buttons, progress, movement overlays, and Form wordmarks.
- Active workouts show the same step-by-step instructions, muscle details and available movement illustrations as the library, above the set log. Timed holds use seconds. Rest and warm-up timers use saved deadlines and survive reopening.
- The library includes 2,906 catalog movements. Most popular is an editorial shortlist of common gym exercises, not an observed usage ranking. A–Z and Z–A sorting work with search and filters. The focused beta filter lists 100 exercise profiles.
- Exercise illustrations only display for supported exact variants. Start/end buttons, a scrubber and optional animation allow inspection; reduced-motion settings use static positions.
- Device connection entry points have been removed. Legacy device/sample source files are retained for reference, not presented as active features.

## Motion checks

Choose Check my form or open /#form-test. Select the exercise, follow its camera setup, film in the app or choose a playable 2–60 second clip (maximum 100 MB), and confirm the person and movement. The app runs MediaPipe pose estimation locally and measures visible joint cycles, tempo, range comparisons or hold duration. Catalog recording links preserve the selected exercise on reload.

All movement rules are experimental, including squats. Synthetic tests check rule behavior; there is no held-out real-video accuracy benchmark or physical-iPhone validation. The app does not identify the exercise automatically, infer load or grip, grade technique, or predict safety. It reports partial/unable results when the view is insufficient. See AI-TEST.md and docs/ai-100-expansion.md.

Videos and detailed results stay in memory, are never uploaded or cached, and are cleared on leaving the check. Analysis does not change logged reps. View illustrated example opens a movement reference, not simulated feedback about the user's clip.

## Accounts and offline use

Email/password accounts, optional Google sign-in, profile stats, routines, preferences and completed-workout sync are real. Expired sessions retain unsynced local edits and request sign-in before syncing. Skipping initial profile setup is remembered per account. Password authentication has per-email and per-IP throttling and rotates the browser session.

Active workouts remain on the device until completed. Rest timers are scoped to the account and workout. Browser storage can be cleared by the user or OS, so it is not a backup. The installed PWA keeps its current version during training and offers an update when available. Finish the active workout and sync before updating. See ACCOUNTS.md and IPHONE.md.

Sample history, fictional profile data and optional prototype preferences are labeled. Form remains a beta; physical-phone testing and real-video evaluation are still required before making validated coaching claims.

## Video suggestions and phone layout

Uploaded clips now receive up to three prioritized actions, derived from continuous, visible same-side repetitions: persistent torso/body-line changes and repeated changes in projected range or timing. Each observed pattern links to a representative moment in the video. Poor capture produces recording guidance; an unremarkable clip receives an explicitly labeled general practice cue, not a passing form grade. Video stays in the browser.

These beta rules use engineering thresholds and synthetic regression fixtures, not clinical cutoffs or validated real-video coaching accuracy. Research, source limitations and the intended release evaluation are documented in [form-feedback-evidence.md](docs/form-feedback-evidence.md). `npm run test:ai` includes feedback quality gates, interruptions, working-side changes, noisy poses and timestamp checks.

Exercise instructions can be collapsed in the library and during a workout. Phone layouts use readable text, larger tap targets, compact set logging and safe-area spacing. Desktop layout remains available at wider sizes.

Today now prioritizes Start/Resume, with session previews, weekly planning and beginner baselines behind labeled disclosures. Train keeps search and sorting visible, groups secondary filters, and preserves results when opening an exercise. Workouts show a short cue with expandable full instructions, one video-check entry, optional notes, and a phone dock for the next set or exercise.

In-app filming uses video-only browser camera capture with an optional 3/5/10-second countdown, preview, Stop and Retake. It stops automatically before 60 seconds and sends the local take through the same review/analysis flow. Camera permission is requested only after an explicit action, tracks are stopped on cancel/exit/background, and uploads remain the fallback. See [in-app recording notes](docs/in-app-recording.md) for browser compatibility and the physical-phone test checklist.
