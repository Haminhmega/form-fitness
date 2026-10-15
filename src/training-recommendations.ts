import type {Exercise,Preferences,Routine,RoutineExercise} from './types';
import {isTimedExercise} from './exercise-logging';
import {getCoaching} from '../shared/coaching';
import {coachingMovement,type CoachingMovement,type MovementPattern} from './coaching-exercises';
export {coachingExercises} from './coaching-exercises';

export type WarmupMove={name:string;dose:string;target:string;cue:string};
export type RecommendedPlan={routines:Routine[];rationale:string[];estimatedMinutes:number;summary:string;warnings:string[]};
const beginner=(preferences:Preferences)=>preferences.experience==='Getting started';
const goalKey=(goal:string)=>goal.toLowerCase();
const weekdays=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function goalType(preferences:Preferences){
  const goal=goalKey(preferences.goal);
  if(/glute|butt/.test(goal))return 'glutes';
  if(/athleti/.test(goal))return 'athletic';
  if(/strength/.test(goal))return 'strength';
  if(/upper body/.test(goal))return 'upper';
  if(/muscle|hypertrophy/.test(goal))return 'muscle';
  if(/learn|basic/.test(goal))return 'basics';
  return 'fitness';
}

export function recommendedPrescription(preferences:Preferences,exercise:Exercise):RoutineExercise{
  const goal=goalType(preferences);
  const isHold=isTimedExercise(exercise);
  const metadata=coachingMovement[exercise.id];
  const compound=metadata?!!metadata.compound:true;
  if(beginner(preferences))return {exerciseId:exercise.id,sets:2,reps:isHold?'20–30 sec':'10–15',rest:60,notes:'Use a light, controlled effort to learn the technique. Finish with 3–4 good reps still available; take longer rests whenever you need them.'};
  if(goal==='strength')return {exerciseId:exercise.id,sets:compound?4:3,reps:isHold?'20–40 sec':compound?'5–8':'10–15',rest:compound?150:90,notes:'Finish with 2–3 controlled reps still available. No maximal lifts: increase the smallest available load only after every set reaches the top of its range with repeatable technique.'};
  if(['muscle','glutes','upper'].includes(goal))return {exerciseId:exercise.id,sets:3,reps:isHold?'20–40 sec':compound?'8–12':'10–15',rest:compound?120:90,notes:'Finish with about 2 good reps still available. Build reps within this range first, then add the smallest available load when all sets feel controlled.'};
  if(goal==='athletic')return {exerciseId:exercise.id,sets:3,reps:isHold?'20–30 sec':compound?'6–10':'10–15',rest:compound?120:75,notes:'Practice balanced, controlled movement without rushing or training to failure. Add a rep before adding load; this is a general strength foundation for activity.'};
  return {exerciseId:exercise.id,sets:2,reps:isHold?'20–30 sec':'10–15',rest:75,notes:'Choose an effort you can repeat consistently. Add reps gradually while leaving 2–3 good reps available, and increase load only after the top of the range feels controlled.'};
}

function equipmentKey(equipment:string){
  const value=equipment.toLowerCase();
  if(/machine|cable/.test(value))return 'Machines';
  if(/band/.test(value))return 'Bands';
  if(/dumbbell/.test(value))return 'Dumbbells';
  if(/barbell/.test(value))return 'Barbell';
  return equipment;
}

// Only recommend movements with reviewed setup and exclusion metadata.
// Unknown custom/catalog movements remain available for manual routines.
function allowed(preferences:Preferences,exercise:Exercise,meta:CoachingMovement){
  const coaching=getCoaching(preferences);
  const equipment=equipmentKey(exercise.equipment);
  if(equipment!=='Bodyweight'&&!preferences.equipment.some(item=>equipmentKey(item)===equipment))return false;
  if(coaching.trainingStyle==='Bodyweight'&&equipment!=='Bodyweight')return false;
  if(beginner(preferences)&&meta.experienced)return false;
  if(coaching.avoidMovements.includes('Floor exercises')&&meta.floor)return false;
  if(coaching.avoidMovements.includes('Overhead pressing')&&meta.overhead)return false;
  if(coaching.avoidMovements.includes('Deep knee bends')&&meta.deepKnee)return false;
  // Every curated recommendation is grounded, with no jumping component.
  return true;
}

