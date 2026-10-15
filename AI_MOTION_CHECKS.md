# AI motion checks

Form currently registers **170 beta analyzers**. The registry combines 100 explicitly selected common catalog exercises across 31 movement/setup families, 95 older rating-selected catalog profiles, and 10 built-in exercise analyzers. These lists overlap; their counts must not be added together. They share pose extraction and joint-cycle rules, rather than using a separately trained model for every exercise.

All checks, including the dedicated bodyweight squat analyzer, are beta. The evidence currently consists of synthetic landmark tests. No held-out real-video accuracy study or physical-iPhone validation establishes real-world verification. See [the 100-exercise expansion and evidence](docs/ai-100-expansion.md).

`node scripts/generate-priority-ai.mjs` regenerates the editorial shortlist from exact catalog IDs. `npm run generate:ai-profiles` regenerates the older 95 catalog profiles using dataset ratings; ratings are not measured exercise usage. Explicit priority profiles override these generic entries. Leg curls use the knee angle, not the hip angle. Calf raises use a dedicated ankle metric and additional visible-foot and knee-setup gates.

Users select and confirm the exercise before analysis. The checks measure visible joint-angle cycles, phase timing, within-set range comparisons and tracking coverage. Selected movement families also require a compatible torso orientation, camera view, hand position or knee setup. They withhold results for missing or low-confidence landmarks, multiple people, invalid dimensions or timestamps, tracking gaps, incomplete cycles and insufficient visible motion.

These checks do not recognize exercise identity, grip, equipment or load. They do not diagnose injury, predict injury risk, grade safety or technique, measure internal joint force, or estimate muscle activation. Camera projection, clothing, equipment, shoes, occlusion and pose-model error can change every result. Family-specific setup gates cannot prove that the selected exercise was performed.
