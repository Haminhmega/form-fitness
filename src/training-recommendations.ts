import type {Exercise,Preferences,Routine,RoutineExercise} from './types';
import {isTimedExercise} from './exercise-logging';

export type WarmupMove={name:string;dose:string;target:string;cue:string};

const beginner=(preferences:Preferences)=>preferences.experience==='Getting started';
const goalKey=(goal:string)=>goal.toLowerCase();

export function recommendedPrescription(preferences:Preferences,exercise:Exercise):RoutineExercise{
  const goal=goalKey(preferences.goal);
  const isHold=isTimedExercise(exercise);
  if(beginner(preferences))return {exerciseId:exercise.id,sets:2,reps:isHold?'20–30 sec':'10–15',rest:60,notes:'Use a light, controlled effort. Stop each set while your technique still feels repeatable.'};
  if(/strength/.test(goal))return {exerciseId:exercise.id,sets:4,reps:isHold?'30–45 sec':'5–8',rest:120,notes:'Use a challenging load while keeping every rep controlled.'};
  if(/muscle|glute|upper body/.test(goal))return {exerciseId:exercise.id,sets:3,reps:isHold?'30–45 sec':'8–12',rest:90,notes:'Finish with a few good reps still available; add load only after the range feels consistent.'};
  if(/fitness|weight/.test(goal))return {exerciseId:exercise.id,sets:3,reps:isHold?'30 sec':'12–15',rest:60,notes:'Keep a steady pace and choose a load that preserves your range of motion.'};
  return {exerciseId:exercise.id,sets:3,reps:isHold?'30 sec':'10–12',rest:75,notes:'Use smooth, repeatable reps and finish each set with control.'};
}

const plans:Record<string,{name:string;description:string;ids:string[]}>= {
  glutes:{name:'Recommended · Glute focus',description:'Glutes first, with balanced leg and core work.',ids:['glute-bridge','rdl','reverse-lunge','hip-abduction','plank']},
  upper:{name:'Recommended · Upper body',description:'A balanced push, pull, shoulder, and arm session.',ids:['pushup','row','press','curl','plank']},
  strength:{name:'Recommended · Strength base',description:'Foundational movements with longer recovery between sets.',ids:['squat','rdl','pushup','row','press']},
  basics:{name:'Recommended · Technique day',description:'Higher-rep practice with simple movements and room to learn.',ids:['squat','glute-bridge','pushup','row','plank']},
  fitness:{name:'Recommended · Full-body fitness',description:'A steady full-body session with manageable rest periods.',ids:['squat','pushup','row','reverse-lunge','plank']},
  muscle:{name:'Recommended · Muscle building',description:'A balanced hypertrophy session for the major muscle groups.',ids:['squat','rdl','pushup','row','press','curl']},
};

function planFor(preferences:Preferences){
  const goal=goalKey(preferences.goal);
  if(/glute|butt/.test(goal))return plans.glutes;
  if(/upper body/.test(goal))return plans.upper;
  if(/strength/.test(goal))return plans.strength;
  if(/learn|basic/.test(goal)||beginner(preferences))return plans.basics;
  if(/muscle/.test(goal))return plans.muscle;
  return plans.fitness;
}

export function buildRecommendedRoutine(preferences:Preferences,exercises:Exercise[]):Routine{
  const plan=planFor(preferences);
  const available=new Map(exercises.map(exercise=>[exercise.id,exercise]));
  const allowed=(exercise:Exercise)=>exercise.equipment==='Bodyweight'||preferences.equipment.some(value=>{
    const selected=value.toLowerCase().replace(/s$/,'');
    const needed=exercise.equipment.toLowerCase().replace(/s$/,'');
    return selected===needed||selected==='machine'&&needed==='machine';
  });
  const preferred=plan.ids.map(id=>available.get(id)).filter((exercise):exercise is Exercise=>!!exercise&&allowed(exercise));
  const chosen=[...preferred];
  for(const exercise of exercises){if(chosen.length>=5)break;if(allowed(exercise)&&!chosen.some(item=>item.id===exercise.id)&&!exercise.catalog)chosen.push(exercise);}
  return {
    id:'form-recommended',
    name:plan.name,
    description:`${plan.description} Built for ${preferences.experience.toLowerCase()} · ${preferences.goal.toLowerCase()}.`,
    exercises:chosen.map(exercise=>recommendedPrescription(preferences,exercise)),
  };
}

export function recommendationSummary(preferences:Preferences){
  if(beginner(preferences))return 'Technique-first · 10–15 controlled reps · about 60 sec rest';
  const goal=goalKey(preferences.goal);
  if(/strength/.test(goal))return 'Strength focus · 5–8 reps · about 2 min rest';
  if(/muscle|glute|upper body/.test(goal))return 'Muscle focus · 8–12 reps · about 90 sec rest';
  return 'Steady conditioning · 10–15 reps · 60–75 sec rest';
}

const warmups:Record<string,WarmupMove>={
  glutes:{name:'Glute bridge primer',dose:'12 controlled reps',target:'Glutes',cue:'Pause briefly at the top without arching your lower back.'},
  legs:{name:'Squat to stand',dose:'8 slow reps',target:'Legs',cue:'Use a comfortable depth and keep your whole foot grounded.'},
  chest:{name:'Wall push-up',dose:'10 easy reps',target:'Chest',cue:'Keep one straight line from head to heel.'},
  back:{name:'Standing reach and row',dose:'10 reps',target:'Back',cue:'Reach forward, then draw the elbows back and squeeze gently.'},
  shoulders:{name:'Arm circles',dose:'30 sec each way',target:'Shoulders',cue:'Start small and gradually widen the circle.'},
  arms:{name:'Easy curl and press',dose:'8 reps',target:'Arms',cue:'Use no load or a very light load and move through a relaxed range.'},
  core:{name:'Dead bug brace',dose:'6 reps per side',target:'Core',cue:'Exhale as you extend and keep the lower back comfortable.'},
};

function warmupKey(muscle:string){
  const value=muscle.toLowerCase();
  if(/glute|hip/.test(value))return 'glutes';
  if(/leg|quad|hamstring|calf/.test(value))return 'legs';
  if(/chest/.test(value))return 'chest';
  if(/back|lat|trap/.test(value))return 'back';
  if(/shoulder/.test(value))return 'shoulders';
  if(/arm|bicep|tricep|forearm/.test(value))return 'arms';
  return 'core';
}

export function buildWarmup(routine:Routine,exercises:Exercise[]):WarmupMove[]{
  const seen=new Set<string>();
  const targeted:WarmupMove[]=[];
  routine.exercises.forEach(item=>{
    const exercise=exercises.find(candidate=>candidate.id===item.exerciseId);
    if(!exercise)return;
    const key=warmupKey(exercise.muscle);
    if(!seen.has(key)){seen.add(key);targeted.push(warmups[key]);}
  });
  return [
    {name:'Raise your temperature',dose:'2 minutes',target:'Whole body',cue:'Walk briskly, march, or cycle at an easy pace.'},
    ...targeted.slice(0,3),
  ];
}

export function restReason(preferences:Preferences,seconds:number){
  if(beginner(preferences))return `${seconds}s supports technique practice without rushing the next set.`;
  if(/strength/i.test(preferences.goal))return `${seconds}s gives you more recovery for strong, controlled reps.`;
  if(/muscle|glute|upper body/i.test(preferences.goal))return `${seconds}s balances recovery with a muscle-building pace.`;
  return `${seconds}s keeps the session moving while giving you time to reset.`;
}
