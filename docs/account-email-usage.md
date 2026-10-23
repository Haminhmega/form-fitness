# Account email and beta usage reports

## Runtime configuration

Server-only variables: `RESEND_API_KEY` (sending access, restricted to formfitness.fit), `EMAIL_FROM` (`Form <noreply@formfitness.fit>`), `AUTH_CODE_SECRET` (independent random secret, at least 32 characters), and `ANALYTICS_ADMIN_EMAIL` (the owner's verified login email). Never place keys in client bundles, git, request logs or browser storage. Apply additive migration 0004 before the Worker. Changing the code secret invalidates pending codes. Configure mail before release; registrations fail closed when it is unavailable, while existing password login continues.

Resend domain verification uses the exact DNS records shown in its dashboard. Website routing and existing inbound email records remain unchanged. A sending identity does not create an inbox. Resend receives recipients and code email content. Its current account limits apply; the app limits requests to 90 per UTC day to leave headroom under a 100/day provider allowance. Invalid/nonexistent reset requests can consume that allowance. This conservative beta limit is not a high-volume delivery design.

## Confirmation and recovery

Registration and reset use purpose-bound six-digit codes with ten-minute expiry, five attempts and atomic one-time consumption. Only HMAC hashes are stored, using a server secret separate from the database. Body size, IP, email and global fixed-window limits apply. Resend idempotency keys protect provider retries. Failed delivery invalidates the challenge. Unknown reset addresses receive the same response as known addresses; no email is sent for unknown accounts.

New registration requires verification. Existing password accounts are not silently locked out; password reset or email change verifies them. Password resets increment a credential version and revoke all Form sessions. Session creation checks the verified password hash to prevent a concurrent reset from creating a session with an obsolete password.

Profile → Email & password changes the login email only after checking the current password and a code sent to the new address. It preserves the same user ID and training records, increments the credential version and signs out Form sessions. It does not change a linked provider's email or unlink Google. Users without a Form password first confirm their existing provider email and create a Form password; Google users must also have signed in within five minutes. Accounts with an already-used email are not automatically merged. Google/ChatGPT provider sessions themselves are managed by those providers.

Codes and passwords stay in component memory while editing, never local/session storage. UI completion clears them. No automatic marketing subscriptions, email tracking pixels or video uploads are added.

## Beta usage reporting

On by default for signed-in beta accounts as of the October 23, 2026 beta-reporting release, at the owner’s request based on their stated beta participation consent. No settings click is required. A missing preference row means the beta default; an explicit `enabled=0` always blocks insertion, including old-client or other-device requests. Existing opt-outs are preserved. Reading the effective default never writes affirmative consent to the database. No backfill or schema migration is needed.

The welcome screen, Profile and privacy page disclose collection. A non-blocking signed-in notice links to Profile and may be dismissed for the tab session; dismissal does not change tracking. Users can turn it off at Profile → Help improve Form → Share basic usage activity. Opt-out deletes stored events; account deletion removes preferences and events. Guests and the owner are excluded. Review this beta default before a broader launch; the app does not treat this setting as proof of individual legal consent.

Events contain only a hashed event ID, pseudonymous account subject, kind (`open` or `active`) and server timestamp. No client-controlled timestamps, email, videos, body stats, exercise names, page paths, advertising identifiers or device fingerprint. Activity heartbeat: once per minute while visible and after interaction within the last five minutes. Open: initial load or return after at least a minute hidden. Multiple tabs/devices may produce additional opens; this is not unique-device reporting. Sessions are inferred from a 30-minute gap in observed account activity, across devices, not workout duration.

The owner-only report requires an exact configured email and verified password identity or provider identity. Legacy unverified password accounts cannot gain access merely by claiming the owner's email. Owner activity is excluded. Reports provide UTC daily active accounts, opens, inferred sessions, rolling 7/30-day active accounts, monthly distinct accounts and accounts active on at least two dates, plus aggregate daily CSV.

Retention is 90 days; old rows are removed on subsequent event/report requests. Current dates and earliest retained months can be incomplete. Opt-outs erase past events, so aggregates can decrease. Exported aggregate reports cannot be recalled. Figures describe participating signed-in accounts only, not all app users, unique people, revenue, or independently audited fundraising evidence. No historical traction is invented. Earlier periods contain opt-in-only participation; later periods use the beta default. The dashboard discloses this change, so growth across the boundary must not be presented as organic growth without qualification. Average usage duration is not calculated by this release. Avoid comparing partial months without matching observation windows.

## Validation

`npm run test:accounts` covers existing auth/storage, code delivery mocks, expiry, retry limits, purpose binding, replay, reset revocation, password-protected email changes, provider password setup, owner checks, consent enforcement, idempotency and report calculations. `node scripts/test-email-ui.mjs` checks real React components with mocked endpoints at a 390-pixel mobile viewport. `npm run test:account-recovery` checks offline and account-switching behavior. These do not prove email inbox delivery; verify the actual configured sender separately. No synthetic test sends email to real users.