/** Pick the best-spaced subset of the days the person actually selected. */
function scheduleDays(preferences:Preferences){
  const available=weekdays.filter(day=>preferences.days.includes(day));
  if(!available.length)return [];
  const count=Math.min(available.length,beginner(preferences)?3:4);
  let best:string[]=[];
  let bestScore=-Infinity;
  function visit(start:number,chosen:string[]){
    if(chosen.length===count){
      const indices=chosen.map(day=>weekdays.indexOf(day));
      const gaps=indices.map((day,index)=>(indices[(index+1)%indices.length]-day+7)%7||7);
      const adjacent=gaps.filter(gap=>gap===1).length;
      const score=-adjacent*100-Math.max(...gaps)+Math.min(...gaps);
      if(score>bestScore){bestScore=score;best=[...chosen];}
      return;
    }
    for(let index=start;index<available.length;index++)visit(index+1,[...chosen,available[index]]);
  }
  visit(0,[]);
  return best;
}

const focusPattern:Record<string,MovementPattern>={Glutes:'glute',Legs:'squat',Back:'pull',Chest:'push',Shoulders:'shoulder',Arms:'arms',Core:'core'};
const titles={glutes:'Glute focus',athletic:'Athletic foundation',strength:'Strength base',upper:'Upper-body focus',muscle:'Muscle building',basics:'Technique practice',fitness:'Full-body consistency'};

function plannedPatterns(preferences:Preferences,day:number,totalDays:number):MovementPattern[]{
  const goal=goalType(preferences);
  const coaching=getCoaching(preferences);
  let patterns:MovementPattern[];
  if(totalDays===4){
    patterns=day%2===0?(day===0?['squat','hinge','glute','calf','core']:['hinge','squat','glute','core','calf']):(day===1?['push','pull','shoulder','arms','core']:['pull','push','shoulder','core','arms']);
    if(goal==='glutes'&&day%2===0)patterns=['glute',...patterns.filter(pattern=>pattern!=='glute')];
  }else if(goal==='glutes'){
    patterns=day%3===0?['glute','push','pull','hinge','core','squat']:day%3===1?['squat','pull','push','glute','core','shoulder']:['hinge','push','pull','glute','core','squat'];
  }else if(goal==='athletic'){
    patterns=day%2===0?['squat','pull','push','core','calf','hinge']:['hinge','push','pull','core','calf','squat'];
    if(coaching.sportFocus==='Running')patterns=[patterns[0],'calf','pull','push','core','hinge'];
  }else if(goal==='upper'){
    patterns=day%2===0?['push','pull','squat','shoulder','core','arms']:['pull','push','hinge','arms','core','shoulder'];
  }else{
    patterns=day%3===0?['squat','push','pull','hinge','core','shoulder']:day%3===1?['hinge','pull','push','squat','shoulder','core']:['squat','push','pull','glute','arms','core'];
  }
  const emphasis=coaching.focusAreas[day%Math.max(1,coaching.focusAreas.length)];
  const focus=focusPattern[emphasis];
  // Preserve the body region on a four-day upper/lower split.
  const compatible=totalDays!==4||((day%2===0)===['glute','squat','hinge','calf'].includes(focus));
  if(focus&&compatible)patterns=[focus,...patterns.filter(pattern=>pattern!==focus)];
  // Goal/focus overrides may repeat a pattern (running day B already hinges).
  // Spend the remaining time on a different movement, not a second variant.
  return [...new Set(patterns)];
}

function selectionScore(preferences:Preferences,exercise:Exercise,day:number,used:Map<string,number>){
  const coaching=getCoaching(preferences);
  const meta=coachingMovement[exercise.id];
  const equipment=equipmentKey(exercise.equipment);
  const goal=goalType(preferences);
  let score=0;
  if(coaching.trainingStyle==='Machines'&&equipment==='Machines')score+=24;
  if(coaching.trainingStyle==='Free weights'&&['Dumbbells','Barbell'].includes(equipment))score+=24;
  if(beginner(preferences)){
    if(['squat','glute-bridge','coach-wall-pushup','coach-standing-hip-hinge','coach-standing-march'].includes(exercise.id))score+=12;
    if(exercise.id==='pushup')score-=8;
  }else if(equipment!=='Bodyweight')score+=10;
  if(goal==='strength'&&meta.compound)score+=5;
  if(goal==='glutes'&&exercise.id==='glute-bridge'&&beginner(preferences))score+=8;
  if(goal==='athletic'&&meta.balance)score+=14;
  if(goal==='athletic'&&coaching.sportFocus==='Court and field sports'&&meta.unilateral)score+=4;
  if(coaching.focusAreas.some(area=>meta.areas.includes(area)))score+=4;
  if(coaching.impact==='Low impact'&&['coach-wall-pushup','coach-standing-march','coach-standing-hip-hinge'].includes(exercise.id))score+=3;
  score-=(used.get(exercise.id)||0)*9;
  if(day%2===1&&meta.unilateral)score+=3;
  return score;
}

