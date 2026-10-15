import {ArrowRight,Settings2,Sparkles} from 'lucide-react';
import type {buildRecommendedPlan} from './training-recommendations';
import type {Exercise} from './types';
import './coach-plan.css';
type Plan=ReturnType<typeof buildRecommendedPlan>;
export default function CoachPlanOverview({plan,exercises,onEdit,onUse}:{plan:Plan;exercises:Exercise[];onEdit:()=>void;onUse:()=>void}){
  return <section className="panel coach-plan" aria-labelledby="coach-plan-heading">
    <div className="coach-plan-heading"><span className="coach-plan-icon"><Sparkles size={23}/></span><div><p className="eyebrow">BUILT FROM YOUR ANSWERS</p><h2 id="coach-plan-heading">Your training blueprint.</h2><p className="muted">{plan.summary}</p></div></div>
    <div className="coach-plan-days">{plan.routines.map((routine,index)=><article className="coach-plan-day" key={routine.id}><span className="eyebrow">SESSION {index+1}</span><h3>{routine.name.replace('Recommended · ','')}</h3><p className="muted">{routine.description}</p><ul>{routine.exercises.map(item=>{const exercise=exercises.find(candidate=>candidate.id===item.exerciseId);return <li key={item.exerciseId}><span>{exercise?.name||item.exerciseId}</span><small>{item.sets} × {item.reps} · {item.rest}s rest</small></li>})}</ul></article>)}</div>
    <div className="coach-plan-reason"><h3>Why this fits you</h3><ul>{plan.rationale.map(reason=><li key={reason}>{reason}</li>)}</ul></div>
    {plan.warnings.length>0&&<div className="coach-plan-adjustments" role="status"><strong>Plan adjustments</strong>{plan.warnings.map(warning=><p key={warning}>{warning}</p>)}</div>}
    <div className="coach-plan-actions"><button className="btn secondary" onClick={onEdit}><Settings2 size={16}/>Change my goals & needs</button><button className="btn primary" disabled={!plan.routines.some(routine=>routine.exercises.length)} onClick={onUse}>Use this plan<ArrowRight size={17}/></button></div>
    <p className="small muted">A starting plan based on your answers. Applying it replaces your recommended sessions, including edits to them. Duplicate a routine in Train first to keep it; your other routines stay saved.</p>
  </section>;
}
