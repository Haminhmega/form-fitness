import type {CoachingPreferences} from '../shared/coaching';
export type SupportLevel = 'real_ai'|'experimental_ai'|'illustrative_only'|'logging_only';
export type Exercise = { id:string; name:string; muscle:string; equipment:string; supported:boolean; supportLevel?:SupportLevel; instructions:string; variation:string; filming:string; custom?:boolean; catalog?:boolean; level?:string|null; category?:string|null; rating?:number|null; source?:string };
export type RoutineExercise = { exerciseId:string; sets:number; reps:string; rest:number; notes:string };
export type TrainingDay='Mon'|'Tue'|'Wed'|'Thu'|'Fri'|'Sat'|'Sun';
export type RecoveryPlan = {minutes:number;steps:string[]};
export type Routine = { id:string; name:string; description:string; exercises:RoutineExercise[];kind?:'recovery';scheduledDay?:TrainingDay;recovery?:RecoveryPlan };
export type SetLog = { id:string; weight:number; reps:number; done:boolean };
export type Session = { id:string; routineId:string; name:string; startedAt:number; current:number; exercises:RoutineExercise[]; logs:Record<string,SetLog[]>; notes:Record<string,string>; skipped:string[]; feedback:boolean; warmupComplete?:boolean; feedbackExerciseId?:string; feedbackKind?:'analysis'|'sample';kind?:'recovery';scheduledDay?:TrainingDay;recovery?:RecoveryPlan };
export type HistoryEntry = { id:string; routineId?:string; name:string; date:string; completedAt?:string; duration:number; sets:number; volume:number; feedback:boolean; exercises:{exerciseId?:string; name:string; notes?:string; sets:SetLog[]}[]; sample?:boolean; feedbackExerciseId?:string; feedbackKind?:'analysis'|'sample';kind?:'recovery' };
export type Preferences = { units:'kg'|'lb'; notifications:boolean; cloud:boolean; contribute:boolean; retention:string; goal:string; experience:string; equipment:string[]; days:string[]; onboarded:boolean; firstTime:boolean; coaching?:CoachingPreferences };
export type ToastFn = (message:string, undo?:()=>void)=>void;
export const uid = () => crypto.randomUUID();