function timeFor(item:RoutineExercise,exercise:Exercise){
  const meta=coachingMovement[exercise.id];
  const numbers=item.reps.match(/\d+/g)?.map(Number)||[10];
  const maximum=Math.max(...numbers);
  const work=isTimedExercise(exercise)?maximum:maximum*3;
  const perSet=work*(meta?.unilateral?2:1)+(meta?.unilateral?10:0);
  return item.sets*perSet+Math.max(0,item.sets-1)*item.rest+45;
}

export function estimateRoutineMinutes(routine:Routine,exercises:Exercise[]){
  if(!routine.exercises.length)return 0;
  const available=new Map(exercises.map(exercise=>[exercise.id,exercise]));
  // General warm-up plus short light rehearsal sets before loaded compounds.
  const rehearsal=routine.exercises.filter(item=>{
    const exercise=available.get(item.exerciseId);
    return exercise&&exercise.equipment!=='Bodyweight'&&coachingMovement[item.exerciseId]?.compound;
  }).slice(0,2).length*60;
  const seconds=240+rehearsal+routine.exercises.reduce((sum,item)=>{
    const exercise=available.get(item.exerciseId);
    return sum+(exercise?timeFor(item,exercise):0);
  },0);
  return Math.ceil(seconds/60);
}

function selectionReason(preferences:Preferences,exercise:Exercise){
  const meta=coachingMovement[exercise.id];
  const coaching=getCoaching(preferences);
  const goal=goalType(preferences);
  let why=goal==='glutes'&&meta.areas.includes('Glutes')?'Glute-focused work for your growth goal.':goal==='athletic'&&meta.balance?'Builds single-leg control and balance for your activity goal.':meta.pattern==='pull'?'Balances pressing work with back and pulling strength.':meta.pattern==='push'?'Keeps chest and pushing strength in your weekly plan.':meta.pattern==='core'?'Practices trunk control to support your other lifts.':`Builds ${meta.areas[0].toLowerCase()} strength in a balanced weekly plan.`;
  if(coaching.focusAreas.some(area=>meta.areas.includes(area)))why+=` Matches your ${coaching.focusAreas.filter(area=>meta.areas.includes(area)).join(' and ').toLowerCase()} priority.`;
  if(meta.unilateral)why+=' The rep range is per side; complete both sides.';
  return why;
}

