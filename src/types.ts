export type Exercise = { id:string; name:string; muscle:string; equipment:string; supported:boolean; instructions:string; variation:string; filming:string; custom?:boolean };
export type RoutineExercise = { exerciseId:string; sets:number; reps:string; rest:number; notes:string };
export type Routine = { id:string; name:string; description:string; exercises:RoutineExercise[] };
export type SetLog = { id:string; weight:number; reps:number; done:boolean };
export type Session = { id:string; routineId:string; name:string; startedAt:number; current:number; exercises:RoutineExercise[]; logs:Record<string,SetLog[]>; notes:Record<string,string>; skipped:string[]; feedback:boolean; feedbackExerciseId?:string };
export type HistoryEntry = { id:string; routineId?:string; name:string; date:string; duration:number; sets:number; volume:number; feedback:boolean; exercises:{exerciseId?:string; name:string; notes?:string; sets:SetLog[]}[]; sample?:boolean; feedbackExerciseId?:string };
export type Preferences = { units:'kg'|'lb'; notifications:boolean; cloud:boolean; contribute:boolean; retention:string; goal:string; experience:string; equipment:string[]; days:string[]; onboarded:boolean; firstTime:boolean };
export type ToastFn = (message:string, undo?:()=>void)=>void;
export const uid = () => crypto.randomUUID();

