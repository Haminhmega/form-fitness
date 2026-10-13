import type { AnalysisInput, AnalyzedFrame, MovementObservation, PosePoint, SquatAnalysis, SquatRep } from './types';

/** Experimental segmentation settings, not validated clinical or coaching cutoffs. */
export const SQUAT_LIMITS = {
  jointConfidence: 0.65, orientationConfidence: 0.45,
  frameMargin: 0.015, minimumTorsoHeight: 0.08, minimumLegSegmentHeight: 0.065,
  maximumShoulderSpanRatio: 0.65, maximumHipSpanRatio: 0.55,
  uprightAngle: 158, leaveUprightAngle: 154, bentAngle: 125,
  uprightHoldSeconds: 0.16, bentHoldSeconds: 0.12, smoothingSeconds: 0.10,
  minimumRepSeconds: 0.8, maximumRepSeconds: 20, minimumPhaseSeconds: 0.25,
  minimumRangeDegrees: 35, minimumClipSeconds: 2, minimumValidFrames: 8,
  minimumTrackedSeconds: 1.5, comparableRepCount: 4,
} as const;

type Side = 'left' | 'right';
type Pixel = { x: number; y: number };
type GateResult = { side: Side; angle: number } | { reason: string };
type Top = { time: number; angle: number };
type Cycle = { start: Top; bottom: number; minAngle: number; side: Side; bentSince: number | null; bent: boolean; returnTop: Top | null };
const joints = { left: [11, 23, 25, 27], right: [12, 24, 26, 28] } as const;
const finite = (value: number) => Number.isFinite(value);
const confidence = (point: PosePoint | undefined) => point && finite(point.visibility) ? Math.min(point.visibility, point.presence ?? 1) : 0;
const pixel = (point: PosePoint, width: number, height: number): Pixel => ({ x: point.x * width, y: point.y * height });
const distance = (a: Pixel, b: Pixel) => Math.hypot(a.x - b.x, a.y - b.y);
const pointExists = (point: PosePoint | undefined): point is PosePoint => !!point && finite(point.x) && finite(point.y) && finite(point.z);
const round = (value: number, places = 2) => Number(value.toFixed(places));

function angleAt(hip: Pixel, knee: Pixel, ankle: Pixel): number | null {
  const a = { x: hip.x - knee.x, y: hip.y - knee.y };
  const b = { x: ankle.x - knee.x, y: ankle.y - knee.y };
  const product = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
  if (product < 1e-6) return null;
  return Math.acos(Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y) / product))) * 180 / Math.PI;
}

function gate(pose: PosePoint[], width: number, height: number, lockedSide: Side | null): GateResult {
  const sides: Side[] = lockedSide ? [lockedSide] : ['left', 'right'];
  const eligible = sides.filter(side => joints[side].every(index => pointExists(pose[index]) && confidence(pose[index]) >= SQUAT_LIMITS.jointConfidence));
  if (!eligible.length) return { reason: 'Required shoulder, hip, knee, or ankle was not confidently tracked.' };
  const score = (side: Side) => joints[side].reduce((sum, index) => sum + confidence(pose[index]), 0);
  const side = eligible.sort((a, b) => score(b) - score(a))[0];
  const selected = joints[side].map(index => pose[index]);
  if (selected.some(point => point.x < SQUAT_LIMITS.frameMargin || point.x > 1 - SQUAT_LIMITS.frameMargin || point.y < SQUAT_LIMITS.frameMargin || point.y > 1 - SQUAT_LIMITS.frameMargin)) {
    return { reason: 'A required joint was outside or too close to the video edge.' };
  }
  const [shoulder, hip, knee, ankle] = selected.map(point => pixel(point, width, height));
  const torso = distance(shoulder, hip);
  if (torso < height * SQUAT_LIMITS.minimumTorsoHeight || distance(hip, knee) < height * SQUAT_LIMITS.minimumLegSegmentHeight || distance(knee, ankle) < height * SQUAT_LIMITS.minimumLegSegmentHeight) {
    return { reason: 'The tracked body was too small or its joint geometry was unreliable.' };
  }
  const span = (a: number, b: number) => pointExists(pose[a]) && pointExists(pose[b]) && confidence(pose[a]) >= SQUAT_LIMITS.orientationConfidence && confidence(pose[b]) >= SQUAT_LIMITS.orientationConfidence ? distance(pixel(pose[a], width, height), pixel(pose[b], width, height)) / torso : null;
  const shoulderSpan = span(11, 12), hipSpan = span(23, 24);
  if (shoulderSpan === null && hipSpan === null) return { reason: 'The camera view could not be checked from the visible joints.' };
  if ((shoulderSpan !== null && shoulderSpan > SQUAT_LIMITS.maximumShoulderSpanRatio) || (hipSpan !== null && hipSpan > SQUAT_LIMITS.maximumHipSpanRatio)) {
    return { reason: 'The projected shoulder or hip width was not consistent with the required side view.' };
  }
  const angle = angleAt(hip, knee, ankle);
  return angle === null ? { reason: 'A projected knee angle could not be calculated.' } : { side, angle };
}

