import {initialExercises} from './data';
import {buildRecommendedPlan,coachingExercises} from './training-recommendations';
import type {Exercise,Preferences,Routine} from './types';

export const isRecommendedRoutine=(routine:Routine)=>routine.id==='form-recommended'||routine.id.startsWith('form-recommended-');
export function coachingExercisePool(exercises:Exercise[]){
  const pool=new Map<string,Exercise>();
  for(const exercise of [...exercises,...initialExercises,...coachingExercises])if(!pool.has(exercise.id))pool.set(exercise.id,exercise);
  return [...pool.values()];
}
export function prepareCoachingPlan(preferences:Preferences,routines:Routine[],exercises:Exercise[]){
  const pool=coachingExercisePool(exercises);
  const plan=buildRecommendedPlan(preferences,pool);
  const required=new Set([...exercises.map(item=>item.id),...plan.routines.flatMap(routine=>routine.exercises.map(item=>item.exerciseId))]);
  return {plan,routines:[...plan.routines,...routines.filter(routine=>!isRecommendedRoutine(routine))],exercises:pool.filter(exercise=>required.has(exercise.id))};
}
