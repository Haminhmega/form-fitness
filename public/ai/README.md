# Local pose inference assets

Runtime: @mediapipe/tasks-vision 0.10.35, pinned exactly in package.json and package-lock.json.
Model: MediaPipe Pose Landmarker Lite, float16, version 1.

The runtime and model are Apache-2.0 licensed. The bundled license is copied from the upstream MediaPipe repository. SHA-256 digests, byte counts, and original download sources are recorded in manifest.json.

- Official web guide: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js
- Official model list: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker
- Model card and model license: https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf
- Runtime source/license: https://github.com/google-ai-edge/mediapipe
- Model download: https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task

Run npm ci then npm run prepare:ai to restore these files. The application fetches these assets from its own origin only. Video frames and landmarks are processed locally; no cloud inference is used.

Runtime 0.10.35 was selected after browser testing found an external logging request in 1.1.0. The selected bundle did not emit that request in worker and full video tests. The owned worker also restricts fetch and XMLHttpRequest to GET/HEAD for its three exact local asset URLs, rejects fetch redirects, and runs under the app's same-origin network policy. There is no CDN fallback.

The module WASM build requires a modern browser with WebAssembly SIMD, module workers, OffscreenCanvas, and ImageBitmap support. Serve the app over localhost or HTTPS. A file:// copy cannot run the real analysis.

The decoder seeks at 10 Hz and waits for each seek to complete before copying pixels. Inference timestamps are clip sampling positions reported by video.currentTime, not exact encoded-frame presentation timestamps. Low-frame-rate clips can repeat the frame covering adjacent sample positions. Displayed motion timing is therefore approximate, with at least the 0.1-second sampling interval and the source frame rate limiting precision.

Pose landmarks are model estimates, not validated clinical measurements. The model card identifies limits involving body visibility, lighting, scale, and occlusion. Multi-person output (numPoses: 2) is used to reject ambiguous frames, not to offer reliable multi-person coaching.
