import {useEffect,useMemo,useRef} from 'react';
import {Check,Clock3,CalendarDays,Dumbbell,Target} from 'lucide-react';
import type {Preferences} from './types';
import {equipmentOptions,experienceLevels,initialExercises,trainingDays,trainingGoals,currentTrainingGoal} from './data';
import {focusAreas,getCoaching,movementAvoidances,sessionDurationRange,sportFocusOptions,trainingStyles,type CoachingPreferences} from '../shared/coaching';
import {buildRecommendedPlan,coachingExercises,estimateRoutineMinutes} from './training-recommendations';
import './coaching.css';
import {SessionTiming} from './SessionTiming';
import {trainingDurationAdvice} from './training-duration';

export const coachingSteps=[
  {title:'What do you want to work toward?',description:'Pick your main goal. Then tell us where you want extra attention.'},
  {title:'Make training feel like you.',description:'Your experience and movement preferences shape what goes into your plan.'},
  {title:'Build around your real life.',description:'A useful plan fits your time, available equipment, and usual week.'},
  {title:'Here’s your starting plan.',description:'These recommendations reflect your answers. Every workout stays editable.'},
] as const;

const goalCopy:Record<string,{label:string;description:string}>={
  'Build muscle & strength':{label:'Build muscle & strength',description:'Build muscle (hypertrophy), develop an aesthetic physique, and get stronger. Choose muscle priorities below to tailor your plan.'},
  'Improve athleticism':{label:'Improve athleticism',description:'Build a strength base that supports movement and sport.'},
  'Build consistency':{label:'Build a lasting habit',description:'Keep sessions manageable and easier to repeat.'},
  'Improve fitness':{label:'Improve overall fitness',description:'Train the whole body with a steady, practical routine.'},
  'Lose weight':{label:'Lose weight',description:'Build a regular training habit that supports your goal. Scale changes aren’t promised.'},
};
const experienceCopy:Record<string,string>={
  'Getting started':'I’m new, returning after a long break, or still learning the movements.',
  'Some experience':'I train sometimes and know the main movements.',
  'Experienced':'I train regularly and can adjust my effort and technique.',
};
const styleCopy:Record<string,string>={Balanced:'A mix of styles', 'Free weights':'Dumbbells and barbells',Machines:'Guided machines and cables',Bodyweight:'Your body provides the resistance'};
function durationLabel(minutes:number){
  const hours=Math.floor(minutes/60),remainder=minutes%60;
  return hours?`${hours} ${hours===1?'hour':'hours'}${remainder?` ${remainder} minutes`:''}`:`${minutes} minutes`;
}

export function coachingStepError(step:number,preferences:Preferences):string{
  const coaching=getCoaching(preferences);
  if(step===0&&!trainingGoals.some(goal=>goal===currentTrainingGoal(preferences.goal)))return 'Choose the main goal you want your plan to support.';
  if(step===0&&coaching.focusAreas.length>3)return 'Choose up to three muscle priorities.';
  if(step===1&&!experienceLevels.some(level=>level===preferences.experience))return 'Choose the experience level that fits you today.';
  if(step===2&&!preferences.days.some(day=>trainingDays.some(value=>value===day)))return 'Choose at least one available training day.';
  return '';
}

function Choice({label,description,selected,onClick,disabled=false}:{label:string;description?:string;selected:boolean;onClick:()=>void;disabled?:boolean}){
  return <button type="button" className={'coach-choice'+(selected?' is-selected':'')} aria-pressed={selected} disabled={disabled} onClick={onClick}><span><strong>{label}</strong>{description&&<small>{description}</small>}</span><span className="coach-check" aria-hidden="true">{selected&&<Check size={15}/>}</span></button>;
}

