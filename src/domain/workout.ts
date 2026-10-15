import {uid,type Exercise,type HistoryEntry,type Routine,type Session} from '../types';

export function parseRepRange(value:string){
  const numbers=value.match(/\d+/g)?.map(Number).filter(Number.isFinite)||[];
  const min=Math.max(1,numbers[0]||8);
  return {min,max:Math.max(min,numbers[1]||min)};
}

export function getProgressionCue(repsSpec:string,targetSets:number,previous:HistoryEntry['exercises'][number]['sets']|undefined,units:'kg'|'lb',equipment:string){
  const completed=previous?.filter(set=>set.done);
  if(!completed?.length)return '';
  if(completed.length<targetSets)return `Previous session was partial · Keep the load steady and build toward ${targetSets} sets.`;
  const {max}=parseRepRange(repsSpec);
  const allAtTop=completed.every(set=>set.reps>=max);
  if(allAtTop){
    if(equipment==='Bodyweight'&&completed.every(set=>set.weight===0))return `Target reached last time · Try ${max+1} reps or a harder variation.`;
    return `Target reached last time · Consider +${units==='lb'?5:2.5} ${units}.`;
  }
  const best=Math.max(...completed.map(set=>set.reps));
  return `Build the range · Try ${Math.min(max,best+1)} reps with the same load.`;
}

export function selectNextRoutine(routines:Routine[],history:HistoryEntry[]){
  if(!routines.length)return undefined;
  const latest=[...history]
    .filter(entry=>!entry.sample)
    .sort((a,b)=>(b.completedAt||b.date).localeCompare(a.completedAt||a.date))
    .find(entry=>routines.some(routine=>routine.id===entry.routineId||(!entry.routineId&&routine.name===entry.name)));
  if(!latest)return routines[0];
  const index=routines.findIndex(routine=>routine.id===latest.routineId||(!latest.routineId&&routine.name===latest.name));
  return routines[(index+1)%routines.length]||routines[0];
}

export function createWorkoutSession(
  routine:Routine,
  exercises:Exercise[],
  history:HistoryEntry[],
  now=Date.now(),
  idFactory=uid,
):Session{
  const logs:Session['logs']={};
  routine.exercises.forEach(item=>{
    const exercise=exercises.find(candidate=>candidate.id===item.exerciseId);
    const matches=(completed:HistoryEntry['exercises'][number])=>completed.exerciseId===item.exerciseId||(!completed.exerciseId&&completed.name===exercise?.name);
    const ordered=[...history].sort((a,b)=>(b.completedAt||b.date).localeCompare(a.completedAt||a.date));
    const previous=(ordered.find(entry=>!entry.sample&&entry.exercises.some(matches))||ordered.find(entry=>entry.exercises.some(matches)))
      ?.exercises.find(matches)?.sets;
    const routineReps=parseInt(item.reps)||8;
    logs[item.exerciseId]=Array.from({length:item.sets},(_,index)=>{
      const exact=previous?.[index];
      return {
        id:idFactory(),
        weight:exact?.weight??previous?.at(-1)?.weight??0,
        reps:exact?.reps??routineReps,
        done:false,
      };
    });
  });

  return {
    id:idFactory(),
    routineId:routine.id,
    name:routine.name,
    startedAt:now,
    current:0,
    exercises:routine.exercises.map(item=>({...item})),
    logs,
    notes:{},
    skipped:[],
    feedback:false,
  };
}

export function createHistoryEntry(
  session:Session,
  exercises:Exercise[],
  now=Date.now(),
  date=new Date(now).toLocaleDateString('en-CA'),
):HistoryEntry{
  const completed=Object.values(session.logs).flat().filter(set=>set.done);
  return {
    id:session.id,
    routineId:session.routineId,
    name:session.name,
    date,
    completedAt:new Date(now).toISOString(),
    duration:(()=>{const raw=Math.max(1,Math.round((now-session.startedAt)/60000));return raw>180?Math.min(raw,Math.max(15,completed.length*4)):raw})(),
    sets:completed.length,
    volume:completed.reduce((total,set)=>total+set.weight*set.reps,0),
    feedback:session.feedback,
    feedbackExerciseId:session.feedbackExerciseId,
    feedbackKind:session.feedbackKind,
    exercises:session.exercises
      .map(item=>({
        exerciseId:item.exerciseId,
        name:exercises.find(exercise=>exercise.id===item.exerciseId)?.name||'Exercise',
        notes:session.notes[item.exerciseId]?.trim()||undefined,
        sets:(session.logs[item.exerciseId]||[]).filter(set=>set.done),
      }))
      .filter(exercise=>exercise.sets.length),
  };
}