export function buildRecommendedPlan(preferences:Preferences,exercises:Exercise[]):RecommendedPlan{
  const coaching=getCoaching(preferences);
  const goal=goalType(preferences);
  const warnings:string[]=[];
  const days=scheduleDays(preferences);
  const pool=[...new Map(exercises.map(exercise=>[exercise.id,exercise])).values()].filter(exercise=>{
    const meta=coachingMovement[exercise.id];
    return meta&&allowed(preferences,exercise,meta);
  });
  if(!days.length)warnings.push('Choose at least one available day to place this starter session in your week.');
  if(days.length===1)warnings.push('One day is a useful start. A second separated strength day can help you practice more consistently when your schedule allows.');
  const requested=weekdays.filter(day=>preferences.days.includes(day)).length;
  if(requested>days.length)warnings.push(`You selected ${requested} available days. Start with ${days.length} resistance sessions; keep the remaining days for recovery or easy activity.`);
  if(days.length>1&&days.some((day,index)=>((weekdays.indexOf(days[(index+1)%days.length])-weekdays.indexOf(day)+7)%7)===1))warnings.push(days.length===4?'Your four-day plan alternates lower and upper emphasis. The week includes adjacent days; add a rest day if fatigue affects your technique.':'Some selected days are consecutive. Move a session to leave a recovery day when possible, or keep the later session light if you are still tired.');
  const used=new Map<string,number>();
  const routines=(days.length?days:['Your day']).map((day,index):Routine=>{
    const patterns=plannedPatterns(preferences,index,days.length);
    const selected:Exercise[]=[];
    const maxExercises=coaching.sessionMinutes<=20?4:coaching.sessionMinutes<=30?5:beginner(preferences)?5:6;
    const routine:Routine={id:index===0?'form-recommended':`form-recommended-${index+1}`,name:`Recommended · ${titles[goal]} ${String.fromCharCode(65+index)}`,description:'',exercises:[]};
    for(const pattern of patterns){
      if(selected.length>=maxExercises)break;
      const candidates=pool.filter(exercise=>coachingMovement[exercise.id].pattern===pattern&&!selected.some(item=>item.id===exercise.id)).sort((a,b)=>selectionScore(preferences,b,index,used)-selectionScore(preferences,a,index,used));
      let choice:Exercise|undefined;
      let prescription:RoutineExercise|undefined;
      for(const exercise of candidates){
        const item=recommendedPrescription(preferences,exercise);
        // Budget the whole short session, rather than spending it on one lift.
        if(coaching.sessionMinutes===20)item.sets=2;
        else if(coaching.sessionMinutes===30)item.sets=Math.min(item.sets,3);
        const check={...routine,exercises:[...routine.exercises,item]};
        while(item.sets>2&&estimateRoutineMinutes(check,exercises)>coaching.sessionMinutes)item.sets--;
        if(estimateRoutineMinutes(check,exercises)<=coaching.sessionMinutes){choice=exercise;prescription=item;break;}
      }
      if(!choice||!prescription)continue;
      const defaultSets=recommendedPrescription(preferences,choice).sets;
      prescription.notes=`${selectionReason(preferences,choice)} ${prescription.notes}${prescription.sets<defaultSets?' Fewer sets keep this session within your time preference.':''}`;
      selected.push(choice);
      routine.exercises.push(prescription);
      used.set(choice.id,(used.get(choice.id)||0)+1);
    }
    const minutes=estimateRoutineMinutes(routine,exercises);
    const region=days.length===4?(index%2===0?'lower-body emphasis':'upper-body emphasis'):'full-body practice';
    routine.description=`${day} · ${region} · about ${minutes} min including warm-up and rests. Built for ${preferences.goal.toLowerCase()}, ${preferences.experience.toLowerCase()} and your available equipment. ${coaching.focusAreas.length?`Priority: ${coaching.focusAreas.join(', ')}.`:''}`.trim();
    if(routine.exercises.length<3)warnings.push(`${day}: your equipment, movement preferences and time allow only ${routine.exercises.length} matching exercise${routine.exercises.length===1?'':'s'}. This is a limited session; adjust your preferences or add suitable exercises with qualified guidance.`);
    return routine;
  });
  const weeklyPatterns=new Set(routines.flatMap(routine=>routine.exercises.map(item=>coachingMovement[item.exerciseId].pattern)));
  if(!weeklyPatterns.has('pull'))warnings.push('Your current options do not include a suitable pulling exercise. A resistance band with a secure anchor, dumbbells or a row machine would help balance your upper-body training.');
  if(!weeklyPatterns.has('push'))warnings.push('No suitable chest/pushing exercise fits this plan. Review the equipment and movement preferences before treating it as a complete weekly program.');
  if(!weeklyPatterns.has('squat'))warnings.push('Knee-dominant leg work is limited by your current choices. The plan does not substitute a deep knee bend you asked to avoid.');
  const estimatedMinutes=Math.max(...routines.map(routine=>estimateRoutineMinutes(routine,exercises)),0);
  const athleticFeatures=weeklyPatterns.size?['controlled strength']:[];
  if(routines.some(routine=>routine.exercises.some(item=>{
    const movement=coachingMovement[item.exerciseId];
    return movement.balance&&movement.unilateral;
  })))athleticFeatures.push('single-leg control');
  if(weeklyPatterns.has('calf'))athleticFeatures.push('calf strength');
  if(weeklyPatterns.has('core'))athleticFeatures.push('trunk control');
  const athleticRationale=athleticFeatures.length?`Your ${coaching.sportFocus.toLowerCase()} plan includes ${athleticFeatures.join(', ')} within your available time and movement preferences. This is a general foundation, not a sport-specific performance program.`:'No suitable exercises currently fit your athletic goal and preferences. Review the limitations below before starting.';
  const rationale=[
    goal==='glutes'?'Your plan gives glute work an early place in the week while retaining upper-body work; this goal is available to everyone.':goal==='athletic'?athleticRationale:goal==='muscle'?'Your muscle-building plan uses repeatable sets across major muscle groups, with gradual rep and load progression.':goal==='strength'?'Your strength plan prioritizes foundational lifts and longer recovery, scaled to your training experience.':goal==='upper'?'Upper-body pushing and pulling receive priority while lower-body work stays in the week.':'A manageable, repeatable routine builds skill and consistency before adding more work.',
    beginner(preferences)?'Start with two controlled sets per exercise and a light effort. More reps are not automatically better: stop before technique changes, and use the optional strength introduction only if you want it.':'Work below failure and progress gradually; the listed rep ranges are starting points, not the only way to reach your goal.',
    `${days.length||1} planned session${days.length<=1?'':'s'} · up to about ${estimatedMinutes} minutes each within your ${coaching.sessionMinutes}-minute preference. Estimates include warm-up, set rests and both sides of unilateral exercises; equipment waits can add time.`,
    coaching.trainingStyle==='Balanced'?'Exercise choices use your available equipment and balance different movement patterns.':`${coaching.trainingStyle} choices ${coaching.trainingStyle==='Bodyweight'?'use only bodyweight':'are favored when your equipment and movement preferences allow'}.`,
  ];
  if(coaching.focusAreas.length)rationale.push(`Extra emphasis rotates across your priorities: ${coaching.focusAreas.join(', ')}. Other muscle groups remain part of the week.`);
  if(coaching.impact==='Low impact'||coaching.avoidMovements.length)rationale.push(`Your movement preferences are applied to every selected exercise${coaching.avoidMovements.length?`: no ${coaching.avoidMovements.join(', ').toLowerCase()}`:''}. There are no jumping drills in this starter plan.`);
  return {routines,rationale,estimatedMinutes,summary:`${titles[goal]} · ${days.length||1} days · about ${estimatedMinutes} min per session`,warnings:[...new Set(warnings)]};
}

