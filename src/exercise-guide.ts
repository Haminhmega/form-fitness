import type {Exercise} from './types';

const sentence=(value:string)=>value.match(/[^.!?]+[.!?]?/)?.[0]?.trim()||'';
const lower=(value:string)=>value.toLowerCase().replace(/\s+/g,' ').trim();

export function exerciseDescription(exercise:Exercise){
  const source=exercise.instructions.trim();
  if(!source||/^no movement description/i.test(source)||/^no instructions added/i.test(source)){
    const level=exercise.level?`${exercise.level.toLowerCase()} `:'';
    const category=lower(exercise.category||exercise.variation||'training');
    return `A ${level}${category} movement that focuses on the ${lower(exercise.muscle)} using ${lower(exercise.equipment)}.`;
  }
  const summary=sentence(source);
  return summary.length<=240?summary:`${summary.slice(0,237).trimEnd()}…`;
}

const setup=(exercise:Exercise)=>exercise.equipment==='Bodyweight'
  ? 'Clear enough space to move freely and choose a stable starting position.'
  : `Set up the ${lower(exercise.equipment)} and choose a resistance you can control.`;

export function exerciseSteps(exercise:Exercise){
  const name=lower(exercise.name);
  if(/stretch|mobility/.test(name)||/stretch/i.test(exercise.category||exercise.variation))return [
    setup(exercise),
    'Move slowly into the position until you feel gentle tension in the target area.',
    'Hold the position without bouncing and keep your breathing relaxed.',
    'Ease out of the stretch with control, then repeat on the other side when needed.'
  ];
  if(/squat|lunge|split squat|step[- ]?up|leg press/.test(name))return [
    setup(exercise),
    'Brace your torso, plant your feet firmly, and let your knees track in line with your toes.',
    'Lower under control through the hips and knees while keeping your balance over the whole foot.',
    'Drive through the floor to stand, finish tall, and reset before the next rep.'
  ];
  if(/deadlift|good morning|hip hinge|pull[- ]?through|swing/.test(name))return [
    setup(exercise),
    'Brace your core, soften the knees, and send the hips back while keeping a long, neutral spine.',
    'Keep the resistance close and move through the hips rather than rounding the back.',
    'Drive the hips forward, finish tall, and return to the start with the same control.'
  ];
  if(/row|pull[- ]?up|chin[- ]?up|pulldown|pull down/.test(name))return [
    setup(exercise),
    'Set your ribs and draw your shoulders gently down and back before you pull.',
    'Lead with the elbows and pull toward your torso without shrugging or swinging.',
    'Pause briefly, then lengthen the arms under control and reset your shoulder position.'
  ];
  if(/push[- ]?up|press|dip/.test(name))return [
    setup(exercise),
    'Brace your core and stack your wrists or handles in a stable pressing position.',
    'Lower with control while keeping the elbows on a comfortable path and the torso steady.',
    'Press smoothly to the start without locking out aggressively, then reset.'
  ];
  if(/curl/.test(name))return [
    setup(exercise),
    'Stand or sit tall with the upper arms steady and the wrists in a neutral position.',
    'Curl the resistance toward you without swinging the torso or letting the elbows drift.',
    'Squeeze briefly, then lower through the full comfortable range with control.'
  ];
  if(/extension|pushdown|push-down|skullcrusher|kick[- ]?back/.test(name)&&/tricep|skull|extension|push/.test(name))return [
    setup(exercise),
    'Brace your torso and keep the upper arms steady in a comfortable position.',
    'Extend the elbows smoothly until the triceps are working without forcing the joint.',
    'Return slowly, keep tension through the target muscle, and repeat without swinging.'
  ];
  if(/raise|fly|flye/.test(name))return [
    setup(exercise),
    'Set your shoulders, keep a soft bend in the elbows, and brace the torso.',
    'Lift the resistance along a comfortable arc without shrugging or using momentum.',
    'Pause near the top, then lower slowly until you return to the starting position.'
  ];
  if(/crunch|sit[- ]?up|plank|roll[- ]?out|leg raise/.test(name))return [
    setup(exercise),
    'Set your pelvis and ribs, then brace as if preparing for a gentle punch.',
    'Move through the intended range while keeping the neck relaxed and the lower back controlled.',
    'Exhale through the hardest part, return slowly, and reset your brace for the next rep.'
  ];
  if(/calf raise/.test(name))return [
    setup(exercise),
    'Plant the balls of your feet securely and keep the ankles, knees, and hips stacked.',
    'Rise onto the toes through the fullest comfortable range without bouncing.',
    'Pause at the top, then lower the heels slowly before beginning the next rep.'
  ];
  return [
    setup(exercise),
    `Take a stable position that lets you feel the ${lower(exercise.muscle)} working.`,
    `Perform ${exercise.name} through a comfortable range without using momentum.`,
    'Return to the start under control, breathe, and reset your position before the next rep.'
  ];
}

export type BodyRegion='neck'|'shoulders'|'chest'|'back'|'upper-arms'|'forearms'|'core'|'hips'|'thighs'|'calves';

export function bodyRegions(muscle:string):BodyRegion[]{
  const value=lower(muscle);
  if(/full body|other/.test(value))return ['shoulders','chest','back','upper-arms','core','hips','thighs','calves'];
  if(/neck/.test(value))return ['neck'];
  if(/trap|lat|back/.test(value))return ['back'];
  if(/shoulder|deltoid/.test(value))return ['shoulders'];
  if(/chest|pectoral/.test(value))return ['chest'];
  if(/bicep|tricep|arm/.test(value))return ['upper-arms'];
  if(/forearm|grip/.test(value))return ['forearms'];
  if(/abdominal|core|oblique/.test(value))return ['core'];
  if(/glute|hip/.test(value))return ['hips'];
  if(/quad|hamstring|adductor|abductor|leg/.test(value))return ['thighs'];
  if(/calf|calves/.test(value))return ['calves'];
  return ['core'];
}
