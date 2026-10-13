import PoseWorker from './pose.worker?worker&inline';
import { analyzeSquat } from './squat';
import type { AnalyzeVideoOptions, PoseFrame, PosePoint, SquatAnalysis } from './types';

const SAMPLE_RATE = 10;
const MAX_DURATION = 60;
const MIN_DURATION = 2;
const MODEL_TIMEOUT_MS = 45000;
const FRAME_TIMEOUT_MS = 12000;
const ANALYSIS_TIMEOUT_MS = 180000;
type WorkerResponse = { id: number; type: 'ready' | 'frame' | 'error'; poses?: PosePoint[][]; message?: string };

function abortReason(signal: AbortSignal): Error { return signal.reason instanceof Error ? signal.reason : new DOMException('Analysis cancelled.', 'AbortError'); }
function assertActive(signal: AbortSignal) { if (signal.aborted) throw abortReason(signal); }

function waitForMedia(video: HTMLVideoElement, name: string, signal: AbortSignal, action?: () => void): Promise<void> {
  assertActive(signal);
  return new Promise((resolve, reject) => {
    const clear = () => { clearTimeout(timer); video.removeEventListener(name, ready); video.removeEventListener('error', failed); signal.removeEventListener('abort', aborted); };
    const ready = () => { clear(); resolve(); };
    const failed = () => { clear(); reject(new Error('This browser could not decode the video. Try an MP4 (H.264) or a supported WebM clip.')); };
    const aborted = () => { clear(); reject(abortReason(signal)); };
    const timer = setTimeout(() => { clear(); reject(new Error('The video took too long to load. Try a shorter clip or a different video format.')); }, FRAME_TIMEOUT_MS);
    video.addEventListener(name, ready, { once: true }); video.addEventListener('error', failed, { once: true }); signal.addEventListener('abort', aborted, { once: true });
    try { action?.(); } catch (error) { clear(); reject(error); }
  });
}

/** Sample the decoded pixels covering a clip position, not the frame's exact PTS. */
function seekDecodedFrame(video: HTMLVideoElement, target: number, signal: AbortSignal): Promise<number> {
  assertActive(signal);
  // Paused video does not present another frame for a same-frame seek. Awaiting
  // requestVideoFrameCallback here would stall, especially for low-frame-rate clips.
  if (!video.seeking && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && Math.abs(video.currentTime - target) < 0.00001) return Promise.resolve(video.currentTime);
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); video.removeEventListener('seeked', ready); video.removeEventListener('error', failed); signal.removeEventListener('abort', aborted); };
    const ready = () => { cleanup(); if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) reject(new Error('A video frame could not be decoded. Try a different clip.')); else resolve(video.currentTime); };
    const failed = () => { cleanup(); reject(new Error('A video frame could not be decoded. Try a different clip.')); };
    const aborted = () => { cleanup(); reject(abortReason(signal)); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('Video seeking timed out. Keep this tab visible and try a shorter MP4 clip.')); }, FRAME_TIMEOUT_MS);
    video.addEventListener('seeked', ready, { once: true }); video.addEventListener('error', failed, { once: true }); signal.addEventListener('abort', aborted, { once: true });
    try { video.currentTime = target; } catch (error) { cleanup(); reject(error); }
  });
}

