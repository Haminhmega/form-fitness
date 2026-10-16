# Dataset eligibility review

Reviewed: 2026-10-16. Status: **BLOCKED AT STEP 1 — no dataset evaluation performed.**

The user explicitly requires stopping for unresolved license, access or label-mapping questions. Only this note and `.gitignore` have been changed across the eligibility reviews. No video was fetched, stored, uploaded or committed for this task. No app behavior, thresholds, observation IDs or network behavior were changed.

## User-supplied candidate: Zenodo Squat Dataset, record 17558630

### Permission and access

Attribution: Christopher Teng (2025), *Squat Dataset*, Zenodo, [doi:10.5281/zenodo.17558630](https://doi.org/10.5281/zenodo.17558630). The [record API](https://zenodo.org/api/records/17558630) identifies open access and **CC BY 4.0**. The [actual license](https://creativecommons.org/licenses/by/4.0/legalcode.en), Sections 2–3, permits reuse and adaptation, including commercial use, with attribution and the applicable notices/change disclosures. It does not grant all third-party privacy/personality rights. No non-commercial restriction was found in the record; there is no separate license file in the archive listing.

The API and official archive range endpoint were accessible without authentication. The ordinary web reader failed, so metadata was read directly from the public API. No access controls were bypassed.

### Archive inspection — metadata only, no inference

The record advertises `Dataset.zip`: 824,064,094 bytes; publisher-provided MD5 `cebeb32ac04dab34d4abe9686a9fc5d3`. This checksum was **not independently verified**, because the full archive was not downloaded. Two HTTP range requests read its ZIP footer and central directory into memory. The directory is 380,475 bytes and lists 3,814 entries: eight directories and **3,806 JPG images**, with no other file types. No image entries were extracted, displayed or analyzed; no archive was saved.

| Folder label (original spelling) | Supplied train images | Supplied test images |
| --- | ---: | ---: |
| Bad Back / Bad back | 984 | 338 |
| Bad Heel / Bad heel | 852 | 321 |
| Good | 1,001 | 310 |
| Total | 2,837 | 969 |

These are file counts, not counts of independent people or squat repetitions. Paths use a class name plus an integer, for example `test/Bad Back/Bad Back (1).jpg`. No subject/recording manifest, timestamp file, annotation guide or provenance document is listed. Embedded JPEG metadata has not been inspected. The record describes square side-view images; actual dimensions and any original image reshaping remain unverified.

### Label mapping and protocol compatibility

The three names above are dataset labels, not proposed app verdicts. The record describes the back category as “spinal misalignment” and the heel category as “improper foot positioning,” but supplies no operational annotation criteria, measurement cutoffs, annotator agreement or ambiguity policy.

- **Back:** shoulder-to-hip inclination is measurable, but it is not a measurement of spinal curvature and cannot be assumed equivalent to this label. No accepted mapping.
- **Heel:** visible heel/forefoot geometry might support an image study, but the supplied description does not establish whether the category means heel elevation, rotation or another position. Do not substitute an invented heel-rise definition.
- **Reference category:** this is a dataset class, not proof that every candidate measurement lacks a deviation. No general form verdict follows from it.
- No explicit depth label is supplied. Still images cannot establish movement phases, rep minima, range changes, tempo, tracking interruptions or complete squat cycles. Repeating one image or assigning artificial timestamps would not create that evidence.

The supplied train/test folder names do not establish person separation. Numeric file suffixes are not subject IDs. No reliable alternative grouping has been established, so the folders cannot currently serve as the requested held-out person-based evaluation. The collection origin is also unspecified in the record, so compliance with the earlier no-scraped-video requirement remains unverified.

**Decision: permission/access checks passed at the published-record level; measurement mapping and evaluation eligibility remain blocked.** No thresholds were tuned, no test predictions were made and no fault passed a release bar. This dataset might support an explicitly exploratory still-image landmark study, but that is a different scope from the requested video evaluation. Asked the user to choose that limited scope or continue seeking an eligible video dataset. Do not change production thresholds on the basis of this metadata review.

Verification for this follow-up: archive-entry counts and file types inspected; existing dataset exclusions and documentation diff checked. App tests and build were not rerun for this documentation-only eligibility review. The model was not run and its digest was not reverified in this follow-up.

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
