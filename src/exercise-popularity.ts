import type {Exercise} from './types';

export type ExerciseSort = 'popular' | 'name-asc' | 'name-desc';

// Editorial ordering of familiar gym staples. Dataset ratings and user activity
// are deliberately not used as evidence of exercise popularity.
export const popularExerciseIds = [
  'squat', 'pushup', 'gym-928-barbell-bench-press-medium-grip',
  'gym-1810-barbell-squat', 'gym-1292-barbell-deadlift',
  'gym-1473-lat-pull-down', 'gym-2067-leg-press', 'row',
  'gym-1105-dumbbell-bench-press', 'gym-1698-seated-cable-rows',
  'gym-1506-pull-up', 'press', 'rdl', 'gym-1215-barbell-hip-thrust',
  'curl', 'gym-2580-dumbbell-lateral-raise', 'gym-2838-triceps-pushdown',
  'plank', 'gym-1107-incline-dumbbell-bench-press',
  'gym-1874-goblet-squat', 'gym-2074-leg-extensions',
  'gym-1351-seated-leg-curl', 'gym-1348-lying-leg-curls',
  'gym-2038-dumbbell-bulgarian-split-squat', 'glute-bridge',
  'gym-1640-bent-over-barbell-row', 'gym-732-hammer-curls',
  'gym-887-standing-calf-raises', 'gym-2687-standing-face-pull',
  'reverse-lunge', 'gym-1075-cable-crossover', 'gym-1518-chin-up',
  'gym-1054-machine-chest-press', 'gym-1157-chest-dip',
  'gym-1305-romanian-deadlift', 'gym-888-seated-calf-raise',
  'gym-200-crunches', 'gym-195-hanging-leg-raise', 'hip-abduction',
  'gym-707-barbell-curl', 'gym-858-ez-bar-curl', 'gym-709-preacher-curl',
  'gym-1495-machine-seated-row', 'gym-2715-machine-shoulder-press',
  'gym-2450-military-press', 'gym-2842-cable-overhead-triceps-extension',
  'gym-2798-dumbbell-skullcrusher', 'gym-1811-barbell-front-squat',
  'gym-1918-dumbbell-reverse-lunge', 'gym-2073-smith-machine-back-squat',
  'gym-185-elbow-plank', 'gym-389-side-plank', 'gym-2193-wall-sit',
  'gym-932-barbell-incline-bench-press-medium-grip',
  'gym-1052-smith-machine-bench-press', 'gym-927-close-grip-bench-press',
  'gym-1670-incline-dumbbell-row', 'gym-1494-reverse-grip-lat-pull-down',
  'gym-819-standing-biceps-cable-curl', 'gym-734-concentration-curl',
  'gym-1916-dumbbell-squat', 'gym-1920-dumbbell-sumo-squat',
  'gym-2133-bodyweight-walking-lunge', 'gym-2001-hex-bar-deadlift',
] as const;

const rank = new Map<string, number>(popularExerciseIds.map((id, index) => [id, index]));
const byName = new Intl.Collator('en', {sensitivity: 'base', numeric: true});

// Planner variants keep their own identities and equipment requirements.
// These are editorial familiarity preferences, not usage statistics.
const familiarPlannerVariants = new Set([
  'coach-dumbbell-goblet-squat','coach-leg-extension','coach-hammer-curl',
  'coach-cable-pushdown','coach-incline-dumbbell-press','coach-barbell-rdl',
  'coach-machine-hip-abduction','gym-909-standing-calf-raise',
  'gym-961-incline-push-up','gym-1942-dumbbell-split-squat',
]);
const accessibleStaples = new Set([
  'coach-dumbbell-goblet-squat','gym-1105-dumbbell-bench-press','row','rdl',
  'press','plank','curl','gym-1473-lat-pull-down','gym-2067-leg-press',
]);
export function familiarExerciseScore(id:string):number {
  return accessibleStaples.has(id)?12:rank.has(id)||familiarPlannerVariants.has(id)?10:0;
}

export function sortExercises(exercises: readonly Exercise[], sort: ExerciseSort): Exercise[] {
  return [...exercises].sort((a, b) => {
    if (sort === 'popular') {
      const popularity = (rank.get(a.id) ?? popularExerciseIds.length) - (rank.get(b.id) ?? popularExerciseIds.length);
      if (popularity) return popularity;
    }
    const nameOrder = byName.compare(a.name, b.name) || a.id.localeCompare(b.id, 'en');
    return sort === 'name-desc' ? -nameOrder : nameOrder;
  });
}
