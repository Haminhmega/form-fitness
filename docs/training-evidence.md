# Training evidence and planner rules

Research checked **16 October 2026**. Scope: exercise split selection, training frequency, time budgets, experience, goals, and age context for Form's general fitness planner. This is a bounded review of official guidance and original systematic reviews, not a complete systematic review or clinical validation of the app.

**There is no universally best split.** The planner should choose an explainable starting arrangement that fits the person's goal, experience, actual selected weekdays, equipment, movement preferences, and available time. A deterministic schedule must not be described as clinically optimized, injury-proof, or guaranteed to produce a particular result.

## What the evidence supports

| Topic | Finding and limits | Source |
| --- | --- | --- |
| Full body versus split | A 2024 meta-analysis of 14 studies and 392 healthy adults found similar strength and muscle growth with the two arrangements when training volume was matched. It does not identify upper/lower or push/pull/legs as a universally superior split, and does not establish the best program for every age or medical condition. | [Ramos-Campo et al., 2024, J Strength Cond Res](https://pubmed.ncbi.nlm.nih.gov/38595233/) |
| Current adult resistance-training guidance | The 2026 ACSM position stand synthesized 137 reviews involving over 30,000 participants. Strength benefited from heavier loading, multiple sets, and at least two sessions weekly; muscle growth benefited from higher weekly volume. Equipment category and training to failure did not consistently determine results. These are population findings in healthy adults, not instructions to give every beginner heavy loads or maximum tests. | [Currier et al., 2026, Med Sci Sports Exerc](https://pubmed.ncbi.nlm.nih.gov/41843416/) |
| Practical entry point | ACSM's accompanying summary emphasizes gradual progression, training major muscle groups at least twice weekly, and choosing a routine that fits the person's circumstances. Bodyweight, elastic bands, and home training can be useful. Around ten weekly sets per muscle is a hypertrophy-oriented reference, not a mandatory starting dose or a precise optimum for everybody. | [ACSM official 2026 summary](https://www.acsm.org/wp-content/uploads/2026/03/Resistance-Training-Position-Stand-infographic.pdf) |
| Frequency and hypertrophy | A 2019 review of 25 studies found little meaningful hypertrophy difference between frequencies when volume was matched. More training days can distribute work; they do not automatically mean more growth. | [Schoenfeld et al., 2019, J Sports Sci](https://pubmed.ncbi.nlm.nih.gov/30558493/) |
| Frequency and strength: retain nuance | A 2018 meta-analysis found no significant frequency effect after matching volume. A newer 2026 dose-response review of 67 studies and 2,058 people suggests strength may benefit from increased frequency, with diminishing returns; hypertrophy frequency effects remained compatible with negligible effects. The latter sample was predominantly young and male. Do not claim that frequency never matters or extrapolate its modeled optimum to every user. | [Grgic et al., 2018, Sports Med](https://pubmed.ncbi.nlm.nih.gov/29470825/), [Pelland et al., 2026, Sports Med](https://pubmed.ncbi.nlm.nih.gov/41343037/) |
| Adolescents | The AAP report, published in 2020 and reaffirmed November 2024, emphasizes qualified supervision, technique-led progression, and developmentally appropriate training. It describes resistance sessions on two or three nonconsecutive days. An app and its video analysis do not supply the supervision described in that evidence. | [AAP: Resistance Training for Children and Adolescents](https://publications.aap.org/pediatrics/article/145/6/e20201011/76942/Resistance-Training-for-Children-and-Adolescents) |
| Youth recovery and progression | NSCA's youth statement recommends two or three nonconsecutive sessions and explicitly discusses 48–72 hours between sessions. Its novice example starts with light loads and one or two sets of 10–15 repetitions. More frequent advanced youth training requires individual consideration of total load and recovery. These youth recommendations do not prove an exact universal recovery clock for adults. | [NSCA youth position statement, 2009, pp. S71–S72](https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf) |
| Older adults | NSCA recommends individualizing training to ability, experience, health, tolerance, and recovery. Its general guidance includes two or three nonconsecutive exposures per muscle weekly, gradual progression, and functional/balance work. Beginners or people with frailty can begin with less work, while high-functioning older adults can use free weights. Chronological age alone is not a capacity assessment. | [NSCA older-adult position statement, 2019, Table 1 and individualization section](https://www.nsca.com/contentassets/2a4112fb355a4a48853bbafbe070fb8e/resistance_training_for_older_adults__position.1.pdf) |
| Broader activity at 65+ | CDC recommends aerobic activity, at least two weekly muscle-strengthening days, and balance activities, adjusted to a person's abilities and conditions. A strength split alone is not a complete weekly physical-activity program. | [CDC older-adult activity overview, updated 4 December 2025](https://www.cdc.gov/physical-activity-basics/guidelines/older-adults.html) |
| All activity counts | WHO's 2020 guidelines cover children, adolescents, adults, older adults, and additional populations. Its current fact sheet explains that some activity is better than none, all physical activity counts, and age-specific recommendations are broader than resistance training. Short sessions should be described honestly as limited sessions, rather than dismissed as worthless. | [WHO 2020 guidelines](https://www.who.int/publications/i/item/9789240015128), [WHO physical activity fact sheet, 26 June 2024](https://www.who.int/news-room/fact-sheets/detail/physical-activity) |
| Athletic scheduling | A systematic review in well-trained populations found similar strength changes with volume-matched frequencies and discusses distributing work around sport commitments. It does not turn a generic gym plan into an individualized sport-performance program. | [Cuthbert et al., 2021, Sports Med](https://pmc.ncbi.nlm.nih.gov/articles/PMC8363540/) |

## Product rules inferred from this evidence

The following are **engineering choices for a conservative starting planner**, not schedules directly validated by those papers.

### Choose a candidate split, then check the actual week

Use weekdays rather than just the number of selected days. Preserve every selected day in the output; label a day as easy activity or recovery when a suitable resistance session cannot fit. Do not silently delete days or invent additional availability.

| Selected days | Candidate arrangements to evaluate |
| --- | --- |
| 1 | A concise full-body session. Explain the limited weekly exposure without claiming it is useless. |
| 2 | Full body on separated days; upper/lower or one strength day plus recovery if days are adjacent and overlap cannot be avoided. |
| 3 | Full body on separated days; a split or a mixed strength/recovery week when clustered. |
| 4 | Upper/lower is a useful candidate; full-body sessions plus recovery may be more suitable for a new trainee. |
| 5 | A mixed split with a focused or recovery day, conditional on experience, overlap, and total work. |
| 6 | Push/pull/legs repeated is a candidate for an appropriately experienced user, not an automatic entitlement to more weekly volume. Lower-volume or recovery alternatives remain valid. |
| 7 | Preserve seven planned days, including at least an explicitly easy/recovery day when necessary. Do not turn daily availability into seven hard lifting sessions. |

Evaluate goals through both exercise choice and dose. Glute development can prioritize suitable glute work while retaining other major muscle groups, regardless of gender. Strength can prioritize the relevant lifts and adequate set recovery. Hypertrophy can distribute useful weekly volume. Athleticism needs sport context and should remain labeled an athletic foundation unless sport-specific demands and skill/power coaching are actually addressed.

### Recovery scheduling is a model, not a measurement

- Form's **two-calendar-day minimum and three-day preference** between substantial work for the same muscle are conservative scheduling policies. The evidence above does not establish those thresholds as universally necessary or sufficient for adults.
- Check the recurring week, including Sunday-to-Monday overlap. Day-only schedules assume comparable session times; a two-calendar-day gap can be under 48 actual hours when time of day changes. UI copy should say approximate spacing, not guaranteed recovery.
- Check major secondary loading as well as exercise names: pressing can load triceps and front deltoids, pulling can load elbow flexors, and lower-body patterns can overlap at the glutes. Distinguish substantial loading from incidental stabilization. Do not count every stabilizer as a complete direct muscle set.
- If no feasible hard session remains, show a clear recovery/easy-activity entry on that selected day. Never disguise another demanding same-muscle workout as recovery.
- Actual readiness depends on the completed workload, effort, sleep, symptoms, and other sport/activity. A planned gap cannot establish readiness from age or calendar data alone.

### Personalization without unsupported assumptions

- **Beginners/returners:** prioritize simple repeatable movements and manageable work. Practice quality and gradual progression matter; more repetitions are not automatically safer or better. Let the user extend rest.
- **Ages 13–17:** use a supervised, technique-first starting approach consistent with youth guidance. If more days are selected, include age-appropriate easy activity/recovery entries rather than silently shortening the selected week. Do not claim a blanket age-based ban on frequent training; advanced youth programming needs qualified individual guidance.
- **Ages 65+:** add relevant strength/balance context, but do not downgrade an experienced person's capability or impose a maximum training-day count solely because of age. Function, training history, constraints, and tolerance matter.
- **Age not provided:** do not invent an age. Keep general conservative defaults and explain that age-specific context is unavailable.
- **Time:** treat 10–120 minutes as a session target with an upper bound. Aim near the target with useful strength work; expose significant per-day gaps rather than silently returning a much shorter plan. Include warm-up, both sides of unilateral work, set recovery, and transitions. Prefer removing a lower-priority exercise or set over silently shortening necessary rest. A short constrained session must expose missing weekly coverage; a longer budget need not become excessive volume.
- **Style/equipment:** treat selected styles as preferences within actual equipment constraints. Choosing bodyweight alone excludes external weights; mixed preferences allow compatible alternatives. A machine/free-weight choice is not evidence of better results by itself.
- **Progression:** begin below failure, monitor repeatable technique and logged performance, and explain why a target changes. Do not estimate clinical readiness, injury risk, or an exact percentage of maximum from age, body measurements, or the unvalidated movement model.

## Validation implications

Test weekdays as a seven-day cycle, substantial muscle overlap, every selected-day count, clustered availability, all duration endpoints, mixed styles, age omitted/13/17/18/65+, excluded movements, and unavailable equipment. Check that review, installed routines, warm-ups, and actual workout targets agree. An age-only change must not erase selected days or automatically classify an experienced older person as a beginner.

Programmatic consistency tests are not evidence of physiological effectiveness. Before describing the planner as validated coaching, review representative plans with qualified professionals and evaluate actual user outcomes, adherence, and reported problems. Revisit the evidence when updating prescription rules; the 2026 frequency findings already illustrate why older summaries should not be treated as permanent absolutes.


## Duration and session-structure update (16 October 2026)

Additional sources reviewed:

- [Iversen et al., 2021, *No Time to Lift?*](https://pmc.ncbi.nlm.nih.gov/articles/PMC8449772/): prioritize useful multi-joint work when time is limited; weekly work matters more than an arbitrary session-duration threshold. This narrative review does not validate Form's specific minute bands.
- [Schoenfeld et al., 2016 randomized trial](https://pubmed.ncbi.nlm.nih.gov/26605807/): in 21 trained young men, three-minute rests outperformed one-minute rests on some strength and hypertrophy outcomes over eight weeks. This supports allowing adequate rest, not claiming three minutes is uniquely optimal for everybody.
- [NSCA: determining training frequency](https://www.nsca.com/education/articles/kinetic-select/determination-of-resistance-training-frequency/): novice full-body training commonly uses two or three separated sessions; experienced users may distribute work across splits. Daily availability is not a requirement for daily hard lifting.
- [NSCA older-adult position statement](https://www.nsca.com/about-us/position-statements/resistance-training-for-older-adults/): individualize around training history and capacity; age alone should not set an experienced user's exercise dose.

### Product duration bands — implementation choices, not scientific cutoffs

| Available time | Starting structure | Time-pressure rule |
| --- | --- | --- |
| 10–20 min | Brief main-movement practice, usually 1–3 exercises | Keep recovery and explain limited coverage; no claim that this is useless. |
| 25–40 min | Main lifts first, generally 2–4 complementary movements | Reduce sets/accessories before rushing rest. |
| 45–60 min | Main lifts and assistance, typically 4–6 exercises where equipment permits | Available time budget; shorter than the general intake suggestion, not inherently ineffective. |
| 65–90 min | Fuller strength sessions with progressive warm-up sets and complementary roles | Usually 5–8 movements depending on split; respect weekly workload ceilings. |
| 95–120 min | Longer preparation or work where justified by the program | Never override dose/recovery bounds simply to fill two hours. Expose remaining time. |

The UI suggests 60–90 minutes (quick choices: 60, 75, 90) and at least three training days per week. These are adjustable product suggestions, not evidence-based minimums or validated optima. New profiles start at 60 minutes and three days; existing saved availability is preserved. Shorter sessions and one- or two-day weeks remain available. Beginner/youth guidance emphasizes manageable work and full rests, and existing workload limits still apply. The combined muscle/strength/physique goal uses progressive muscle-building prescriptions; historical strength-specific prescriptions remain readable. No cardio is added to fill gaps.

### Session structure and dose accounting

The calendar allocator still checks substantial overlap and Sunday-to-Monday recovery. Within a day, role templates distinguish horizontal/incline pressing, overhead pressing, lateral raises and triceps; rows, vertical pulls, rear-deltoid assistance and elbow flexors; squats, hinges, knee flexion/extension, hip work and calves. Equivalent alternatives cannot occupy two slots. Main compound lifts precede assistance. Useful lifts stay stable rather than changing equipment solely because they appeared earlier that week.

The planner reserves weekly cluster, role and muscle budgets before selecting work. A full gym, experienced six-day muscle-building example at a 75-minute target has 5–6 exercises, 17–19 sets and estimated sessions of 61–68 minutes. This is a test fixture, not a prescription for every user. Novice two-set starts remain shorter, and the UI explicitly recommends reviewing the frequency/time combination. It does not conceal a 30-minute beginner split behind a 75-minute label.

Approximate muscle accounting assigns full credit to principal muscles and half credit to selected supporting muscles. The default weekly ceiling is 12 credits for beginners and 18 for others, with a small explicit focus allowance and reduced one-day ceilings. Role and cluster ceilings also apply. These are engineering guardrails, **not validated individual stimulus estimates or weekly targets**. A ceiling is not a requirement to reach it. Equipment, exclusions, time and recovery can reduce delivered work.

Time uses the actual displayed warm-up sequence, including progressive rehearsal sets for the first two eligible loaded compound targets, working-set duration, both sides of unilateral work, prescribed rest, and equipment setup. Estimates assume about three seconds per repetition and overlapping setup/rest where appropriate; they do not predict gym queues or the user's exact tempo. Warm-up seconds are shared by the estimator and the in-workout timer. A significant gap means at least 10 minutes and at least 20% of the target, and is shown for each affected resistance day.

### Regression observations

`test-training-duration.mjs` covers all 23 slider values (10–120 by 5), seven goal variants, three experience levels, and one through seven selected days: 3,381 plans. Separate coaching tests cover 700 equipment/exclusion/time cases and 508 cyclic schedules. Assertions cover time upper bounds, role uniqueness, exercise order, weekly dose ceilings, per-day gap explanations, and a substantive six-day 75-minute example. These are software consistency checks, not evidence of physiological efficacy.
