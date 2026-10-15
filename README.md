# Form

A React + TypeScript training prototype with one movement-specific bodyweight squat analyzer and 100 beta joint-motion checks. Charcoal, warm white, restrained lime. Includes real account sign-in, a user-owned D1 profile, and cross-device sync. No video uploads or model training.

## Accounts and body stats

Continue with ChatGPT, then set your name, optional age/height/current and target weight, activity level, goal, training days and equipment. Metric and imperial input are supported. Profile → Edit stats & goals updates them. See [ACCOUNTS.md](ACCOUNTS.md) for sync, deletion, backend operation and verification limits. The live app remains owner-private.

## Install on iPhone

Open [Form](https://form-fitness-minh.breezy-rhea-1400.chatgpt.site) in Safari, sign in to the owning ChatGPT account if asked, then choose Share → Add to Home Screen → Add. The source repository and hosted app are private. See [IPHONE.md](IPHONE.md) for offline setup, updates and device limitations.

## Open it

The live development preview is available at **http://127.0.0.1:5173/** while its local server is running.

For a portable design preview, open **Form.html** (delivered beside this source folder). Logging, sample device imports, and illustrated feedback work without a server. **Real AI analysis requires the served app and the included local model/WASM assets**, and is disabled in the standalone HTML. Browser-local state for the portable file and server preview are separate. When browser storage is unavailable, the app remains usable in memory but cannot promise persistence.

To run or edit the source, open a terminal in this folder:

```sh
npm install
npm run prepare:ai
npm run dev -- --port 5173
```

To verify and build:

```sh
npm run build
npm run preview
```

## Walk through the prototype

**Try real AI:** Today → **Check my form**, or open **http://127.0.0.1:5173/#form-test**. Choose a 2–60 second video (up to 100 MB), confirm it shows one person doing standard bodyweight squats from the side, and select **Analyze squat video**. Use an up-to-date Chrome or Edge for this test. Results include usable-frame coverage, detected complete repetitions, lowering/rising timing, projected knee-angle measurements, and timestamped replay with actual tracked joints. Unclear or unsuitable movement yields partial/unable output. A model download occurs during preparation; inference reads assets from this app only. Videos and results stay in memory and are cleared when leaving the screen. Results do not modify logged sets, sample history, or device readings. See AI-TEST.md for implementation and validation limits.

Choose **Explore the local demo** when using a preview without hosted sign-in.

To explore the **illustrated example**:

1. On Today, choose **Start workout**.
2. Edit weight/reps and complete a set. Try undo and the rest timer.
3. Choose **Record this set**, then **View illustrated example** for squats, confirm the variation, and choose **Start sample recording**.
4. After the countdown, stop the simulated recording and review the illustrated sample.
5. Choose **See simulated feedback**. You may continue the workout during the wait, then return via Record this set.
6. Select rep 7 or 8, toggle the illustrative overlay, or flag feedback.
7. Return to the workout and finish. Confirm saving, then inspect **Your sessions** in Progress.

Use Train to create/edit/duplicate/delete routines, rearrange exercises, search the library, and create custom exercises. The library loads 2,906 CC0 catalog movements from the Kaggle Gym Exercise Dataset on demand; only catalog exercises added to a routine are saved to the user's account. Catalog and custom exercises support logging only. See [EXERCISE_DATA.md](./EXERCISE_DATA.md). Profile controls units and illustrative privacy preferences. **Personalize training** opens the skippable five-step onboarding. **First-time experience** hides seeded history without hiding sessions you logged yourself.

**Connected devices:** open Profile → Connected devices, select Fitbit, WHOOP, Garmin, Apple Health, or Health Connect, choose permitted categories, then import the demo. Today and Progress show the selected readings with their source. Use source preferences to resolve overlap, and try refresh, permission changes, failure states and disconnect. This imports fictional examples only; no real wearable account is connected. See DEVICES.md for the behavior and researched future integration routes.

Illustrated recording screens expose **Preview a state** for denied permission, incomplete framing, multiple people, obscured joints/poor lighting, unsupported movements, interrupted recording, upload/analysis failure, and unable-to-assess results. These controls do not affect the real analyzer.

## Major UX decisions

- Starting and continuing a session is the primary task. Active sessions remain one tap away. On a phone, a persistent workout dock keeps rest controls and finishing within reach.
- Signed-in profile stats, routines, exercise library, training preferences and completed workouts sync across devices. Active workouts and notes remain local until completion. Reloading or changing screens preserves an active workout. A confirmation prevents accidentally finishing or replacing it.
- Manual logging is a complete path. Video is optional. Real experimental analysis supports selected bodyweight squat clips; the three original named movements retain illustrated feedback examples.
- Feedback explains what, where, and a possible next action. Visibility is explicit. There are no overall scores, safety guarantees, diagnoses, or invented research citations.
- Desktop uses a side rail and contextual panels; phones use bottom navigation and a single task column. Native dialogs, labels, focus rings, reduced motion, and large controls support keyboard and touch use.

## What is mocked

- Alex Lee, seeded October 2026 sessions, previous values, and sample routines are demonstration data.
- On **View illustrated example**, camera permission, framing checks, countdown capture, analysis waits, observations, confidence, and rep markers are simulated. The real squat test is a separate screen with actual pose inference and experimental measurement logic.
- User-selected videos use temporary object URLs. They are not uploaded or stored, and are released when the recording screen closes. Illustrated example findings never describe the selected video.
- Recording comparisons use explicitly labeled illustrations. Tempo remains unassessed. Limited data does not produce improvement claims.
- Reminder, video-upload, video-retention, model-contribution and video-deletion controls remain illustrative. Account syncing and account deletion are real and separate from these video preferences.
- Feedback flags are local to the current preview and are not sent. Sample feedback links identify the demonstrated exercise. Only one sample feedback reference per locally logged session is retained.
- No payment service, validated production coaching, or model training exists. The production build supports Home Screen installation and offline reopening after setup. Profile and completed-session sync require a signed-in hosted account.

## Next milestones

1. Usability testing with beginner/intermediate lifters; screen-reader testing and real-device camera ergonomics.
2. A validated movement/variation support contract with observable evidence, uncertainty thresholds, and evaluation fixtures.
3. Real camera capture and upload lifecycle with explicit consent, clear retention/deletion behavior, and robust error recovery.
4. Physical-iPhone sign-in, installation, offline-sync and multi-device usability testing.
5. Carefully evaluated, exercise-specific analysis and longitudinal coaching quality testing.

See DESIGN.md for the product/screen contract, AI-TEST.md for the experimental analyzer, and QA.md for checks and limitations. This deliverable is a test version, not a validated coaching product.