export function analyzeSquat(input: AnalysisInput): SquatAnalysis {
  const duration = finite(input.duration) && input.duration >= 0 ? input.duration : 0;
  const frames: AnalyzedFrame[] = [], reps: SquatRep[] = [], repSegments: number[] = [];
  const problemCounts = new Map<string, number>();
  const issues: string[] = [];
  const sampleRate = finite(input.sampleRate) && input.sampleRate > 0 ? input.sampleRate : 10;
  const maxGap = Math.max(0.35, Math.min(0.6, 2.5 / sampleRate));
  let side: Side | null = null, smoothed: number | null = null, segmentTime: number | null = null;
  let previousTime: number | null = null, firstValidSeen = false, partialStart = false, openingConfirmed = false, interruptedCycle = false;
  let topSince: number | null = null, lastTop: Top | null = null, armed = false, cycle: Cycle | null = null;
  let validCount = 0, trackedSeconds = 0, gaps = 0, segment = 0, rejectedCycles = 0;
  const geometryAvailable = finite(input.width) && finite(input.height) && input.width > 0 && input.height > 0;
  const reset = () => {
    if (cycle && (cycle.bent || cycle.start.angle - cycle.minAngle >= 20)) interruptedCycle = true;
    side = null; smoothed = null; segmentTime = null; topSince = null; lastTop = null; armed = false; cycle = null; segment++;
  };
  const invalid = (frame: AnalyzedFrame, reason: string) => {
    frame.reason = reason; frames.push(frame); problemCounts.set(reason, (problemCounts.get(reason) ?? 0) + 1); reset();
  };

  for (const source of input.frames) {
    const pose = source.poses.length === 1 ? source.poses[0] : [];
    const frame: AnalyzedFrame = { time: source.time, landmarks: pose.map(point => ({ ...point })), valid: false, angle: null };
    if (!finite(source.time) || source.time < 0 || source.time > duration + 0.001 || (previousTime !== null && source.time <= previousTime)) {
      invalid(frame, 'A frame had an invalid, repeated, or out-of-order timestamp.'); continue;
    }
    const time = source.time;
    if (previousTime !== null && time - previousTime > maxGap) { gaps++; reset(); }
    previousTime = time;
    if (!geometryAvailable) { invalid(frame, 'Video dimensions were unavailable for aspect-correct measurements.'); continue; }
    if (source.poses.length !== 1) { invalid(frame, source.poses.length > 1 ? 'More than one person was detected.' : 'No person was tracked.'); continue; }
    const result = gate(pose, input.width, input.height, side);
    if ('reason' in result) { invalid(frame, result.reason); continue; }

    const dt = segmentTime === null ? 0 : time - segmentTime;
    if (segmentTime !== null) trackedSeconds += dt;
    smoothed = smoothed === null ? result.angle : smoothed + (1 - Math.exp(-dt / SQUAT_LIMITS.smoothingSeconds)) * (result.angle - smoothed);
    segmentTime = time; side = result.side;
    frame.valid = true; frame.angle = round(result.angle, 3); frames.push(frame); validCount++;
    if (!firstValidSeen) { firstValidSeen = true; partialStart = smoothed < SQUAT_LIMITS.uprightAngle; }
    if (!openingConfirmed && smoothed < SQUAT_LIMITS.leaveUprightAngle) partialStart = true;

    if (!cycle) {
      if (smoothed >= SQUAT_LIMITS.uprightAngle) {
        topSince ??= time;
        if (time - topSince >= SQUAT_LIMITS.uprightHoldSeconds - 1e-8) { armed = true; openingConfirmed = true; }
        lastTop = { time, angle: result.angle };
      } else if (armed && lastTop && smoothed < SQUAT_LIMITS.leaveUprightAngle) {
        cycle = { start: { ...lastTop }, bottom: time, minAngle: result.angle, side, bentSince: null, bent: false, returnTop: null };
        topSince = null;
      } else if (!armed) topSince = null;
    }

    if (cycle) {
      if (result.angle < cycle.minAngle - 0.5) cycle.bottom = time;
      cycle.minAngle = Math.min(cycle.minAngle, result.angle);
      if (smoothed <= SQUAT_LIMITS.bentAngle) {
        cycle.bentSince ??= time;
        if (time - cycle.bentSince >= SQUAT_LIMITS.bentHoldSeconds - 1e-8) cycle.bent = true;
      } else if (!cycle.bent) cycle.bentSince = null;

      if (time - cycle.start.time > SQUAT_LIMITS.maximumRepSeconds) {
        rejectedCycles++; reset(); continue;
      }
      if (smoothed >= SQUAT_LIMITS.uprightAngle) {
        cycle.returnTop ??= { time, angle: result.angle };
        if (time - cycle.returnTop.time >= SQUAT_LIMITS.uprightHoldSeconds - 1e-8) {
          const end = cycle.returnTop.time;
          const descent = cycle.bottom - cycle.start.time, ascent = end - cycle.bottom;
          const range = Math.max(cycle.start.angle, cycle.returnTop.angle) - cycle.minAngle;
          if (cycle.bent && end - cycle.start.time >= SQUAT_LIMITS.minimumRepSeconds && descent >= SQUAT_LIMITS.minimumPhaseSeconds && ascent >= SQUAT_LIMITS.minimumPhaseSeconds && range >= SQUAT_LIMITS.minimumRangeDegrees) {
            reps.push({ index: reps.length + 1, start: round(cycle.start.time, 3), bottom: round(cycle.bottom, 3), end: round(end, 3), descentSeconds: round(descent), ascentSeconds: round(ascent), rangeDegrees: round(range, 1), minKneeAngle: round(cycle.minAngle, 1), side: cycle.side });
            repSegments.push(segment);
          } else if (cycle.bent) rejectedCycles++;
          cycle = null; armed = true; topSince = time; lastTop = { time, angle: result.angle };
        }
      } else cycle.returnTop = null;
    }
  }

  const partialEnd = !!cycle && (cycle.bent || cycle.start.angle - cycle.minAngle >= 20);
  for (const [reason, count] of problemCounts) issues.push(`${reason} ${count} ${count === 1 ? 'frame was' : 'frames were'} withheld.`);
  if (gaps) issues.push(`${gaps} sampling ${gaps === 1 ? 'gap interrupted' : 'gaps interrupted'} tracking. Cycles were not joined across gaps longer than ${round(maxGap, 2)} seconds.`);
  if (partialStart) issues.push('The opening movement lacked a confirmed upright start. An opening partial cycle was not counted; hold standing briefly before moving.');
  if (partialEnd) issues.push('The clip ended before the last candidate returned to a confirmed upright position. That partial cycle was not counted.');
  if (interruptedCycle) issues.push('A candidate movement crossed a tracking interruption and was not counted.');
  if (rejectedCycles) issues.push(`${rejectedCycles} candidate ${rejectedCycles === 1 ? 'cycle fell' : 'cycles fell'} outside the experimental range or timing limits and ${rejectedCycles === 1 ? 'was' : 'were'} not counted.`);

  const insufficient = duration < SQUAT_LIMITS.minimumClipSeconds || validCount < SQUAT_LIMITS.minimumValidFrames || trackedSeconds < SQUAT_LIMITS.minimumTrackedSeconds;
  if (insufficient) {
    issues.push('There was not enough continuously tracked footage for this test: at least 2 seconds of video, 8 valid frames, and 1.5 tracked seconds are required.');
    reps.length = 0; repSegments.length = 0;
  }
  if (!reps.length) issues.push('No completed upright–bend–upright cycle met the experimental thresholds. This does not establish whether a squat was attempted.');

  const observations: MovementObservation[] = [];
  if (reps.length) {
    observations.push({ id: 'measured-cycles', title: `${reps.length} completed ${reps.length === 1 ? 'cycle' : 'cycles'} measured`, detail: 'Counted from visible upright–bend–upright knee-angle changes. Bodyweight squat is the movement you selected; this test does not independently identify the exercise. Phase times include pauses and are approximate sampled-video measurements.', repIndexes: reps.map(rep => rep.index), time: reps[0].bottom, tone: 'neutral' });
    const comparable = new Map<number, SquatRep[]>();
    reps.forEach((rep, index) => comparable.set(repSegments[index], [...(comparable.get(repSegments[index]) ?? []), rep]));
    const group = [...comparable.values()].sort((a, b) => b.length - a.length).find(candidate => candidate.length >= SQUAT_LIMITS.comparableRepCount);
    if (group) {
      const early = (group[0].rangeDegrees + group[1].rangeDegrees) / 2;
      const lastTwo = group.slice(-2);
      const late = (lastTwo[0].rangeDegrees + lastTwo[1].rangeDegrees) / 2;
      const spread = Math.max(...group.map(rep => rep.rangeDegrees)) - Math.min(...group.map(rep => rep.rangeDegrees));
      if (early - late >= 10 && lastTwo.every(rep => early - rep.rangeDegrees >= 8)) {
        observations.push({ id: 'later-range', title: 'Later measured knee-angle range was smaller', detail: `In one uninterrupted segment, the last two cycles had about ${round(early - late, 0)}° less projected knee-angle range than the first two. Review the highlighted moments. Camera projection and tracking can affect this comparison; this is not a depth, safety, or technique grade.`, repIndexes: lastTwo.map(rep => rep.index), time: lastTwo[0].bottom, tone: 'notice' });
      } else if (spread <= 10) {
        observations.push({ id: 'similar-range', title: 'Measured knee-angle ranges were similar', detail: `${group.length} cycles in one uninterrupted segment had a projected range spread of about ${round(spread, 0)}°. This describes only the measured 2D knee-angle changes, not overall movement quality.`, repIndexes: group.map(rep => rep.index), time: group[0].bottom, tone: 'neutral' });
      }
    }
  }
  const status = !reps.length ? 'unable' : problemCounts.size || gaps || partialStart || partialEnd || interruptedCycle || rejectedCycles ? 'partial' : 'assessed';
  return { status, reps, frames, duration, validFraction: input.frames.length ? validCount / input.frames.length : 0, issues, observations };
}
