import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/ai/squat.ts'],bundle:true,format:'esm',platform:'node',write:false});
const engine=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const { analyzeSquat, SQUAT_LIMITS } = engine;
let passed = 0;
const check = (name, task) => { task(); passed++; console.log(`PASS ${name}`); };

function pose(angle, width = 1000, height = 1000, options = {}) {
  const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.3, z: 0, visibility: 0.99, presence: 0.99 }));
  const radians = angle * Math.PI / 180;
  const knee = { x: width * 0.56, y: height * 0.66 };
  const ankle = { x: knee.x, y: knee.y + height * 0.19 };
  const hip = { x: knee.x - Math.sin(radians) * height * 0.19, y: knee.y + Math.cos(radians) * height * 0.19 };
  const shoulder = { x: hip.x - height * 0.02, y: hip.y - height * 0.18 };
  const locations = [shoulder, hip, knee, ankle];
  for (const [side, indices] of [['left', [11, 23, 25, 27]], ['right', [12, 24, 26, 28]]]) {
    indices.forEach((index, i) => {
      points[index] = { x: (locations[i].x + (side === 'right' ? height * 0.012 : 0)) / width, y: locations[i].y / height, z: 0, visibility: side === 'left' ? 0.99 : 0.97, presence: 0.99 };
    });
  }
  if (options.front) { points[12].x += height * 0.16 / width; points[24].x += height * 0.11 / width; }
  return points;
}

function clip(keys, { fps = 10, width = 1000, height = 1000, sampleRate = fps, options = {} } = {}) {
  const duration = keys.at(-1)[0];
  const frames = [];
  for (let i = 0; i <= Math.round(duration * fps); i++) {
    const time = Number((i / fps).toFixed(6));
    let k = 0;
    while (k < keys.length - 2 && time > keys[k + 1][0] + 1e-8) k++;
    const [ta, a] = keys[k], [tb, b] = keys[Math.min(k + 1, keys.length - 1)];
    const angle = ta === tb ? a : a + (b - a) * Math.max(0, Math.min(1, (time - ta) / (tb - ta)));
    frames.push({ time, poses: [pose(angle, width, height, options)] });
  }
  return { frames, duration, width, height, sampleRate };
}

const cycle = [[0, 175], [0.5, 175], [1.5, 90], [2.5, 175], [3.1, 175]];
function repetitions(minima = [90, 90], pause = 0) {
  const keys = [[0, 175], [0.5, 175]];
  let top = 0.5;
  for (const minimum of minima) {
    keys.push([top + 1, minimum]);
    if (pause) keys.push([top + 1 + pause, minimum]);
    keys.push([top + 2 + pause, 175], [top + 2.5 + pause, 175]);
    top += 2.5 + pause;
  }
  return keys;
}

check('Pixel-aspect-correct geometry returns the same knee angle for portrait, square and landscape clips', () => {
  for (const [width, height] of [[375, 812], [1000, 1000], [1920, 1080]]) {
    for (const expected of [80, 90, 120, 175]) {
      const output = analyzeSquat(clip([[0, expected], [2, expected]], { width, height }));
      assert(output.frames.every(frame => frame.valid));
      assert(Math.abs(output.frames[0].angle - expected) < 0.001);
    }
  }
});

check('A fully observed cycle yields one 1-based rep, real frame timestamps and consistent phase durations', () => {
  const input = clip(cycle);
  const output = analyzeSquat(input);
  assert.equal(output.status, 'assessed');
  assert.equal(output.reps.length, 1);
  const rep = output.reps[0];
  assert.equal(rep.index, 1);
  assert.equal(rep.side, 'left');
  assert.equal(rep.minKneeAngle, 90);
  assert.equal(rep.bottom, 1.5);
  assert(rep.start < rep.bottom && rep.bottom < rep.end);
  assert.equal(rep.descentSeconds, Number((rep.bottom - rep.start).toFixed(2)));
  assert.equal(rep.ascentSeconds, Number((rep.end - rep.bottom).toFixed(2)));
  assert(rep.descentSeconds >= 0.7 && rep.descentSeconds <= 1.1);
  assert(rep.ascentSeconds >= 0.7 && rep.ascentSeconds <= 1.2);
  for (const time of [rep.start, rep.bottom, rep.end]) assert(input.frames.some(frame => frame.time === time));
  assert.equal(output.validFraction, 1);
});

check('Repeated cycles count once each, and pauses do not manufacture additional repetitions', () => {
  const output = analyzeSquat(clip(repetitions([90, 95, 100], 1)));
  assert.equal(output.status, 'assessed');
  assert.equal(output.reps.length, 3);
  assert.deepEqual(output.reps.map(rep => rep.index), [1, 2, 3]);
  assert(output.reps.every(rep => rep.ascentSeconds > 1.5));
  assert(output.observations[0].detail.includes('include pauses'));
});

