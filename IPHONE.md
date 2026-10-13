# Form on iPhone

Form is an installable Home Screen web app. It is not an App Store binary.

## Install

1. Open https://form-fitness-minh.breezy-rhea-1400.chatgpt.site in Safari on your iPhone. The hosted app is private: sign in with the same ChatGPT account that owns it if asked.
2. Tap Share (available in Safari's menu on some versions), then **Add to Home Screen**.
3. Keep **Open as Web App** enabled if offered, then tap **Add**.
4. Open the new lime **Form** icon. In Profile, wait for **Ready for offline workout logging** while online.

Apple's instructions: https://support.apple.com/guide/iphone/iphea86e5236/ios

## What works

- A dedicated app window and icon; layouts account for the notch and Home indicator.
- Workout logging, routines and preferences stored on this device.
- Reopening offline after the app has prepared its offline files. Storage can be cleared or evicted by the operating system; this is not a cloud backup.
- Updates download while online and wait. Profile offers **Update and reload**, disabled while a workout is active. Selected video analysis must be finished or left before reaching that control.
- Experimental squat analysis on browsers with the required worker, canvas, video decoding and WebAssembly capabilities. Download the model by completing an analysis online before expecting it to work offline. A new app version may need another model download.

## Boundaries

Videos and analysis results remain temporary; the service worker caches only shipped app/model files, never clips or workout records. Workouts live in local storage, not Cache Storage. Safari and an installed app may use separate storage; use the installed icon consistently and do not assume existing browser records will transfer. No cross-device sync or HealthKit access is added. Wearable imports remain samples.

The phone layout and install states are tested in browser emulation, with service worker/offline checks in Chromium and basic layout/navigation checks in WebKit. This does not replace testing installation and AI performance on a physical iPhone. The Windows WebKit test environment lacks OffscreenCanvas, so its AI path cannot validate iPhone inference. A compatible iOS version is necessary but does not guarantee every device/codec will work.

## Build and release

`npm ci`, `npm run prepare:ai`, `npm run test:ai`, then `npm run build`.

The build generates `dist/sw.js` from the actual files and hashes. It precaches the app shell and icons; the three AI runtime/model files are cached when requested. Cache names include the deployment scope and version, preserving the previous build for open tabs. The worker intercepts only known same-origin static files and app-root navigation, ignoring writes, query URLs, Range requests and remote URLs.

Development mode and the portable file do not register a service worker. Use a production build served over HTTPS (or localhost for testing). GitHub CI runs checks automatically; publishing to Sites is a separate release step. The tracked `.openai/hosting.json` identifies the existing Site. Reuse it for future deployments.