export default function CoachingIntake({step,preferences,onChange,age}:{age?:number|null;step:number;preferences:Preferences;onChange:(preferences:Preferences)=>void}){
  const coaching=getCoaching(preferences);
  const timeAdvice=trainingDurationAdvice(preferences,age);
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{heading.current?.focus()},[step]);
  function changeCoaching(changes:Partial<CoachingPreferences>){onChange({...preferences,coaching:{...coaching,...changes}})}
  function changePreferences(changes:Partial<Preferences>){onChange({...preferences,coaching,...changes})}
  const title=coachingSteps[step]||coachingSteps[0];
  return <section className="coaching-intake" aria-labelledby="coaching-step-heading">
    <h2 id="coaching-step-heading" ref={heading} tabIndex={-1}>{title.title}</h2>
    <p className="coach-intro">{title.description}</p>
    {step===0&&<>
      <fieldset className="coach-fieldset"><legend>Main training goal</legend><div className="coach-goals">{trainingGoals.map(goal=><Choice key={goal} label={goalCopy[goal].label} description={goalCopy[goal].description} selected={currentTrainingGoal(preferences.goal)===goal} onClick={()=>changePreferences({goal})}/>)}</div></fieldset>
      <fieldset className="coach-fieldset"><legend>Muscle priorities <span>Optional · choose up to 3</span></legend><p className="coach-help" id="coach-focus-help">Your main goal already guides the plan. Add areas you want to emphasize, or leave these open for balanced training.</p><div className="coach-chips" aria-describedby="coach-focus-help">{focusAreas.map(area=><button type="button" key={area} aria-pressed={coaching.focusAreas.includes(area)} disabled={!coaching.focusAreas.includes(area)&&coaching.focusAreas.length>=3} onClick={()=>changeCoaching({focusAreas:coaching.focusAreas.includes(area)?coaching.focusAreas.filter(value=>value!==area):[...coaching.focusAreas,area]})}>{coaching.focusAreas.includes(area)&&<Check size={14} aria-hidden="true"/>}{area}</button>)}</div><p className="coach-selection-note" aria-live="polite">{coaching.focusAreas.length} of 3 selected. Every goal is available to everyone.</p></fieldset>
      {preferences.goal==='Improve athleticism'&&<fieldset className="coach-fieldset"><legend>What are you training for?</legend><div className="coach-options">{sportFocusOptions.map(value=><Choice key={value} label={value} selected={coaching.sportFocus===value} onClick={()=>changeCoaching({sportFocus:value})}/>)}</div><p className="coach-help">This creates supporting strength sessions. Sport practice and skill coaching are separate.</p></fieldset>}
    </>}
    {step===1&&<>
      <fieldset className="coach-fieldset"><legend>Your experience today</legend><div className="coach-options">{experienceLevels.map(value=><Choice key={value} label={value} description={experienceCopy[value]} selected={preferences.experience===value} onClick={()=>changePreferences({experience:value})}/>)}</div></fieldset>
      <fieldset className="coach-fieldset"><legend>How do you like to train? <span>Select all you enjoy · keep at least one</span></legend><div className="coach-options two coach-style-options">{trainingStyles.map(value=><Choice key={value} label={value} description={styleCopy[value]} selected={coaching.trainingStyles.includes(value)} disabled={coaching.trainingStyles.length===1&&coaching.trainingStyles.includes(value)} onClick={()=>{const chosen=coaching.trainingStyles.includes(value)?coaching.trainingStyles.filter(style=>style!==value):[...coaching.trainingStyles,value];if(chosen.length)changeCoaching({trainingStyles:chosen,trainingStyle:chosen[0]})}}/>)}</div><p className="coach-help">Choose any combination; we use the equipment you have. Choose Bodyweight on its own for a bodyweight-only plan, or combine it with weights and machines.</p></fieldset>
      <fieldset className="coach-fieldset"><legend>Movements to leave out <span>Optional</span></legend><div className="coach-chips">{movementAvoidances.map(value=><button type="button" key={value} aria-pressed={coaching.avoidMovements.includes(value)} onClick={()=>changeCoaching({avoidMovements:coaching.avoidMovements.includes(value)?coaching.avoidMovements.filter(item=>item!==value):[...coaching.avoidMovements,value]})}>{coaching.avoidMovements.includes(value)&&<Check size={14} aria-hidden="true"/>}{value}</button>)}</div><p className="coach-help">Jumping means hops, jumps, and similar drills. All current starter plans already avoid jumping; this saves your preference for future suggestions.</p><p className="coach-help">These are movement preferences, not an injury assessment. If a movement hurts, stop and get individual advice before continuing.</p></fieldset>
    </>}
    {step===2&&<>
      <div className="coach-fieldset coach-duration"><label className="coach-duration-label" htmlFor="coach-session-duration">Time for a typical workout</label><div className="coach-time-advice"><strong>Suggested starting range: 60–90 minutes</strong><p>Enough room for a balanced session—not a minimum needed for results. Shorter workouts can be effective too.</p><p>{timeAdvice.context}</p><div className="coach-chips">{timeAdvice.range.map(minutes=><button type="button" key={minutes} aria-pressed={coaching.sessionMinutes===minutes} onClick={()=>changeCoaching({sessionMinutes:minutes})}>Use {minutes} min</button>)}</div></div><div className="coach-duration-card"><output htmlFor="coach-session-duration" className="coach-duration-value"><strong>{coaching.sessionMinutes}<span> min</span></strong><span>{coaching.sessionMinutes>=60?durationLabel(coaching.sessionMinutes):'Your available training time'}</span></output><input id="coach-session-duration" type="range" min={sessionDurationRange.min} max={sessionDurationRange.max} step={sessionDurationRange.step} value={coaching.sessionMinutes} aria-valuetext={durationLabel(coaching.sessionMinutes)} aria-describedby="coach-duration-help" onChange={event=>changeCoaching({sessionMinutes:Number(event.target.value)})}/><div className="coach-duration-ends" aria-hidden="true"><span>10 min</span><span>2 hours</span></div></div><p className="coach-help" id="coach-duration-help">Adjust in 5-minute steps. Your target includes warm-up sets, working sets, rest and equipment setup. Significant gaps will be shown before you apply the plan.</p><p className="coach-help" aria-live="polite">{timeAdvice.selected}</p>{timeAdvice.frequency&&<p className="coach-help">{timeAdvice.frequency}</p>}</div>
      <fieldset className="coach-fieldset"><legend>Available training days</legend><p className="coach-help"><strong>Recommended: at least 3 days per week.</strong> Start with 3 days, then add days to suit your experience and recovery. Choose fewer if that fits your week.</p><div className="coach-days">{trainingDays.map(day=><button type="button" key={day} aria-pressed={preferences.days.includes(day)} onClick={()=>changePreferences({days:preferences.days.includes(day)?preferences.days.filter(value=>value!==day):[...preferences.days,day]})}>{day}</button>)}</div><p className="coach-help">Choose every day you want to train. We spread the work across these days and include recovery activity when needed.</p></fieldset>
      <fieldset className="coach-fieldset"><legend>Equipment you can use</legend><div className="coach-options two">{equipmentOptions.map(value=><Choice key={value} label={value==='Bands'?'Resistance bands':value} description={value==='Bodyweight'?'Always included; no weights needed.':undefined} selected={value==='Bodyweight'||preferences.equipment.includes(value)} disabled={value==='Bodyweight'} onClick={()=>changePreferences({equipment:preferences.equipment.includes(value)?preferences.equipment.filter(item=>item!==value):[...preferences.equipment,value]})}/>)}</div></fieldset>
      <fieldset className="coach-fieldset"><legend>Your measurement units</legend><div className="coach-options two"><Choice label="Metric · cm / kg" selected={preferences.units==='kg'} onClick={()=>changePreferences({units:'kg'})}/><Choice label="Imperial · ft, in / lb" selected={preferences.units==='lb'} onClick={()=>changePreferences({units:'lb'})}/></div><p className="coach-help">Use the same units for your body measurements and workout loads. You can switch anytime.</p></fieldset>
    </>}
    {step===3&&<CoachingReview preferences={preferences} age={age}/>}
  </section>;
}

