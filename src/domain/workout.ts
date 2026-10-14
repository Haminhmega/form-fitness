import {uid,type Exercise,type HistoryEntry,type Routine,type Session} from '../types';

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
    const previous=history
      .find(entry=>entry.exercises.some(matches))
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
    name:session.name,
    date,
    duration:Math.max(1,Math.round((now-session.startedAt)/60000)),
    sets:completed.length,
    volume:completed.reduce((total,set)=>total+set.weight*set.reps,0),
    feedback:session.feedback,
    feedbackExerciseId:session.feedbackExerciseId,
    exercises:session.exercises
      .map(item=>({
        exerciseId:item.exerciseId,
        name:exercises.find(exercise=>exercise.id===item.exerciseId)?.name||'Exercise',
        sets:(session.logs[item.exerciseId]||[]).filter(set=>set.done),
      }))
      .filter(exercise=>exercise.sets.length),
  };
}
