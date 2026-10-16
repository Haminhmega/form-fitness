# Familiar workouts and movement demonstrations

## Design contract

- Purpose: help a person recognize the exercises in their recommended plan and understand the setup and movement before a set.
- Audience: people training at home or in a gym, including people starting out. The phone view is the primary view.
- Selection: prefer familiar staples within the same training role, after equipment, experience and movement exclusions. Personal preferences and athletic goals remain meaningful. Keep complementary roles, weekly recovery, set budgets and session timing.
- Hierarchy: exact exercise name and viewing direction; large uncluttered figure with recognizable equipment; two named movement positions; manual position slider and optional playback; three concise cues.
- Visual direction: neutral, jointed sports mannequin, light limbs against a quiet dark stage, theme accent for movement and equipment details. No facial features or simulated skin shading. Equipment and contact points distinguish movements.
- Interaction: paused by default; keyboard-operable controls; at least 44px control height; visible focus; reduced-motion users can inspect static positions; pause off-screen or when the tab is hidden.
- Viewports: 390 × 844 and 1440 × 900, plus a 375px overflow check.
- States: supported demonstrations show their exact named variation; unsupported/custom movements retain written instructions and explicitly state that a matching demonstration is unavailable. No network or loading state is introduced.
- Acceptance: common recommended movements receive dedicated demonstrations; a bench press cannot show an overhead press; cable/barbell/dumbbell references must match the selected equipment; planted contact points stay fixed during playback.

## Selection evidence and limits

The familiar-exercise preference is editorial, not a measured popularity statistic. It builds on the library's existing gym-staples list, with explicit mappings for reviewed planner variants. Popularity does not establish superior results. The [ACSM 2026 resistance training guidance](https://acsm.org/resistance-training-guidelines-update-2026/) supports adapting exercise and equipment choices to the person and consistency of participation. This change does not alter the training-dose or recovery model.

Illustrations are schematic movement references, not individualized joint-angle targets or a validation of the video analyzer. Machine geometry varies; the illustration states the representative setup.
