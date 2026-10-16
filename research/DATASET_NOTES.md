# Dataset eligibility review

Reviewed: 2026-10-16. Status: **BLOCKED AT STEP 1 — no dataset evaluation performed.**

The user explicitly requires stopping for unresolved license, access or label-mapping questions. Only this note and `.gitignore` were changed. No video was fetched, stored, uploaded or committed for this task. No app behavior, thresholds, observation IDs or network behavior were changed.

## Fitness-AQA / BackSquat

### Sources actually inspected

- [Author repository](https://github.com/ParitoshParmar/Fitness-AQA), observed revision `9a20d751e4a6c2bc5cc0861304f265b4430dadf0`.
- [Actual dataset license PDF at that revision](https://github.com/ParitoshParmar/Fitness-AQA/blob/9a20d751e4a6c2bc5cc0861304f265b4430dadf0/fitness_aqa_dataset_license.pdf). Read all of its single page using an in-memory PDF reader; the PDF was not added to the repository. SHA-256: `f275f2e7d025ba88fd092839736ad12b9c2e23477f28be52a200cfcb605cbfa8`.
- [Author access instructions](https://github.com/ParitoshParmar/Fitness-AQA#fitness-aqa-dataset-for-fine-grained-exercise-action-quality-assessment) and linked [request form](https://forms.gle/PbPTX1eVxGpa3QG88). The web reader could not render the form. No form was submitted and no terms were accepted on the user's behalf.
- [Author paper, arXiv 2202.14019](https://arxiv.org/pdf/2202.14019), especially Figure 2 and Sections 4 and 5.2. This is the dataset paper, not permission to use its underlying recordings.

### License and commercial use

The license PDF specifies **Creative Commons Attribution–NonCommercial 4.0 International**, with additional stated usage conditions. It restricts use to research/non-commercial purposes, disallows transferring the data to outside parties without author permission, excludes incorporating the dataset into a commercial software product, and assigns responsibility for subject privacy to users. The data is supplied without warranty.

**Commercial-use allowance: not granted by these terms.** Whether research intended to inform this deployed product qualifies as non-commercial has not been established. Keeping recordings out of the deployed bundle does not by itself settle that question. No broader permission was assumed.

### Access and provenance

The repository directs users to request access from the authors and says that requesting access accepts its terms. This environment has no verified author-approved dataset access or authorized data package. Public repository visibility is not equivalent to access to the recordings and annotation files.

Section 4 reports collection from Instagram and YouTube, trainer annotations, variable viewpoints and occlusions, and single-repetition processing. That origin conflicts with this task's prohibition on YouTube or other scraped video. No exception for an author-distributed dataset was assumed. No original video URLs, mirrors or alternate download paths were sought.

**Decision:** do not obtain or process Fitness-AQA under the current instructions. Access, intended-use permission and provenance would all need resolution before reconsideration.

### Labels and possible measurement mappings

The paper identifies three BackSquat labels: **KIE (knees inward error), KFE (knees forward error), and SS (shallow squat)**. These are published label names, not verified operational annotation definitions. The authorized annotation package, coding manual, polarity conventions and per-clip label files were not available. Exact thresholds and treatment of ambiguous examples therefore remain **unverified**, not reconstructed from the names.

| Published label | Relation to our measurements | Decision at the eligibility gate |
| --- | --- | --- |
| KIE | A side-view knee angle does not measure medial/lateral knee tracking. Our current 2D side-view inputs cannot establish this label. | Exclude from this side-view scope. |
| KFE | Knee-to-foot displacement could be measured only with visible ankle/toe landmarks and an appropriate view. Our knee angle is not that displacement. The annotation definition is unknown; forward travel must not automatically become a cue to restrict it. | No accepted mapping. Do not create a detector or recommendation from this label name. |
| SS | `SquatRep.minKneeAngle` and projected hip/knee height could be candidate quantities. Neither establishes the dataset's exact depth criterion; projection, proportions, missing extrema and rep-counter abstention must be accounted for. | Potential research candidate only; definition and eligible data must be verified first. |
| Forward trunk inclination | Shoulder-to-hip inclination is measurable. Figure 2 associates a torso-angle label with **BarbellRow**, not BackSquat. | No confirmed BackSquat ground-truth label; do not invent one. |

These mapping comments describe our implementation constraints and are not experimental findings. **Selected faults: none.**

### Person grouping and input assumptions

Subject identifiers, original-recording identifiers and an appropriate person-disjoint split have not been verified. No filename-based identity assumptions were made and no split was generated. Published results from other methods are not results for our pipeline.

Clip dimensions, frame rates, duration distributions, side-view eligibility and annotation coverage remain unknown without an eligible package. Single-repetition clips may not meet our within-set comparison requirements. Existing `unable`/`partial` outcomes must remain part of any eventual evaluation denominator.

### Production model reference

The current `public/ai/manifest.json` records Pose Landmarker Lite float16 version 1, `@mediapipe/tasks-vision` 0.10.35, and model SHA-256 `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a`. This was recorded from the manifest only; extraction and model-hash verification were not run at this blocked stage.

## Secondary candidates and unresolved instructions

EJUST-SQUAT-21 and the Waseda squat dataset have **not been approved or processed**. Their actual terms, acquisition origin, available labels and person identifiers would need an independent Step 1 review. No fallback was silently substituted after the stop condition.

The task also prohibits storing any video while requesting per-clip extraction. If an eligible dataset is found, clarify whether the prohibition includes temporary local decoding files. A future extractor must not assume permission to cache recordings; its design depends on this answer. This task has not fetched any recordings.

## Work status

- Completed: primary-source license/access/provenance review, documented label-mapping limits, and dataset/media exclusions in `.gitignore`.
- Blocked: exact annotation definitions and subject grouping, eligible data access, extraction, protocol registration, tuning, test evaluation, suggestions feature and related app/documentation revisions.
- No test split was run; no sensitivity, false-alarm rate, confidence interval, abstention rate or passing fault is claimed. No `RESULTS.md` or registered `PROTOCOL.md` was fabricated.
- `npm run test:ai`, `npm run test:accounts`, and `npm run build`: **NOT RUN for this task**, because the explicit Step 1 stop condition was reached and no application implementation was made. Prior runs are not evidence for this requested evaluation.
- Verification at this stage is limited to checking the ignore rules, the source diff and the commit. `research/` is outside the current TypeScript `include` paths and is not imported by client/server entrypoints; no research content is added to the app bundle.

Any eventual evaluation results must identify the public dataset, its permission basis and split method, and explicitly distinguish those results from users' phone recordings. No real-world performance claim is established by this review.
