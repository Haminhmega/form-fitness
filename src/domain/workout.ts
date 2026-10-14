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
    const previous=history
      .find(entry=>entry.exercises.some(completed=>completed.name===exercise?.name))
      ?.exercises.find(completed=>completed.name===exercise?.name)?.sets;
    const routineReps=parseInt(item.reps)||8;
    logs[item.exerciseId]=Array.from({length:item.sets},(_,index)=>({
      id:idFactory(),
      weight:previous?.[index]?.weight||0,
      reps:previous?.[index]?.reps||routineReps,
      done:false,
    }));
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
        name:exercises.find(exercise=>exercise.id===item.exerciseId)?.name||'Exercise',
        sets:(session.logs[item.exerciseId]||[]).filter(set=>set.done),
      }))
      .filter(exercise=>exercise.sets.length),
  };
}