check('A one-frame upright opening is withheld with an explanation; a later qualifying cycle yields partial status', () => {
  const opening = [[0, 175], [0.1, 150], [1.1, 90], [2.1, 175], [2.7, 175]];
  const firstOnly = analyzeSquat(clip(opening));
  assert.equal(firstOnly.reps.length, 0);
  assert.equal(firstOnly.status, 'unable');
  assert(firstOnly.issues.some(issue => issue.includes('lacked a confirmed upright start')));
  const later = analyzeSquat(clip([...opening, [3.7, 90], [4.7, 175], [5.3, 175]]));
  assert.equal(later.reps.length, 1);
  assert.equal(later.status, 'partial');
  assert(later.issues.some(issue => issue.includes('lacked a confirmed upright start')));
  assert.equal(SQUAT_LIMITS.uprightHoldSeconds, 0.16);
});

check('Actual timestamps support 5fps source samples and irregular dropped frames without using frame counts as time', () => {
  const full = analyzeSquat(clip(cycle));
  const low = analyzeSquat(clip(cycle, { fps: 5, sampleRate: 10 }));
  assert.equal(low.reps.length, 1);
  assert(Math.abs(low.reps[0].end - full.reps[0].end) <= 0.21);
  const irregular = clip(repetitions([90, 90]));
  irregular.frames = irregular.frames.filter((frame, index) => index % 7 !== 3);
  const output = analyzeSquat(irregular);
  assert.equal(output.reps.length, 2);
  assert(!output.issues.some(issue => issue.includes('sampling gap')));
});

check('An opening or closing partial cycle is excluded while a subsequent complete cycle remains usable', () => {
  const startPartial = analyzeSquat(clip([[0, 95], [0.8, 175], [1.3, 175], [2.3, 90], [3.3, 175], [3.9, 175]]));
  assert.equal(startPartial.reps.length, 1);
  assert.equal(startPartial.status, 'partial');
  assert(startPartial.issues.some(issue => issue.includes('opening partial')));
  const endPartial = analyzeSquat(clip([...cycle.slice(0, -1), [3, 175], [4, 90], [4.5, 115]]));
  assert.equal(endPartial.reps.length, 1);
  assert.equal(endPartial.status, 'partial');
  assert(endPartial.issues.some(issue => issue.includes('clip ended')));
});

check('Low-confidence occlusion invalidates frames and never joins a cycle across missing tracking', () => {
  const input = clip(cycle);
  for (const frame of input.frames) if (frame.time >= 1.3 && frame.time <= 1.7) for (const point of frame.poses[0]) point.visibility = 0.2;
  const output = analyzeSquat(input);
  assert.equal(output.reps.length, 0);
  assert.equal(output.status, 'unable');
  assert(output.frames.filter(frame => !frame.valid).every(frame => frame.angle === null && frame.reason));
  assert.equal(output.validFraction, 27 / 32);
  assert(output.issues.some(issue => issue.includes('tracking interruption')));
});

check('A timestamp gap resets the cycle; no invented frames or angle values fill the gap', () => {
  const input = clip(cycle);
  input.frames = input.frames.filter(frame => frame.time < 1.3 || frame.time > 1.7);
  const output = analyzeSquat(input);
  assert.equal(output.reps.length, 0);
  assert.equal(output.frames.length, input.frames.length);
  assert(output.issues.some(issue => issue.includes('sampling gap')));
  assert(output.frames.every((frame, index) => frame.time === input.frames[index].time));
});

check('Recovery after an interrupted first cycle counts only a later uninterrupted cycle', () => {
  const input = clip(repetitions([90, 90]));
  input.frames.find(frame => frame.time === 1.5).poses = [];
  const output = analyzeSquat(input);
  assert.equal(output.reps.length, 1);
  assert(output.reps[0].start > 2.5);
  assert.equal(output.status, 'partial');
});

check('Side choice remains stable despite confidence oscillation, and a lost side cannot be swapped mid-cycle', () => {
  const stable = clip(cycle);
  stable.frames.forEach((frame, index) => { if (index > 2) for (const joint of [12, 24, 26, 28]) frame.poses[0][joint].visibility = 1; });
  assert.equal(analyzeSquat(stable).reps[0].side, 'left');
  for (const frame of stable.frames) if (frame.time === 1.5) frame.poses[0][25].visibility = 0.1;
  assert.equal(analyzeSquat(stable).reps.length, 0);
  const right = clip(cycle);
  for (const frame of right.frames) for (const joint of [11, 23, 25, 27]) frame.poses[0][joint].visibility = 0.5;
  assert.equal(analyzeSquat(right).reps[0].side, 'right');
});

