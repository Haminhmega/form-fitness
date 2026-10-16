import './coach-plan.css';
import type {Exercise,Routine} from './types';
import {buildWarmup,estimateRoutineMinutes} from './training-recommendations';

export function SessionTiming({routine,exercises,target}:{routine:Routine;exercises:Exercise[];target:number}){
  const total=estimateRoutineMinutes(routine,exercises);
  if(routine.kind==='recovery')return <p className="coach-help">{total} easy minutes · deliberately shorter for recovery.</p>;
  const warmup=Math.ceil(buildWarmup(routine,exercises).reduce((sum,move)=>sum+move.seconds,0)/60);
  const short=target-total>=Math.max(10,target*.2);
  return <div className="coach-session-timing" aria-label="Session time breakdown">
    <strong>About {total} min planned <span>· {target} min target</span></strong>
    <p>{warmup} min warm-up + {Math.max(0,total-warmup)} min working sets, rest and setup.</p>
    {short&&<p className="coach-time-gap">Shorter than requested. Review this day’s explanation before applying the plan.</p>}
  </div>;
}
