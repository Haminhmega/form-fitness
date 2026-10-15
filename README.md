# Form

A React + TypeScript fitness beta with account sync, workout logging, personalized routines, exercise instructions, and experimental on-device motion measurements.

Live app: https://formfitness.fit. Open in iPhone Safari and choose Share → Add to Home Screen to install. A ChatGPT account is not required for email/password sign-in.

## Run and verify

Run npm install, npm run prepare:ai, then npm run dev -- --port 5192.

Checks: npm run test:ai, npm run test:accounts, npm run test:workout, npm run test:coaching, npm run test:measurements, npm run test:catalog, npm run test:anatomy, npm run test:recovery, and npm run build.

scripts/test-account-recovery.mjs runs isolated browser account fixtures; scripts/smoke-review-update.mjs checks the integrated workout and library at port 5192 (override with FORM_TEST_URL). Set PLAYWRIGHT_CHROMIUM_EXECUTABLE to use an existing browser executable.

## Training

- Coaching intake asks about the main goal (including hypertrophy, glute development and athletic foundations), up to three muscle priorities, experience, training style, impact preference, movements to avoid, session time, equipment and available days. New accounts save a multi-day starter plan; existing users can update it from Profile. The plan explains selections and any constraints. Recommendations remain editable and preserve self-built routines. A beginner strength check is optional and does not ask for maximum lifts.
- Metric and imperial controls cover both body stats and workout loads. Imperial height uses feet and inches; switching units preserves the original metric values without repeated rounding.
- Active workouts show the same step-by-step instructions, muscle details and available movement illustrations as the library, above the set log. Timed holds use seconds. Rest and warm-up timers use saved deadlines and survive reopening.
- The library includes 2,906 catalog movements. Most popular is an editorial shortlist of common gym exercises, not an observed usage ranking. A–Z and Z–A sorting work with search and filters. The focused beta filter lists 100 exercise profiles.
- Exercise illustrations only display for supported exact variants. Start/end buttons, a scrubber and optional animation allow inspection; reduced-motion settings use static positions.
- Device connection entry points have been removed. Legacy device/sample source files are retained for reference, not presented as active features.

## Motion checks

Choose Check my form or open /#form-test. Select the exercise, follow its camera setup, choose a playable 2–60 second clip (maximum 100 MB), and confirm the person and movement. The app runs MediaPipe pose estimation locally and measures visible joint cycles, tempo, range comparisons or hold duration. Catalog recording links preserve the selected exercise on reload.

All movement rules are experimental, including squats. Synthetic tests check rule behavior; there is no held-out real-video accuracy benchmark or physical-iPhone validation. The app does not identify the exercise automatically, infer load or grip, grade technique, or predict safety. It reports partial/unable results when the view is insufficient. See AI-TEST.md and docs/ai-100-expansion.md.

Videos and detailed results stay in memory, are never uploaded or cached, and are cleared on leaving the check. Analysis does not change logged reps. View illustrated example opens a movement reference, not simulated feedback about the user's clip.

## Accounts and offline use

Email/password accounts, optional Google sign-in, profile stats, routines, preferences and completed-workout sync are real. Expired sessions retain unsynced local edits and request sign-in before syncing. Skipping initial profile setup is remembered per account. Password authentication has per-email and per-IP throttling and rotates the browser session.

Active workouts remain on the device until completed. Rest timers are scoped to the account and workout. Browser storage can be cleared by the user or OS, so it is not a backup. The installed PWA keeps its current version during training and offers an update when available. Finish the active workout and sync before updating. See ACCOUNTS.md and IPHONE.md.

Sample history, fictional profile data and optional prototype preferences are labeled. Form remains a beta; physical-phone testing and real-video evaluation are still required before making validated coaching claims.
