// Explicit logging metadata prevents dynamic plank variations from being
// mistaken for timed holds and keeps labels stable when an exercise is renamed.
const timedExercises = [
  {id: 'plank', name: 'Forearm plank'},
  {id: 'gym-185-elbow-plank', name: 'Elbow plank'},
  {id: 'gym-301-straight-arm-plank', name: 'Straight-arm plank'},
  {id: 'gym-389-side-plank', name: 'Side plank'},
  {id: 'gym-406-feet-elevated-bench-side-plank', name: 'Feet-elevated bench side plank'},
  {id: 'gym-2192-squat-isometric-hold', name: 'Squat Isometric Hold'},
  {id: 'gym-2193-wall-sit', name: 'Wall sit'},
  {id: 'gym-287-fyr-hollow-hold', name: 'FYR Hollow Hold'},
  {id: 'gym-369-hm-hollow-hold', name: 'HM Hollow Hold'},
] as const;
const timedIds = new Set<string>(timedExercises.map(exercise => exercise.id));
const legacyTimedNames = new Set<string>(timedExercises.map(exercise => exercise.name.toLowerCase()));

export function isTimedExercise(exercise: {id?: string; exerciseId?: string; name?: string}): boolean {
  const id = exercise.exerciseId || exercise.id;
  // Name fallback is only for old history records that predate exercise IDs.
  return id ? timedIds.has(id) : legacyTimedNames.has(exercise.name?.toLowerCase() || '');
}