export function buildRecommendedRoutine(preferences:Preferences,exercises:Exercise[]):Routine{
  return buildRecommendedPlan(preferences,exercises).routines[0];
}

export function recommendationSummary(preferences:Preferences){
  if(beginner(preferences))return 'Technique first · 2 controlled sets · 60 sec or longer to recover';
  const goal=goalType(preferences);
  if(goal==='strength')return 'Strength focus · 5–8 reps on main lifts · up to 2½ min rest';
  if(['muscle','glutes','upper'].includes(goal))return 'Muscle focus · 8–15 reps · 90–120 sec rest';
  if(goal==='athletic')return 'Athletic foundation · controlled strength and balance · 75–120 sec rest';
  return 'Build consistency · 10–15 controlled reps · about 75 sec rest';
}

function warmupKey(muscle:string){
  const value=muscle.toLowerCase();
  if(/glute|hip/.test(value))return 'Glutes';
  if(/leg|quad|hamstring|calf/.test(value))return 'Legs';
  if(/chest/.test(value))return 'Chest';
  if(/back|lat|trap/.test(value))return 'Back';
  if(/shoulder/.test(value))return 'Shoulders';
  if(/arm|bicep|tricep|forearm/.test(value))return 'Arms';
  return 'Core';
}

// Rehearsing the actual session avoids adding excluded floor/overhead movements.
export function buildWarmup(routine:Routine,exercises:Exercise[]):WarmupMove[]{
  const seen=new Set<string>();
  const targeted:WarmupMove[]=[];
  routine.exercises.forEach(item=>{
    const exercise=exercises.find(candidate=>candidate.id===item.exerciseId);
    if(!exercise)return;
    const target=warmupKey(exercise.muscle);
    if(seen.has(target))return;
    seen.add(target);
    const hold=isTimedExercise(exercise);
    const side=coachingMovement[exercise.id]?.unilateral?' per side':'';
    targeted.push({name:`Rehearse ${exercise.name.toLowerCase()}`,dose:hold?'10–15 easy seconds':`5–8 easy reps${side}`,target,cue:`Use ${exercise.equipment==='Bodyweight'?'an easy version and a comfortable range':'a much lighter load or resistance than your working sets'}. Follow the same setup shown in the exercise guide; stop if the movement hurts.`});
  });
  return [{name:'Raise your temperature',dose:'2 minutes',target:'Whole body',cue:'Walk or cycle at an easy pace, then gradually increase the pace if comfortable.'},...targeted.slice(0,3)];
}

export function restReason(preferences:Preferences,seconds:number){
  if(beginner(preferences))return `${seconds}s is a starting rest for technique practice. Take longer if breathing or control has not recovered.`;
  if(goalType(preferences)==='strength')return `${seconds}s supports recovery for strong, controlled reps; extend it if the next set would suffer.`;
  if(['muscle','glutes','upper'].includes(goalType(preferences)))return `${seconds}s gives you recovery to keep the next set productive. Rest longer if needed.`;
  return `${seconds}s gives you time to reset. Start the next set when your movement feels controlled.`;
}