function CoachingReview({preferences,age}:{preferences:Preferences;age?:number|null}){
  const coaching=getCoaching(preferences);
  const exercises=[...initialExercises,...coachingExercises];
  const plan=useMemo(()=>buildRecommendedPlan(preferences,exercises,{age}),[preferences,age]);
  const exerciseNames=new Map(exercises.map(exercise=>[exercise.id,exercise.name]));
  return <div className="coach-review">
    <div className="coach-plan-lead"><Target size={24} aria-hidden="true"/><div><p className="eyebrow">BUILT FROM YOUR ANSWERS</p><h3>{goalCopy[currentTrainingGoal(preferences.goal)]?.label||preferences.goal}</h3><p>{plan.summary}</p></div></div>
    <dl className="coach-plan-facts"><div><dt><CalendarDays size={15} aria-hidden="true"/>Availability</dt><dd>{trainingDays.filter(day=>preferences.days.includes(day)).join(' · ')||'Choose a training day'}</dd></div><div><dt><Clock3 size={15} aria-hidden="true"/>Session target</dt><dd>{durationLabel(coaching.sessionMinutes)}</dd></div><div><dt><Dumbbell size={15} aria-hidden="true"/>Training styles</dt><dd>{coaching.trainingStyles.join(' · ')}</dd></div><div><dt><Target size={15} aria-hidden="true"/>Extra focus</dt><dd>{coaching.focusAreas.join(', ')||'Balanced with your goal'}</dd></div></dl>
    <div className="coach-plan-sessions"><h3>Your recommended sessions</h3>{plan.routines.map((routine,index)=><details key={routine.id} open={index===0}><summary><span>{routine.name}</span><small>{routine.kind==='recovery'?`${routine.recovery?.minutes||10} min · recovery`:`${routine.exercises.length} exercises · ~${estimateRoutineMinutes(routine,exercises)} min`}</small></summary><SessionTiming routine={routine} exercises={exercises} target={plan.targetMinutes}/><p>{routine.description}</p>{routine.kind==='recovery'&&<ul>{routine.recovery?.steps.map(step=><li key={step}>{step}</li>)}</ul>}<ol>{routine.exercises.map(item=><li key={item.exerciseId}><strong>{exerciseNames.get(item.exerciseId)||item.exerciseId}</strong><span>{item.sets} sets · {item.reps}{/sec/i.test(item.reps)?'':' reps'} · {item.rest}s rest</span></li>)}</ol></details>)}</div>
    <details className="coach-reasons"><summary>Why this plan fits</summary><ul>{plan.rationale.map((reason,index)=><li key={index}>{reason}</li>)}</ul></details>
    {plan.warnings.length>0&&<div className="coach-plan-notes"><h3>To make this work</h3><ul>{plan.warnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul></div>}
    <p className="coach-help">Applying this plan replaces your existing recommended sessions, including edits to them. Duplicate a recommended routine in Train first if you want to keep it. Your other routines stay saved.</p>
    <p className="coach-help">Planned sessions take up to about {plan.estimatedMinutes} minutes. Your pace, setup, and recovery change the actual time. Start at a manageable effort; adjust the plan as you learn what works for you.</p>
  </div>;
}