check('Multiple people, frontal projection, missing orientation and cropped required joints are withheld', () => {
  const multiple = clip(cycle);
  multiple.frames.forEach(frame => frame.poses.push(structuredClone(frame.poses[0])));
  const front = clip(cycle, { options: { front: true } });
  const cropped = clip(cycle);
  cropped.frames.forEach(frame => { frame.poses[0][27].y = 1.02; frame.poses[0][28].y = 1.02; });
  const unknownView = clip(cycle);
  unknownView.frames.forEach(frame => { frame.poses[0][12].visibility = 0.1; frame.poses[0][24].visibility = 0.1; });
  for (const input of [multiple, front, cropped, unknownView]) {
    const output = analyzeSquat(input);
    assert.equal(output.status, 'unable');
    assert.equal(output.reps.length, 0);
    assert.equal(output.validFraction, 0);
    assert(output.frames.every(frame => !frame.valid && frame.angle === null));
  }
});

check('Stationary upright or bent clips, modest noise, and a one-frame impulse produce no completed cycles', () => {
  const upright = clip([[0, 175], [4, 175]]);
  const bent = clip([[0, 90], [4, 90]]);
  const noise = clip([[0, 173], [4, 173]]);
  noise.frames.forEach(frame => { frame.poses = [pose(173 + 3 * Math.sin(frame.time * 28))]; });
  const impulse = clip([[0, 175], [4, 175]]);
  impulse.frames[15].poses = [pose(70)];
  for (const input of [upright, bent, noise, impulse]) {
    const output = analyzeSquat(input);
    assert.equal(output.status, 'unable');
    assert.equal(output.reps.length, 0);
    assert(output.issues.some(issue => issue.includes('No completed')));
  }
});

check('Too-short clips, missing dimensions, absent people and too few tracked frames return unable', () => {
  const short = clip([[0, 175], [0.3, 175], [0.7, 90], [1.1, 175], [1.5, 175]], { fps: 20 });
  const missingDimensions = { ...clip(cycle), width: 0 };
  const blank = clip(cycle); blank.frames.forEach(frame => { frame.poses = []; });
  const sparse = clip(cycle); sparse.frames = sparse.frames.filter((_, index) => index % 6 === 0);
  for (const input of [short, missingDimensions, blank, sparse, { frames: [], duration: 0, width: 1, height: 1, sampleRate: 10 }]) {
    const output = analyzeSquat(input);
    assert.equal(output.status, 'unable'); assert.deepEqual(output.reps, []);
  }
});

check('Invalid or repeated timestamps do not create cycles and never become valid measurements', () => {
  const input = clip(cycle);
  input.frames[15].time = input.frames[14].time;
  const duplicate = analyzeSquat(input);
  assert.equal(duplicate.frames[15].valid, false);
  assert.equal(duplicate.frames[15].angle, null);
  assert.equal(duplicate.reps.length, 0);
  input.frames[15].time = NaN;
  assert.equal(analyzeSquat(input).frames[15].valid, false);
});

check('Range comparison requires at least four same-segment reps; only measured later change is described', () => {
  const tooFew = analyzeSquat(clip(repetitions([85, 100, 110])));
  assert.equal(tooFew.observations.length, 1);
  const decreasing = analyzeSquat(clip(repetitions([85, 85, 110, 110])));
  assert.equal(decreasing.reps.length, 4);
  assert(decreasing.observations.some(observation => observation.id === 'later-range'));
  assert.deepEqual(decreasing.observations.find(observation => observation.id === 'later-range').repIndexes, [3, 4]);
  const similar = analyzeSquat(clip(repetitions([90, 90, 92, 91])));
  assert(similar.observations.some(observation => observation.id === 'similar-range'));
  const split = clip(repetitions([90, 90, 90, 90]));
  split.frames.find(frame => frame.time === 5.3).poses = [];
  const separated = analyzeSquat(split);
  assert.equal(separated.reps.length, 4);
  assert.equal(separated.observations.length, 1);
});

check('Input poses stay immutable; overlay output owns separate landmark objects', () => {
  const input = clip(cycle);
  const original = structuredClone(input);
  const freeze = object => { Object.freeze(object); Object.values(object).forEach(value => { if (value && typeof value === 'object' && !Object.isFrozen(value)) freeze(value); }); };
  freeze(input);
  const output = analyzeSquat(input);
  assert.deepEqual(input, original);
  output.frames[0].landmarks[11].x = 0;
  assert.equal(input.frames[0].poses[0][11].x, original.frames[0].poses[0][11].x);
});

console.log(`\n${passed} deterministic squat checks passed. These synthetic tests verify geometry and segmentation, not real-world or clinical accuracy.`);
console.log(`Experimental settings: ${JSON.stringify(SQUAT_LIMITS)}`);
