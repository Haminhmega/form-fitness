# AI motion checks

Form has one movement-specific verified analyzer for bodyweight squats and 100 beta motion profiles. Five cover the app's built-in movements and 95 cover high-rated dynamic strength exercises in the CC0 Gym Exercise Dataset.

The dataset does not include usage counts. Its rating is used as a reproducible popularity proxy. `npm run generate:ai-profiles` regenerates 95 fixed catalog profiles after filtering to dynamic exercises whose main knee, hip, elbow, or shoulder angle can be observed by a phone camera. The other five profiles cover the default push-up, curl, Romanian deadlift, row, and shoulder press.

Beta checks require the user to select and confirm the exercise. They do not recognize which exercise is being performed. They measure complete visible joint-angle cycles, timing, range consistency, and tracking coverage. They abstain when the required joints are hidden, multiple people are present, timestamps are invalid, tracking is interrupted, or movement does not cross the adaptive cycle thresholds.

These checks do not estimate load, diagnose injury, predict injury risk, grade safety or technique, or measure internal joint forces. Camera projection, clothing, equipment, occlusion, and pose-model error can change every result.
