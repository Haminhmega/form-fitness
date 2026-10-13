# Connected devices — prototype extension

## What this phase adds

Profile → Connected devices opens an interactive device hub. Fitbit by Google, WHOOP, Garmin, Apple Health, and Health Connect each have a demo connection flow. All start disconnected. Choose the data categories you want, import a deterministic seven-day sample, refresh it, change permissions, and disconnect with a choice to retain or remove the imported examples.

Today shows compact device context after the primary workout action. Progress shows device observations and imported activities separately from workouts manually logged in Form. Sample dates are October 7–13, 2026. Refresh time means when the demonstration was refreshed; it does not make those historical samples into live measurements.

No real account authorization, account identifiers, device credentials, access tokens, webhooks, or device data are used. The consent screen changes local demonstration preferences only. Everything is labeled as sample data. The device feature does not enable video collection or model-improvement consent.

## Data behavior

- Activity, sleep and vitals are independently selectable. Unsupported fields stay absent. An absent reading is not zero.
- Revoking a category removes its imported example fields immediately. Enabling a new category requires a new sample sync before its values appear.
- Repeated sync replaces the same provider/day records; it does not append duplicates.
- Source preferences choose one provider for a category. A missing value can fall back to an available provider, and each displayed value identifies that actual source.
- Daily steps and sleep are not summed across devices. HRV is not averaged across devices or treated as interchangeable between measurement methods.
- Imported activities use a single chosen activity source per day. They stay separate from Form's set counts, lifting volume, personal records, and session totals.
- Retained data from a disconnected device is clearly marked as old data. Disconnecting stops future demo refreshes. Removing data only removes the examples from this local prototype; it cannot delete data at a real provider.
- Error, stale-data, expired-authorization and empty-sync previews have explicit recovery paths. No readiness score, diagnosis, health recommendation, or automatic workout adjustment is generated.

## Future integration routes, verified October 13, 2026

| Provider | Real integration work for a later phase |
| --- | --- |
| Fitbit by Google | Target the [Google Health API](https://developers.google.com/health), which is the successor to the Fitbit Web API and uses Google OAuth. The [legacy Fitbit documentation](https://dev.fitbit.com/build/reference/web-api/) says support ended September 30, 2026 and shutdown is scheduled for October 30, 2026. Do not start a new production integration on the legacy API. |
| WHOOP | Register a provider application and implement the [OAuth consent flow](https://developer.whoop.com/docs/developing/oauth/) with the needed [workout, sleep and recovery scopes](https://developer.whoop.com/api/). Use the current API/versioned webhook contract. The prototype deliberately does not infer steps from WHOOP workouts. |
| Garmin | The [Garmin Health API](https://developer.garmin.com/gc-developer-program/health-api/) describes approval-gated access and user consent before data becomes available. Validate current program eligibility and terms before committing a release date. |
| Apple Health | Build a native Apple platform integration using [HealthKit](https://developer.apple.com/documentation/healthkit) and explicit per-type permission. A web prototype cannot directly access the device HealthKit store. |
| Health Connect | Build an Android integration using [Health Connect](https://developer.android.com/health-and-fitness/health-connect), using only permitted [data types](https://developer.android.com/health-and-fitness/health-connect/data-types). Data availability depends on what connected apps write and what access the user grants. |

These routes are planning notes, not implemented integrations. Provider capabilities, approval, device support and policies need another check when production work begins.

## Next implementation milestones

1. Validate the consent, source-selection, missing-data and disconnect flows with users.
2. Define a backend schema that preserves provider, record ID, units, capture time, import time, timezone and measurement method. Add granular authorization and deletion rules before ingesting real health data.
3. Add secure OAuth exchange/token storage for cloud providers and native adapters for the platform health stores.
4. Add idempotent imports, cursor/backfill handling, webhooks, source reconciliation, revoked access, and provider deletion propagation.
5. Test with provider sandboxes and real devices. Keep provider observations separate from any later coaching inference and validate that inference before showing recommendations.
