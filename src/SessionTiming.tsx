import './coach-plan.css';
import type {Exercise,Routine} from './types';
import {routineTiming} from './training-recommendations';

export function SessionTiming({routine,exercises,target}:{routine:Routine;exercises:Exercise[];target:number}){
  const timing=routineTiming(routine,exercises);
  const total=timing.totalMinutes;
  if(routine.kind==='recovery')return <p className="coach-help">{total} easy minutes · deliberately shorter for recovery.</p>;
  const warmup=Math.ceil(timing.warmupSeconds/60);
  const short=target-total>=Math.max(5,target*.1);
  return <div className="coach-session-timing" aria-label="Session time breakdown">
    <strong>About {total} min planned <span>· {target} min target</span></strong>
    <p>{routine.exercises.length} exercises · {timing.sets} working sets</p><p>Approx. {warmup} min warm-up · {Math.round(timing.workSeconds/60)} min lifting · {Math.round(timing.restSeconds/60)} min rest · {Math.round(timing.setupSeconds/60)} min setup. Components are rounded.</p>
    {short&&<p className="coach-time-gap">Shorter than requested. Review this day’s explanation before applying the plan.</p>}
  </div>;
}
