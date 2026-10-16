/// <reference lib="webworker" />
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { PosePoint } from './types';

type PoseRequest = { id: number; type: 'init'; assetBase: string } | { id: number; type: 'frame'; bitmap: ImageBitmap; timestampMs: number };
const workerScope = self as unknown as DedicatedWorkerGlobalScope;
let landmarker: PoseLandmarker | null = null;
let lastTimestamp = -1;

function restrictNetwork(assetBase: URL) {
  if (assetBase.origin !== workerScope.location.origin) throw new Error('Pose assets must be served by this app.');
  const allowed = new Set(['pose_landmarker_lite.task', 'wasm/vision_wasm_module_internal.js', 'wasm/vision_wasm_module_internal.wasm'].map(path => new URL(path, assetBase).href));
  const permit = (method: string, url: string | URL) => {
    if (!['GET', 'HEAD'].includes(method.toUpperCase()) || !allowed.has(new URL(url, assetBase).href)) throw new Error('The local pose worker blocked a non-asset network request.');
  };
  const localFetch = workerScope.fetch.bind(workerScope);
  workerScope.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try { permit(init?.method || (input instanceof Request ? input.method : 'GET'), input instanceof Request ? input.url : input.toString()); }
    catch (error) { return Promise.reject(error); }
    return localFetch(input, { ...init, mode: 'same-origin', redirect: 'error' });
  };
  const nativeOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method: string, url: string | URL, asynchronous: boolean = true, username?: string | null, password?: string | null) {
    permit(method, url); nativeOpen.call(this, method, url, asynchronous, username, password);
  };
}

workerScope.onmessage = async (event: MessageEvent<PoseRequest>) => {
  const request = event.data;
  try {
    if (request.type === 'init') {
      const assetBase = new URL(request.assetBase);
      if (!['http:', 'https:'].includes(assetBase.protocol)) throw new Error('Serve Form over localhost or HTTPS to load local pose analysis.');
      restrictNetwork(assetBase);
      // The ES module runtime is required for module workers. No CDN fallback.
      const fileset = await FilesetResolver.forVisionTasks(new URL('wasm', assetBase).href, true);
      if (fileset.wasmBinaryPath.includes('_nosimd')) throw new Error('This browser does not support the required WebAssembly runtime. Update your browser, or update iOS if you are using an iPhone or iPad.');
      landmarker = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: new URL('pose_landmarker_lite.task', assetBase).href, delegate: 'CPU' },
        runningMode: 'VIDEO', numPoses: 2,
        minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
        outputSegmentationMasks: false,
      });
      lastTimestamp = -1;
      workerScope.postMessage({ id: request.id, type: 'ready' });
      return;
    }
    try {
      if (!landmarker) throw new Error('The pose model is not ready. Retry the analysis.');
      if (!Number.isFinite(request.timestampMs) || request.timestampMs <= lastTimestamp) throw new Error('The video frames did not have increasing timestamps. Try another video.');
      const result = landmarker.detectForVideo(request.bitmap, request.timestampMs);
      lastTimestamp = request.timestampMs;
      const poses: PosePoint[][] = result.landmarks.map(pose => pose.map(point => ({
        x: point.x, y: point.y, z: point.z, visibility: point.visibility ?? 0,
        presence: 'presence' in point && typeof point.presence === 'number' ? point.presence : undefined,
      })));
      const worldLandmarks: PosePoint[][] | undefined = result.worldLandmarks?.map(pose => pose.map(point => ({
        x: point.x, y: point.y, z: point.z, visibility: point.visibility ?? 0,
        presence: 'presence' in point && typeof point.presence === 'number' ? point.presence : undefined,
      })));
      workerScope.postMessage({ id: request.id, type: 'frame', poses, worldLandmarks });
    } finally {
      request.bitmap.close();
    }
  } catch (error) {
    workerScope.postMessage({ id: request.id, type: 'error', message: error instanceof Error ? error.message : 'Pose inference failed. Please retry.' });
  }
};
