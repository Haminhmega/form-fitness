import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'public', 'ai');
const runtime = join(root, 'node_modules', '@mediapipe', 'tasks-vision');
const version = '0.10.35';
const modelUrl = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const modelSha256 = '59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const packageInfo = JSON.parse(await readFile(join(runtime, 'package.json'), 'utf8'));
if (packageInfo.version !== version) throw new Error(`Expected @mediapipe/tasks-vision ${version}; found ${packageInfo.version}. Run npm ci.`);
await mkdir(join(target, 'wasm'), { recursive: true });
const artifacts = [];
for (const name of ['vision_wasm_module_internal.js', 'vision_wasm_module_internal.wasm']) {
  const bytes = await readFile(join(runtime, 'wasm', name));
  await copyFile(join(runtime, 'wasm', name), join(target, 'wasm', name));
  artifacts.push({ file: `wasm/${name}`, bytes: bytes.length, sha256: sha256(bytes), source: `npm:@mediapipe/tasks-vision@${version}/wasm/${name}` });
}
let model;
try { model = await readFile(join(target, 'pose_landmarker_lite.task')); } catch { /* Download only when not already bundled. */ }
if (!model || (modelSha256 && sha256(model) !== modelSha256)) {
  const response = await fetch(modelUrl, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Official model download failed: HTTP ${response.status}`);
  model = Buffer.from(await response.arrayBuffer());
  if (model.length < 1_000_000 || model.length > 20_000_000) throw new Error('Unexpected model size. Refusing to bundle it.');
  if (modelSha256 && sha256(model) !== modelSha256) throw new Error('Official model download does not match the pinned SHA-256 digest.');
  await writeFile(join(target, 'pose_landmarker_lite.task'), model);
}
artifacts.push({ file: 'pose_landmarker_lite.task', bytes: model.length, sha256: sha256(model), source: modelUrl });
const manifest = { package: '@mediapipe/tasks-vision', version, model: 'MediaPipe Pose Landmarker Lite, float16, version 1', license: 'Apache-2.0', artifacts };
await writeFile(join(target, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const licenseUrl = 'https://raw.githubusercontent.com/google-ai-edge/mediapipe/master/LICENSE';
try { await readFile(join(target, 'LICENSE-APACHE-2.0.txt')); } catch {
  const response = await fetch(licenseUrl, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`License download failed: HTTP ${response.status}`);
  await writeFile(join(target, 'LICENSE-APACHE-2.0.txt'), await response.text());
}
await writeFile(join(target, 'README.md'), `# Local pose inference assets

Runtime: @mediapipe/tasks-vision ${version}, pinned exactly in package.json and package-lock.json.
Model: MediaPipe Pose Landmarker Lite, float16, version 1.

The runtime and model are Apache-2.0 licensed. The bundled license is copied from the upstream MediaPipe repository. SHA-256 digests, byte counts, and original download sources are recorded in manifest.json.

- Official web guide: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js
- Official model list: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker
- Model card and model license: https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf
- Runtime source/license: https://github.com/google-ai-edge/mediapipe
- Model download: ${modelUrl}

Run npm ci then npm run prepare:ai to restore these files. The application fetches these assets from its own origin only. Video frames and landmarks are processed locally; no cloud inference is used.

Runtime 0.10.35 was selected after browser testing found an external logging request in 1.1.0. The selected bundle did not emit that request in worker and full video tests. The owned worker also restricts fetch and XMLHttpRequest to GET/HEAD for its three exact local asset URLs, rejects fetch redirects, and runs under the app's same-origin network policy. There is no CDN fallback.

The module WASM build requires a modern browser with WebAssembly SIMD, module workers, OffscreenCanvas, and ImageBitmap support. Serve the app over localhost or HTTPS. A file:// copy cannot run the real analysis.

The decoder seeks at 10 Hz and waits for each seek to complete before copying pixels. Inference timestamps are clip sampling positions reported by video.currentTime, not exact encoded-frame presentation timestamps. Low-frame-rate clips can repeat the frame covering adjacent sample positions. Displayed motion timing is therefore approximate, with at least the 0.1-second sampling interval and the source frame rate limiting precision.

Pose landmarks are model estimates, not validated clinical measurements. The model card identifies limits involving body visibility, lighting, scale, and occlusion. Multi-person output (numPoses: 2) is used to reject ambiguous frames, not to offer reliable multi-person coaching.
`);
console.log(JSON.stringify(manifest, null, 2));
