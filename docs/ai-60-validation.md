# 60-exercise motion-check validation

This is an editorial selection of familiar gym exercises, not a measured usage ranking. The 60 exact catalog IDs override older generic profiles where present. They share 18 movement-family rule sets; they are not 60 independently trained models.

## Current evidence

- 540 deterministic synthetic scenarios passed (9 per exercise): complete cycles, reversed starting phases, stationary poses, multiple people, absent people, occluded hips, time gaps, repeated timestamps, and non-finite landmarks.
- Existing squat, generic, dedicated movement, and workout regression suites passed.
- Browser smoke checks cover library filtering, direct video-check entry, workout instructions, switching exercises, and preservation of logged sets.
- No real-video accuracy study has been performed. All 60 remain beta. Synthetic fixtures test rule behavior after pose extraction, not the accuracy of MediaPipe or performance across users, devices, clothing, equipment, or camera conditions.
- Metrics are visible repetition counts, projected joint range, phase timing, and within-set comparisons. Grip, load, equipment, exercise identity, safety, and technique quality are not established.

## Before claiming real-world verification

Collect consented clips per exercise across multiple people, body proportions, camera devices and supported views, including incomplete repetitions, occlusion and wrong movements. Keep evaluation participants separate from tuning participants. Obtain independent human annotations of rep boundaries and visible movement observations; resolve disagreements. Report per-exercise count error, boundary timing error, tracking coverage and abstention rates, including failure groups and sample sizes. Have a qualified reviewer assess any proposed coaching claims separately. Predefine acceptance thresholds before evaluating a held-out set. Never infer technique validation from a low rep-count error alone.

## Selected catalog entries

| Exercise | Tracking family | Real-video evidence |
| --- | --- | --- |
| Barbell Squat | squat | Pending |
| Barbell front squat | squat | Pending |
| Barbell back squat | squat | Pending |
| Goblet Squat | squat | Pending |
| Dumbbell Goblet Squat | squat | Pending |
| Dumbbell squat | squat | Pending |
| Dumbbell sumo squat | squat | Pending |
| Smith machine back squat | squat | Pending |
| Dumbbell reverse lunge | lunge | Pending |
| Split Squat with Dumbbells | lunge | Pending |
| Barbell Deadlift | hinge | Pending |
| Romanian Deadlift | hinge | Pending |
| Romanian Deadlift with Kettlebell | hinge | Pending |
| Romanian Deadlift With Dumbbells | hinge | Pending |
| Glute bridge | bridge | Pending |
| Single-leg glute bridge | bridge | Pending |
| Close-grip bench press | bench | Pending |
| Barbell Bench Press - Medium Grip | bench | Pending |
| Decline barbell bench press | bench | Pending |
| Barbell Incline Bench Press Medium-Grip | bench | Pending |
| Smith machine bench press | bench | Pending |
| Dumbbell Bench Press | bench | Pending |
| Incline dumbbell bench press | bench | Pending |
| Neutral-grip dumbbell bench press | bench | Pending |
| Pushups | pushup | Pending |
| Decline Push-Up | pushup | Pending |
| Bent Over Barbell Row | row | Pending |
| One-Arm Dumbbell Row | row | Pending |
| Incline dumbbell row | row | Pending |
| Dumbbell bent-over row | row | Pending |
| Machine seated row | seatedRow | Pending |
| Seated Cable Rows | seatedRow | Pending |
| Lat pull-down | pulldown | Pending |
| Reverse-grip lat pull-down | pulldown | Pending |
| Barbell Curl | curl | Pending |
| Close-grip EZ-bar curl | curl | Pending |
| Preacher Curl | curl | Pending |
| Hammer Curls | curl | Pending |
| Concentration curl | curl | Pending |
| Dumbbell Bicep Curl | curl | Pending |
| Standing Biceps Cable Curl | curl | Pending |
| EZ-Bar Curl | curl | Pending |
| Military press | press | Pending |
| Seated barbell shoulder press | press | Pending |
| Standing dumbbell shoulder press | press | Pending |
| Seated dumbbell shoulder press | press | Pending |
| Machine shoulder press | press | Pending |
| Side Lateral Raise | lateralRaise | Pending |
| Seated Side Lateral Raise | lateralRaise | Pending |
| Dumbbell front raise | frontRaise | Pending |
| Cable V-bar push-down | pushdown | Pending |
| Reverse Grip Triceps Pushdown | pushdown | Pending |
| Triceps Pushdown | pushdown | Pending |
| Seated triceps press | overheadExtension | Pending |
| Standing Dumbbell Triceps Extension | overheadExtension | Pending |
| Cable overhead triceps extension | overheadExtension | Pending |
| Dumbbell skullcrusher | skullcrusher | Pending |
| EZ-Bar Skullcrusher | skullcrusher | Pending |
| Lying Leg Curls | legCurl | Pending |
| Leg Extensions | legExtension | Pending |