/** Analyze a local object URL without uploading, persisting, or sharing the video. */
export async function analyzeVideo(url: string, options: AnalyzeVideoOptions): Promise<SquatAnalysis> {
  if (!['http:', 'https:'].includes(location.protocol)) throw new Error('Real analysis needs the served app. Open Form with npm run dev on localhost; the portable file keeps the sample experience.');
  if (!url.startsWith('blob:')) throw new Error('Choose a local video to analyze. Remote videos are not sent to this analyzer.');
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') throw new Error('This browser cannot run local pose analysis. Try an up-to-date Chrome or Edge browser.');
  assertActive(options.signal);
  const controller = new AbortController();
  const externalAbort = () => controller.abort(abortReason(options.signal));
  options.signal.addEventListener('abort', externalAbort, { once: true });
  const signal = controller.signal;
  const deadline = setTimeout(() => controller.abort(new Error('Analysis timed out. Try a shorter video and keep this tab visible.')), ANALYSIS_TIMEOUT_MS);
  const video = document.createElement('video');
  video.muted = true; video.playsInline = true; video.preload = 'auto'; video.setAttribute('aria-hidden', 'true'); video.tabIndex = -1;
  // Keep the decoder attached without adding visible or focusable interface content.
  video.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:0;pointer-events:none;z-index:-1;';
  document.body.appendChild(video);
  let worker: Worker | null = null;
  let bitmap: ImageBitmap | null = null;
  let requestId = 0;
  const terminateOnAbort = () => worker?.terminate();
  signal.addEventListener('abort', terminateOnAbort, { once: true });
  const report: AnalyzeVideoOptions['onProgress'] = value => { assertActive(signal); options.onProgress(value); };

  function callWorker(type: 'init' | 'frame', data: Record<string, unknown>, transfer: Transferable[] = []): Promise<WorkerResponse> {
    assertActive(signal);
    const currentWorker = worker!;
    const id = ++requestId;
    return new Promise((resolve, reject) => {
      const clean = () => { clearTimeout(timeout); currentWorker.removeEventListener('message', message); currentWorker.removeEventListener('error', failed); currentWorker.removeEventListener('messageerror', failed); signal.removeEventListener('abort', aborted); };
      const message = (event: MessageEvent<WorkerResponse>) => { if (event.data.id !== id) return; clean(); if (event.data.type === 'error') reject(new Error(event.data.message || 'Local pose inference failed. Retry the analysis.')); else resolve(event.data); };
      const failed = (event: Event) => { clean(); reject(new Error(event instanceof ErrorEvent && event.message ? event.message : 'The local pose worker could not run. Try again in an up-to-date browser.')); };
      const aborted = () => { clean(); reject(abortReason(signal)); };
      const timeout = setTimeout(() => { clean(); reject(new Error(type === 'init' ? 'The local model did not load. Check that the app includes its ai assets, then retry.' : 'Pose inference timed out. Try a shorter clip.')); }, type === 'init' ? MODEL_TIMEOUT_MS : FRAME_TIMEOUT_MS);
      currentWorker.addEventListener('message', message); currentWorker.addEventListener('error', failed); currentWorker.addEventListener('messageerror', failed); signal.addEventListener('abort', aborted, { once: true });
      try { currentWorker.postMessage({ id, type, ...data }, transfer); } catch (error) { clean(); reject(error); }
    });
  }

  try {
    await waitForMedia(video, 'loadedmetadata', signal, () => { video.src = url; video.load(); });
    if (!Number.isFinite(video.duration)) {
      // Browser-recorded WebM may omit its duration until the decoder seeks to its end.
      await waitForMedia(video, 'seeked', signal, () => { video.currentTime = 1e7; });
    }
    const duration = video.duration; const width = video.videoWidth; const height = video.videoHeight;
    if (!Number.isFinite(duration) || duration < MIN_DURATION || duration > MAX_DURATION) throw new Error(`Choose a video between ${MIN_DURATION} and ${MAX_DURATION} seconds long.`);
    if (!width || !height) throw new Error('This file does not contain a readable video track. Choose another clip.');
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) await waitForMedia(video, 'loadeddata', signal);
    assertActive(signal);
    const scale = Math.min(1, 960 / width, 720 / height);
    const frameWidth = Math.max(1, Math.round(width * scale)); const frameHeight = Math.max(1, Math.round(height * scale));
    report({ phase: 'model', completed: 0, total: 1 });
    assertActive(signal);
    worker = new PoseWorker({ name: 'form-local-pose' });
    const assetBase = new URL('./ai/', location.href).href;
    await callWorker('init', { assetBase });
    report({ phase: 'model', completed: 1, total: 1 });
    const frames: PoseFrame[] = [];
    const total = Math.ceil(duration * SAMPLE_RATE);
    let lastTime = -1;
    report({ phase: 'frames', completed: 0, total });
    for (let index = 0; index < total; index++) {
      assertActive(signal);
      const target = Math.min(index / SAMPLE_RATE, Math.max(0, duration - 0.02));
      const time = await seekDecodedFrame(video, target, signal);
      if (time > lastTime + 0.00001) {
        bitmap = await createImageBitmap(video, { resizeWidth: frameWidth, resizeHeight: frameHeight, resizeQuality: 'medium' });
        assertActive(signal);
        const sending = bitmap;
        const responsePromise = callWorker('frame', { bitmap: sending, timestampMs: time * 1000 }, [sending]);
        bitmap = null; // Transferred ownership: the worker closes this bitmap after inference.
        let result: WorkerResponse;
        try { result = await responsePromise; } finally { sending.close(); }
        frames.push({ time, poses: result.poses || [] });
        lastTime = time;
      }
      report({ phase: 'frames', completed: index + 1, total });
    }
    if (!frames.length) throw new Error('No video frames could be decoded. Try a different clip.');
    report({ phase: 'analysis', completed: 0, total: 1 });
    const result = analyzeSquat({ frames, duration, width, height, sampleRate: SAMPLE_RATE });
    assertActive(signal);
    report({ phase: 'analysis', completed: 1, total: 1 });
    return result;
  } finally {
    clearTimeout(deadline); options.signal.removeEventListener('abort', externalAbort); signal.removeEventListener('abort', terminateOnAbort);
    bitmap?.close(); worker?.terminate();
    video.pause(); video.removeAttribute('src'); video.load(); video.remove();
  }
}
