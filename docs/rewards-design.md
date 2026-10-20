# Goal rewards design contract

Status: implementation contract, October 20, 2026.

## User job and primary action

Help a person see progress toward their own weekly training goal, compare months, and spend workout-earned credits on optional rewards. Starting or resuming today's workout remains the primary action on Today. Rewards live in a dedicated Rewards & shop section of Progress, with a compact entry beside today's workout. Training history remains the default Progress section after completing a session.

## Hierarchy and visual direction

Use Form's existing paired theme colors, typography and controls. Show weekly goal progress, monthly points and comparison first, then the credit balance and a two-item shop. Base points and boost points remain visibly separate. Use simple flask and snowflake symbols rather than unrelated decoration. Explain item prices and effects before a purchase. Rest days do not require daily check-ins.

## Calendar and accounting

- A completed goal week is worth 100 base points, divided across distinct earning days up to the selected weekly target. A five-day goal gives 20 points and 10 credits per earning day.
- Goal changes take effect in a later week; existing awards do not recalculate when preferences or history change. Rewards begin on enrollment, without a retroactive payout for imported history.
- Credits are spendable and never subtract from the monthly score. Boost bonuses remain separate from base goal progress. Shop actions require an authenticated, synced account.
- Weekly streaks follow goal completion rather than consecutive gym days. Freezes preserve continuity without adding attendance or points.
- The server owns the reward record independently of the editable account document. Duplicate sync, date, session and purchase requests cannot create repeated awards or charges.
- Ad rewards are unavailable in this release. No ad SDK, tracking or simulated ad completion is added.

The final calendar, eligibility, grace-period and retention rules are documented in `rewards.md` after implementation review.

## Required states and accessibility

Test signed-out, loading, newly enrolled/empty, synced, unsynced/offline, failed request/retry, unaffordable items, owned items, confirmed purchase and account switching. Never present a pending reward as a confirmed credit balance. The shop must remain usable with a keyboard, visible focus and readable labels; use at least 44-pixel controls and respect reduced motion.

## Rendered verification

Inspect 375-pixel and 390 × 844 phone layouts and 1440 × 900 desktop layout. No horizontal overflow. Screenshots and the accessibility/state report are local evidence outside the repository. Browser fixtures use isolated test accounts; they do not alter production accounts or represent real workout participation.
