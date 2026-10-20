# Training rewards

Rewards follow each person's saved weekly frequency. They are a record of self-reported activity, not a measure of physical performance or independently verified gym attendance. Points and credits have no cash value. There is no public leaderboard, purchase with money, or advertising integration.

## Earning rules

- Enroll automatically after opening Form with a completed, synced account profile. Rewards are account-only; the local demo shows a sign-in entry. Existing history at enrollment does not earn a retroactive payout.
- Monday–Sunday weeks use the browser's IANA time zone at enrollment. That reward time zone stays fixed. Award dates derive from the completion timestamp in that zone, including when the phone travels; editing a history date does not move points.
- The goal is the number of distinct selected weekdays. Empty legacy preferences use three days. A goal change saved during a week applies to the next week, without recalculating previous awards.
- Each week offers **100 base points** spread over the goal's earning days: a five-day goal gives 20 points/day. Non-divisible totals use integer cumulative rounding so the goal still totals exactly 100.
- Each earning day also gives **10 credits**. Only one session per calendar date earns rewards, and only up to the weekly target. More sets, weight, duration or extra sessions do not multiply the reward.
- Qualifying sessions have at least one actual completed set with positive reps/seconds, or at least five logged minutes of recovery. Samples and empty workouts are excluded.
- The server processes a saved session ID once. Editing, deleting, undoing deletion or resubmitting it does not earn again. Confirmed points and credits remain recorded when the workout is later removed.

New completed workouts must sync within seven calendar days and have a valid timestamp after enrollment and no later than server time. Sessions already present before enrollment, including offline sessions first imported at enrollment, are excluded. A workout completed before buying a boost cannot consume it, even if it syncs afterward.

## Weekly streaks and the shop

A streak counts weeks in which the weekly goal was met, not consecutive exercise days. Scheduled rest days do not break it. A finished week remains open for seven additional days for offline syncing. The displayed streak is provisional while a preceding week awaits that sync window. After the window closes, an unmet week resets the streak unless an available freeze preserves it.

| Item | Price | Effect |
| --- | --- | --- |
| Streak freeze | 60 credits | Automatically preserves an existing streak through one missed week; does not add a streak week, workout attendance or points. Store at most two. |
| Point boost | 30 credits | Adds 50% of the next earning day's base points as a separate bonus, rounded down to whole points. One use, with at most one active boost. No bonus credits or attendance. |

An incomplete introductory week, when enrollment was after Monday, does not consume a freeze. A freeze is used only to preserve an existing streak. The shop asks for confirmation and requires a synced, online account. Credits are deducted independently of the monthly points total. Rewards from ads are explicitly unavailable until a provider and verified completion flow are implemented.

## Month comparisons

Progress → Rewards & shop shows calendar-month points, base versus bonus, earning days and credits earned. The current month compares with the same elapsed calendar days of the previous month, clamped naturally to the shorter month's length. The previous complete month's total is also shown. Closed months compare complete-month totals. Months with no awards remain selectable after enrollment.

The UI identifies first/partial tracking months rather than claiming improvement over an untracked zero. Different numbers of available weeks/days, goal changes and boosts affect totals; this is a personal activity comparison rather than an exercise outcome assessment.

## Storage, integrity and privacy

`form_rewards` is a separate D1 record per authenticated account, with its own revision. The strict account document contains no client-editable wallet. Reward requests read the saved account document; account saves also reconcile an existing wallet. The existing identity, origin, owner-header and rate-limit checks protect the endpoint. JSON inputs are bounded. Conditional writes check both wallet and active account revisions; simultaneous purchases retry against the latest balance. Account deletion removes the reward record, and deletion races cannot recreate it from a stale write.

The ledger retains award dates, anonymous-within-account session IDs, points/credits, weekly goal snapshots, inventory and purchase IDs. The server deduplicates sessions, calendar dates and purchase request UUIDs. A browser keeps only an account-scoped pending purchase ID for uncertain retries, not an authoritative balance. A lost response can be retried with the same ID. Definite business-rule failures do not lock the shop into a pending purchase. Balances are shown as last confirmed while offline; pending workouts do not become spendable until synced.

Records persist until account deletion. The ledger is bounded at 6,000 weekly snapshots and 100,000 awards, observed session IDs and purchases; limits reject further changes rather than dropping deduplication history. This beta design reads one bounded JSON ledger and is intended for modest per-user activity volume; a relational event ledger would be appropriate before substantially higher-volume use.

No advertising SDK, third-party tracking, video upload or change to on-device movement analysis was added. Participation is self-reported: server accounting prevents duplicate awards and wallet edits, but does not prove that a person performed a logged workout.

## Validation

`npm run test:rewards` checks deterministic calendar/accounting rules and the actual Worker against in-memory SQLite. `npm run test:rewards-ui` exercises the actual App, account provider, reward controls and Worker with isolated fixture identities and synthetic history. It covers completed-workout sync, repeated finishing, daily limits, delete/undo, comparisons, purchases and retry after a committed response is lost, offline/error states, account isolation, guest entry, mobile/desktop layout and accessibility. These tests do not modify production accounts or claim physical iPhone testing.
