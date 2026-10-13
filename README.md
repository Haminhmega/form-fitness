# Form

A React + TypeScript training prototype with a working, experimental local AI test for bodyweight squat videos. Charcoal, warm white, restrained lime. No backend, accounts, video uploads, or model training.

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

To explore the **illustrated example**:

1. On Today, choose **Start workout**.
2. Edit weight/reps and complete a set. Try undo and the rest timer.
3. Choose **Record this set**, then **View illustrated example** for squats, confirm the variation, and choose **Start sample recording**.
4. After the countdown, stop the simulated recording and review the illustrated sample.
5. Choose **See simulated feedback**. You may continue the workout during the wait, then return via Record this set.
6. Select rep 7 or 8, toggle the illustrative overlay, or flag feedback.
7. Return to the workout and finish. Confirm saving, then inspect **Your sessions** in Progress.

Use Train to create/edit/duplicate/delete routines, rearrange exercises, search the library, and create custom exercises. Custom exercises support logging only. Profile controls units and illustrative privacy preferences. **Personalize training** opens the skippable five-step onboarding. **First-time experience** hides seeded history without hiding sessions you logged yourself.

**Connected devices:** open Profile → Connected devices, select Fitbit, WHOOP, Garmin, Apple Health, or Health Connect, choose permitted categories, then import the demo. Today and Progress show the selected readings with their source. Use source preferences to resolve overlap, and try refresh, permission changes, failure states and disconnect. This imports fictional examples only; no real wearable account is connected. See DEVICES.md for the behavior and researched future integration routes.

Illustrated recording screens expose **Preview a state** for denied permission, incomplete framing, multiple people, obscured joints/poor lighting, unsupported movements, interrupted recording, upload/analysis failure, and unable-to-assess results. These controls do not affect the real analyzer.

## Major UX decisions

- Starting and continuing a session is the primary task. Active sessions remain one tap away. On a phone, a persistent workout dock keeps rest controls and finishing within reach.
- Completed sets, notes, routines, and preferences are kept locally. Reloading or changing screens preserves an active workout. A confirmation prevents accidentally finishing or replacing it.
- Manual logging is a complete path. Video is optional. Real experimental analysis supports selected bodyweight squat clips; the three original named movements retain illustrated feedback examples.
- Feedback explains what, where, and a possible next action. Visibility is explicit. There are no overall scores, safety guarantees, diagnoses, or invented research citations.
- Desktop uses a side rail and contextual panels; phones use bottom navigation and a single task column. Native dialogs, labels, focus rings, reduced motion, and large controls support keyboard and touch use.

## What is mocked

- Alex Lee, seeded October 2026 sessions, previous values, and sample routines are demonstration data.
- On **View illustrated example**, camera permission, framing checks, countdown capture, analysis waits, observations, confidence, and rep markers are simulated. The real squat test is a separate screen with actual pose inference and experimental measurement logic.
- User-selected videos use temporary object URLs. They are not uploaded or stored, and are released when the recording screen closes. Illustrated example findings never describe the selected video.
- Recording comparisons use explicitly labeled illustrations. Tempo remains unassessed. Limited data does not produce improvement claims.
- Notification, cloud, retention, contribution, and deletion controls demonstrate future preferences. They save locally but have no service behind them. Contribution is separate and off by default.
- Feedback flags are local to the current preview and are not sent. Sample feedback links identify the demonstrated exercise. Only one sample feedback reference per locally logged session is retained.
- No accounts, security service, payment service, validated production coaching, model training, or backend exists. Local logging works after the app loads; this is not an installable offline PWA.

## Next milestones

1. Usability testing with beginner/intermediate lifters; screen-reader testing and real-device camera ergonomics.
2. A validated movement/variation support contract with observable evidence, uncertainty thresholds, and evaluation fixtures.
3. Real camera capture and upload lifecycle with explicit consent, clear retention/deletion behavior, and robust error recovery.
4. Account/storage architecture and offline synchronization, followed by secure backend integration.
5. Carefully evaluated, exercise-specific analysis and longitudinal coaching quality testing.

See DESIGN.md for the product/screen contract, AI-TEST.md for the experimental analyzer, and QA.md for checks and limitations. This deliverable is a test version, not a validated coaching product.
