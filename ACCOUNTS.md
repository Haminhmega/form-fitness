# Accounts and synced fitness profiles

Form uses the host's **Continue with ChatGPT** sign-in. The first visit after signing in opens three setup steps: name/experience; optional body stats; goals/days/equipment and explicit consent to cloud storage plus an offline device copy. Existing accounts load automatically. The current hosted app and GitHub repository remain private to their owner; this release does not open public registration.

## Data and controls

- Optional age, height, current weight, target weight and activity level. Measurements are stored in cm/kg; the UI converts metric/imperial input.
- Profile, training preferences, routine definitions, exercise library and completed workouts sync. New accounts start without fictional workout history.
- Active workouts stay on the current device. Complete and save a workout to sync it. Device-import examples remain local samples. Videos and pose results are never uploaded or synced.
- Profile offers editing, refresh/retry, sign-out and typed-confirmation deletion. Sign-out waits for pending changes and active workouts; it clears this account's local copy but preserves the cloud record.
- Deletion removes saved profile/workout content and this device's account copy. A minimal owner key, revision and deletion timestamp remain to reject stale writes after deletion/recreation. Other devices can retain offline copies until they reconnect; a successful refresh clears them.

## Sync behavior

Edits persist to an account-specific device copy, then save after a short debounce. Offline edits remain queued until reconnection. Returning to the app refreshes the cloud version. A compare-and-swap revision prevents simultaneous devices from silently overwriting each other. Conflicts require choosing the cloud version or this device's version; this replaces the complete profile/training document, not a field-by-field merge.

Signed-in email and user identity come from the host and cannot be edited in Form. Local demo records are separate and are not silently imported into a real account. Clearing browser storage can erase active sessions and unsynced changes. Body stats are optional user records, not a calorie prescription or medical assessment.

## Backend and trust boundary

The ESM Worker implements GET, PUT and DELETE `/api/account`. Sites dispatch owns sign-in/sign-out and injects authenticated user ID/email headers; never expose this Worker through an alternate public origin that permits clients to spoof those headers. No password, session token or service credential is stored in application localStorage or committed source. Hosted session handling belongs to Sites.

D1 reads and writes are parameterized and scoped to the trusted ID. Writes enforce same Origin and a custom request header, strict bounded schemas and a 2 MB body limit. SQL `RETURNING` provides an atomic saved version. Responses are private/no-store. The PWA caches only shipped static resources and model files; it never caches API responses. The live audience remains owner-private. Public launch would require a separate review of access, operational abuse controls, quotas and production monitoring.

The database schema is in `db/schema.ts`; generated schema-only migrations and their journal are in `drizzle/`. Sites applies migrations during release using the declared `DB` binding. Do not mutate already applied migrations; append new ones.

## Development

Use Node 22.13 or newer. From this folder:

```sh
npm ci
npm run prepare:ai
npm run test:ai
npm run test:accounts
npm run build
npx wrangler d1 migrations apply DB --local --config dist/server/wrangler.json --persist-to .wrangler/state
npm run preview:server
```

The backend/production-assets preview is `http://127.0.0.1:8787`. `npm run dev` starts Vite with `/api` proxied there. Local previews have no genuine ChatGPT sign-in session; use the local demo. Automated local tests inject fictional dispatch headers into the isolated local Worker only. Do not add a production demo identity or expose such a preview to the network. The portable `Form.html` supports the local demo; use the hosted link for accounts.

Build output contains `dist/server/index.js`, `dist/client/`, and `.openai` hosting/migration metadata. Publish the matching pushed source and packaged build through Sites. GitHub Actions runs the deterministic AI tests, account API/SQLite tests, and production build.

## Verification limits

Automated browser testing covers real local Worker/D1 persistence, phone-sized signup/editing, separate browser contexts, offline reopening/reconnect, conflicts, account deletion and accessibility. API tests exercise authorization, invalid input, sample filtering, concurrent revisions and stale writes after account recreation. Fictional test accounts are used only locally. Browser emulation does not verify a real iPhone installation or the user's complete hosted OAuth session. AI and wearable prototype limitations in AI-TEST.md and DEVICES.md still apply.
