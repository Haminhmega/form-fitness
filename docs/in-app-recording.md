# In-app recording: browser and lifecycle decisions

Official documentation checked **15 October 2026**. This feature records a short local clip for the existing video-analysis flow. Camera permission, a live preview, countdown, recording, and analysis are separate states; opening the camera must not silently start a recording.

## Capture and permission

- Request the camera from an explicit user action. Use video with preferred facing mode/resolution rather than mandatory constraints, and `audio: false` because motion analysis does not need microphone access.
- Require an available `getUserMedia` API in a secure context. Production uses HTTPS; a phone opening an ordinary LAN HTTP address does not inherit the localhost exception. Embedded browsers may additionally need the embedding page to delegate camera permission.
- Distinguish denied permission, missing camera, and a camera that cannot be opened. Keep choosing an existing video available.
- A permission prompt can remain unresolved indefinitely. Cancellation must invalidate its request token; if a stream arrives afterward, stop its tracks immediately. Stop the previous stream before switching cameras.

These decisions follow [MDN's getUserMedia documentation](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).

## iPhone preview and recording format

Use a muted, inline video preview (`autoPlay`, `muted`, `playsInline`), attach the stream through `srcObject`, and handle a rejected `play()` promise. Start countdown/recording only when the preview has usable video dimensions. Inline playback avoids unexpectedly replacing the app with iPhone fullscreen video. [WebKit's inline-video policy](https://webkit.org/blog/6784/new-video-policies-for-ios/).

Feature-detect `MediaRecorder` and candidate MIME types. Prefer a supported MP4 format for broad iPhone compatibility, with supported WebM or browser-selected format as fallbacks. Do not identify formats through user-agent guessing or assume Safari supports only MP4: Safari 18.4 added WebM recording with VP8/VP9. Handle constructor/start failures even after a positive support check. [WebKit Safari 18.4 media changes](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/), [MDN isTypeSupported](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static).

Use the recorder's actual MIME type for the final Blob/File and its extension; renaming WebM bytes to MP4 is not conversion. [MDN mimeType](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/mimeType).

## Countdown, completion, and cleanup

- Countdown and elapsed time use time deadlines, not received-chunk counts. Delayed `dataavailable` delivery, including Safari capture interruptions, makes `timeslice` unsuitable as a clock. Keep a short recording limit and still validate the recorded clip's playable duration against the analysis flow's 2–60 second range. [MDN dataavailable](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/dataavailable_event).
- Register event handlers before starting. Collect nonempty chunks and construct the final recording in `stop`, after the last `dataavailable` event. Do not clear the chunks when the user first presses Stop. [MDN stop event](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/stop_event).
- Close the camera and discard an interrupted countdown/take when the page becomes hidden rather than continuing an unreliable background capture. Explain the discard and offer a new take. This is an application policy, not a guarantee that every browser delivers lifecycle events before suspension.
- Stop every media track on cancellation, error, replacement, and unmount; detach `srcObject` and revoke temporary clip URLs when no longer needed. Calling a track's `stop()` does not fire its `ended` event, so cleanup cannot depend on that callback. [MDN track stop](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/stop).

## Verification boundary

`npm run test:camera` covers 23 injected stream/recorder/timer scenarios. A separate local Chrome UI fixture used a synthetic canvas stream with the browser's actual MediaRecorder: 3-second delayed capture and immediate capture produced playable MP4 clips; a 10-second countdown was cancelled without recording; stopped/cancelled streams returned to zero active tracks; denial showed the existing-video fallback. A 5-second recorded clip reached the actual pose-analysis flow and correctly produced retake guidance because no person was visible. This verifies the integration, not human-movement accuracy or physical camera hardware.

Mocked API tests and desktop camera tests cannot establish iPhone recording compatibility. **Real-iPhone verification remains required**, in both Safari and the installed Home Screen app: first permission grant, denial/retry, front/rear switching, each countdown choice, cancel during countdown, stop/manual and automatic limit, short-clip rejection, replay/analysis, page hiding or phone locking, and camera release after leaving. Check portrait and landscape playback without assuming the preview and encoded orientation match. Confirm that failure messages preserve the existing-video fallback and that no clip is sent to a server.
