# Form — product design brief

## Priorities and assumptions
Help independent beginner and intermediate lifters start, log, and finish a workout with low attention and one-handed use. Recording is optional. The first screen is the usable product, with a returning-user sample and a switchable first-time experience. This phase uses local non-sensitive demonstration data and simulated coaching. No production backend or medical claims.

## Navigation and inventory
Today: next routine, weekly consistency, last useful observation. Train: routines, editor, searchable exercise library, details, custom exercise creation. Progress: history, session detail, exercise-specific trends, defined records, comparison. Profile: preferences and privacy. Task screens: short skippable onboarding, active workout, recording setup, countdown, recording, review, pending analysis, results and unable-to-assess result. An active session remains reachable from every destination.

## Main flows
Today → start routine → complete a set → record/upload → setup → sample review → simulated analysis → inspect highlighted rep → return → finish → history. Secondary flows cover routine creation and editing, exercise discovery, custom logging-only exercises, onboarding and privacy preferences. Navigation preserves active sets; completion is deliberate; routine mistakes offer undo.

## Design system
Restrained athletic tool, not a marketing page. A compact slanted Form mark, editorial heading rhythm, precise ruled lists and a lime training illustration establish identity. Background #131512; panel #1d201b; raised #252922; primary text #f2f3ec; secondary #a6aea0; accent #c6f36b; dark accent text #18210e. Amber is reserved for incomplete visibility and red for failures. System sans typography avoids network font dependencies; headings use tight tracking and weight 600–750. Spacing uses 4/8/12/16/24/32/48 pixels. Corners 8/12/20/28 pixels. Subtle borders separate surfaces; shadows only help floating controls. Inputs and buttons have 44px minimum hit areas. Focus rings use lime with offset. Reduced-motion preference disables transitions and nonessential animation.

## Evidence contract
Reference: the supplied brief's gym context, four-destination architecture, sample-data honesty and active-workout priority. The primary action must be visible early at 375×812 and 1440×900. Tablet is checked at 768×1024. No horizontal overflow; visible text and controls must fit. Mobile uses bottom navigation and a single column; desktop uses a fixed side rail and contextual columns. Recording results separate sample observations from general suggestions, explain uncertainty, and never assign an overall form score. Every control must act or state a specific prototype limitation.

## Content states
Loading: simulated analysis progress, continue workout. Empty: no search results and first-time history, with next action. Error: recording/upload/analysis failure, retry. Partial: insufficient history and occluded body, explain missing evidence. Success: completed set with undo, saved routine, completed workout in history. Permission: denied camera simulation with sample/return alternative. Offline: local logging continues after the app loads; no offline installation promise.

## Phase boundary
Prototype MVP: routines, library, manual logging, timer, local persistence, guided recording demonstration, simulated feedback, history and settings. Future: validated exercise-specific video pipelines, real camera device QA, secure account and storage architecture, explicit cloud consent and deletion lifecycle, reliable offline synchronization, accessibility evaluation with assistive technology, and longitudinal evaluation of coaching quality. Payments and model training are outside this phase.

## Connected-device extension
The user selected a clickable prototype with sample imports. Add a Profile subpage for device connections while preserving the four primary destinations. Keep Today’s start/resume action ahead of device context. Represent five provider/platform routes with explicit sample permission and sync flows, source preferences, freshness, unavailable fields, retry, reconnect, disconnect and local sample deletion. Show imported activity separately in Progress so duplicated device workouts do not inflate lifting statistics. Target viewports remain 375×812, 768×1024 and 1440×900. No arbitrary readiness metric or automatic workout adjustment is inferred from the samples. Future service requirements and primary sources are recorded in DEVICES.md.

## Local AI test extension
The user requested a working test of the proposed squat-video analysis. Check my form and the squat recording entry now open real local inference by default. View illustrated example explicitly separates the previous demonstration. The served app accepts a 2–60 second local clip, obtains confirmation of standard bodyweight squats from a steady side view, then processes frames with a bundled pose model in a worker. No video is uploaded or persisted. AI-TEST.md defines model, rule and validation limits.

Primary action: choose a clip. On 375px screens it appears before the camera illustration, within the initial viewport. At 768/1440px, the video/guide sits beside controls or results. Replay, actual tracked-joint overlay and timestamped evidence lead the results; an incomplete assessment includes its reason. The usable-frame percentage is a visibility measure, never a technique score. Rep counts do not alter manual workout logs or wearable imports.

State contract: initial guide and supported-input limits; real model/frame progress with cancellation; actionable file/codec/model errors; partial measurements with omitted-opening/tracking explanations; measured cycles and replay markers; unable-to-assess when no qualifying cycle is available. File selection is explicit and no camera permission is requested. Phase announcements avoid announcing every processed frame. Leaving cancels analysis and releases the clip and results. Screen-reader and physical-phone evaluations remain outside the automated browser checks.
