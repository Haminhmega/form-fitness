import type {Exercise,Preferences,Routine,RoutineExercise,TrainingDay} from './types';
import {isTimedExercise} from './exercise-logging';
import {getCoaching} from '../shared/coaching';
import {coachingMovement,coachingRole,type CoachingMovement,type MovementPattern} from './coaching-exercises';
export {coachingExercises} from './coaching-exercises';

export type WarmupMove={name:string;dose:string;target:string;cue:string;seconds:number};
export type RecommendedPlan={routines:Routine[];rationale:string[];estimatedMinutes:number;targetMinutes:number;summary:string;warnings:string[]};
export type PlanContext={age?:number|null};
const beginner=(preferences:Preferences)=>preferences.experience==='Getting started';
const goalKey=(goal:string)=>goal.toLowerCase();
const weekdays=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const dayNames:Record<string,string>={Mon:'Monday',Tue:'Tuesday',Wed:'Wednesday',Thu:'Thursday',Fri:'Friday',Sat:'Saturday',Sun:'Sunday'};
// These exercises place substantial demand on an unsupported or axially loaded
// torso. Supported rows, light standing drills and incidental bracing are not
// classified as equivalent lower-back training.
const erectorLoadedIds=new Set(['rdl','coach-barbell-rdl','gym-1810-barbell-squat','gym-1640-bent-over-barbell-row']);
const unsupportedRowId='gym-1640-bent-over-barbell-row';

function goalType(preferences:Preferences){
  const goal=goalKey(preferences.goal);
  if(/glute|butt/.test(goal))return 'glutes';
  if(/athleti/.test(goal))return 'athletic';
  if(/strength/.test(goal))return 'strength';
  if(/upper body/.test(goal))return 'upper';
  if(/muscle|hypertrophy|aesthetic/.test(goal))return 'muscle';
  if(/learn|basic/.test(goal))return 'basics';
  return 'fitness';
}

export function recommendedPrescription(preferences:Preferences,exercise:Exercise,context:PlanContext={}):RoutineExercise{
  const goal=goalType(preferences);
  const youth=typeof context.age==='number'&&context.age>=13&&context.age<18;
  const isHold=isTimedExercise(exercise);
  const metadata=coachingMovement[exercise.id];
  const compound=metadata?!!metadata.compound:true;
  if(beginner(preferences)||youth)return {exerciseId:exercise.id,sets:2,reps:isHold?'20–30 sec':'10–15',rest:compound?90:60,notes:(youth?'Practice with qualified supervision. ':'')+'Use a light, controlled effort to learn the technique. Finish with 3–4 good reps still available; take longer rests whenever you need them.'};
  if(goal==='strength')return {exerciseId:exercise.id,sets:compound?4:3,reps:isHold?'20–40 sec':compound?'5–8':'10–15',rest:compound?180:90,notes:'Finish with 2–3 controlled reps still available. No maximal lifts: increase the smallest available load only after every set reaches the top of its range with repeatable technique.'};
  if(['muscle','glutes','upper'].includes(goal))return {exerciseId:exercise.id,sets:3,reps:isHold?'20–40 sec':compound?'8–12':'10–15',rest:isHold?60:compound?180:120,notes:'Finish with about 2 good reps still available. Build reps within this range first, then add the smallest available load when all sets feel controlled.'};
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
  if(coaching.trainingStyles.length===1&&coaching.trainingStyles[0]==='Bodyweight'&&equipment!=='Bodyweight')return false;
  if(beginner(preferences)&&meta.experienced)return false;
  if(coaching.avoidMovements.includes('Floor exercises')&&meta.floor)return false;
  if(coaching.avoidMovements.includes('Overhead pressing')&&meta.overhead)return false;
  if(coaching.avoidMovements.includes('Deep knee bends')&&meta.deepKnee)return false;
  // Every curated recommendation is grounded, with no jumping component.
  return true;
}

// Bit clusters include meaningful secondary work: presses share triceps/front
// delts; pulls share biceps/rear delts; lower-body lifts share glutes/hamstrings.
const LOWER=1,PUSH=2,PULL=4;
const clusterFor=(pattern:MovementPattern)=>['squat','hinge','glute','calf'].includes(pattern)?LOWER:['push','shoulder'].includes(pattern)?PUSH:pattern==='core'?0:PULL;
const scheduleCache=new Map<string,number[]>();
const cyclicGaps=(indices:number[])=>indices.map((day,index)=>(indices[(index+1)%indices.length]-day+7)%7||7);
const separated=(indices:number[])=>cyclicGaps(indices).every(gap=>gap>=2);
function spacedSubsets(days:string[],maximum:number){
  const subsets:Array<{mask:number;count:number;spacing:number}>=[];
  for(let mask=1;mask<(1<<days.length);mask++){
    const indices=days.flatMap((day,index)=>mask&(1<<index)?[weekdays.indexOf(day)]:[]);
    if(indices.length<=maximum&&separated(indices))subsets.push({mask,count:indices.length,spacing:cyclicGaps(indices).reduce((sum,gap)=>sum+Math.min(3,gap),0)});
  }
  return subsets;
}

/** Keep every selected day, optimizing the repeating week, including Sun→Mon. */
function scheduleAssignments(days:string[],youth:boolean):number[]{
  if(!days.length)return [LOWER|PUSH|PULL];
  const key=`${days.join(',')}:${youth}`;
  const cached=scheduleCache.get(key);
  if(cached)return [...cached];
  const indices=days.map(day=>weekdays.indexOf(day));
  let result:number[];
  if(youth){
    const choices=spacedSubsets(days,3).sort((a,b)=>(b.count*100+b.spacing)-(a.count*100+a.spacing));
    result=days.map((_,index)=>choices[0].mask&(1<<index)?7:0);
  }else if(days.length<=3&&separated(indices))result=days.map(()=>7);
  else{
    // A dense week spreads the dose over two exposures per cluster; a seventh
    // selected day can therefore be recovery instead of inventing more volume.
    const choices=spacedSubsets(days,2);
    let bestScore=-Infinity;
    result=days.map(()=>0);
    for(const lower of choices)for(const push of choices)for(const pull of choices){
      const assignment=days.map((_,index)=>(lower.mask&(1<<index)?LOWER:0)|(push.mask&(1<<index)?PUSH:0)|(pull.mask&(1<<index)?PULL:0));
      const covered=assignment.filter(Boolean).length;
      const mixed=assignment.filter(mask=>(mask&LOWER)&&(mask&(PUSH|PULL))).length;
      const score=covered*10000+(lower.count+push.count+pull.count)*100+(lower.spacing+push.spacing+pull.spacing)*10-mixed*5;
      if(score>bestScore){bestScore=score;result=assignment;}
    }
  }
  scheduleCache.set(key,result);
  return [...result];
}

function directCoreDays(days:string[],assignments:number[]){
  const pulling=days.filter((_,index)=>assignments[index]===PULL);
  const active=pulling.length===2&&separated(pulling.map(day=>weekdays.indexOf(day)))?pulling:days.filter((_,index)=>assignments[index]);
  if(!active.length)return new Set<string>();
  if(active[0]==='Your day')return new Set(active);
  const best=spacedSubsets(active,2).sort((a,b)=>(b.count*100+b.spacing)-(a.count*100+a.spacing))[0];
  return new Set(active.filter((_,index)=>best.mask&(1<<index)));
}

const focusPattern:Record<string,MovementPattern>={Glutes:'glute',Legs:'squat',Back:'pull',Chest:'push',Shoulders:'shoulder',Arms:'arms',Core:'core'};
const titles={glutes:'Glute focus',athletic:'Athletic foundation',strength:'Strength base',upper:'Upper-body focus',muscle:'Muscle building',basics:'Technique practice',fitness:'Full-body consistency'};

function plannedPatterns(preferences:Preferences,day:number,assignment:number,includeCore:boolean):MovementPattern[]{
  const goal=goalType(preferences);
  const coaching=getCoaching(preferences);
  let patterns:MovementPattern[];
  if(assignment!==7){
    const lower:MovementPattern[]=goal==='glutes'?['glute',day%2?'squat':'hinge',day%2?'hinge':'squat','calf']:day%2?['hinge','squat','calf','glute']:['squat','hinge','calf','glute'];
    const upper:MovementPattern[]=(assignment&(PUSH|PULL))===(PUSH|PULL)?['push','pull','shoulder','arms']:assignment&PUSH?['push','shoulder','push','shoulder','push']:['pull','pull','arms','pull','arms'];
    patterns=assignment&LOWER?(assignment&(PUSH|PULL)?[lower[0],...upper,...lower.slice(1)]:lower):upper;
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
  const compatible=focus==='core'?includeCore:!!(assignment&clusterFor(focus));
  if(focus&&compatible){const at=patterns.indexOf(focus);if(at>=0)patterns.splice(at,1);patterns=[focus,...patterns];}
  // Full-body days cover the main patterns first; split days use complementary
  // roles within a pattern (e.g. row + pulldown), never duplicate alternatives.
  if(assignment===7)patterns=[...new Set(patterns),'push','pull'];
  else if(assignment===LOWER)patterns=[...patterns,'hinge',goal==='glutes'||coaching.focusAreas.includes('Glutes')?'glute':'squat'];
  return [...patterns,...(includeCore?['core' as const]:[])].filter(pattern=>pattern==='core'?includeCore:!!(assignment&clusterFor(pattern)));
}

const roleOrder:Record<MovementPattern,string[]>={
  push:['push','incline-press','triceps'],shoulder:['shoulder','lateral-raise'],
  pull:['pull','vertical-pull','rear-delt','lat-isolation'],arms:['arms','neutral-curl'],
  squat:['squat','knee-extension'],hinge:['hinge','knee-flexion'],glute:['glute','hip-abduction'],calf:['calf'],core:['core'],
};
function roleRank(pattern:MovementPattern,id:string,day:number){
  const roles=[...roleOrder[pattern]];
  // A/B pull days alternate their leading direction, then cover the other.
  if(pattern==='pull'&&day%2===1)[roles[0],roles[1]]=[roles[1],roles[0]];
  return roles.indexOf(coachingRole(id));
}

// Approximate direct + supporting-muscle accounting, not measured stimulus.
// Half-credit prevents treating every compound as a full isolation set while
// still limiting overlap (e.g. chest presses plus shoulder/triceps work).
export function trainingSetCredits(id:string):Record<string,number>{
  const role=coachingRole(id);
  const credits:Record<string,Record<string,number>>={
    push:{Chest:1,'Front delts':.5,Triceps:.5},'incline-press':{Chest:1,'Front delts':.5,Triceps:.5},
    triceps:{Triceps:1},shoulder:{'Front delts':1,'Side delts':.5,Triceps:.5},'lateral-raise':{'Side delts':1},
    pull:{Back:1,'Rear delts':.5,Biceps:.5},'vertical-pull':{Back:1,Biceps:.5},
    'rear-delt':{'Rear delts':1,Back:.5},'lat-isolation':{Back:1},arms:{Biceps:1},'neutral-curl':{Biceps:1},
    squat:{Quads:1,Glutes:.5},'knee-extension':{Quads:1},hinge:{Hamstrings:1,Glutes:.5},'knee-flexion':{Hamstrings:1},
    glute:{Glutes:1},'hip-abduction':{Glutes:1},calf:{Calves:1},core:{Core:1},
  };
  return credits[role]||{};
}

export function weeklyTrainingDose(routines:Routine[]){
  const totals:Record<string,number>={};
  for(const routine of routines)for(const item of routine.exercises)for(const [muscle,credit] of Object.entries(trainingSetCredits(item.exerciseId)))totals[muscle]=(totals[muscle]||0)+item.sets*credit;
  return totals;
}

function selectionScore(preferences:Preferences,exercise:Exercise,day:number,used:Map<string,number>){
  const coaching=getCoaching(preferences);
  const meta=coachingMovement[exercise.id];
  const equipment=equipmentKey(exercise.equipment);
  const goal=goalType(preferences);
  let score=0;
  if(coaching.trainingStyles.includes('Machines')&&equipment==='Machines')score+=24;
  if(coaching.trainingStyles.includes('Free weights')&&['Dumbbells','Barbell'].includes(equipment))score+=24;
  if(coaching.trainingStyles.includes('Bodyweight')&&equipment==='Bodyweight')score+=24;
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
  // Keep useful lifts stable across the week; deterministic A/B roles provide
  // variety without swapping equipment just because a lift appeared yesterday.
  if(used.has(exercise.id))score+=2;
  if(goal==='athletic'&&day%2===1&&meta.unilateral)score+=3;
  return score;
}

function timeFor(item:RoutineExercise,exercise:Exercise){
  const meta=coachingMovement[exercise.id];
  const numbers=item.reps.match(/\d+/g)?.map(Number)||[10];
  const maximum=Math.max(...numbers);
  const work=isTimedExercise(exercise)?maximum:maximum*3;
  const perSet=work*(meta?.unilateral?2:1)+(meta?.unilateral?10:0);
  return item.sets*perSet+Math.max(0,item.sets-1)*item.rest+75;
}

export function estimateRoutineMinutes(routine:Routine,exercises:Exercise[]){
  if(routine.kind==='recovery')return routine.recovery?.minutes||0;
  if(!routine.exercises.length)return 0;
  const available=new Map(exercises.map(exercise=>[exercise.id,exercise]));
  const warmupSeconds=buildWarmup(routine,exercises).reduce((sum,move)=>sum+move.seconds,0);
  const seconds=warmupSeconds+routine.exercises.reduce((sum,item,index)=>{
    const exercise=available.get(item.exerciseId);
    // The rest timer also runs when moving to the next exercise. The 75-second
    // setup allowance can overlap that recovery, but cannot replace a long rest.
    const nextExerciseRest=index<routine.exercises.length-1?Math.max(0,item.rest-75):0;
    return sum+(exercise?timeFor(item,exercise)+nextExerciseRest:0);
  },0);
  return Math.ceil(seconds/60);
}

function selectionReason(preferences:Preferences,exercise:Exercise){
  const meta=coachingMovement[exercise.id];
  const coaching=getCoaching(preferences);
  const goal=goalType(preferences);
  let why=goal==='glutes'&&meta.areas.includes('Glutes')?'Glute-focused work for your growth goal.':goal==='athletic'&&meta.balance?'Builds single-leg control and balance for your activity goal.':meta.pattern==='pull'?'Balances pressing work with back and pulling strength.':meta.pattern==='push'?'Keeps chest and pushing strength in your weekly plan.':meta.pattern==='core'?'Practices trunk control to support your other lifts.':`Builds ${meta.areas[0].toLowerCase()} strength in a balanced weekly plan.`;
  const purpose:Record<string,string>={triceps:'Adds direct elbow-extension work to complement your presses.','incline-press':'Adds an inclined pressing angle alongside your main chest movement.','lateral-raise':'Adds direct side-deltoid work alongside your presses.','vertical-pull':'Adds a vertical pulling direction alongside rows.','rear-delt':'Adds rear-deltoid and upper-back assistance work.','neutral-curl':'Adds neutral-grip elbow-flexor work; keep the upper arms steady.','knee-flexion':'Trains knee flexion to complement the hip-hinge movement.','knee-extension':'Adds direct quadriceps work without another loaded hip hinge.','hip-abduction':'Adds hip-abductor work alongside hip-extension movements.'};
  if(purpose[coachingRole(exercise.id)])why=purpose[coachingRole(exercise.id)];
  if(coaching.focusAreas.some(area=>meta.areas.includes(area)))why+=` Matches your ${coaching.focusAreas.filter(area=>meta.areas.includes(area)).join(' and ').toLowerCase()} priority.`;
  if(meta.unilateral)why+=' The rep range is per side; complete both sides.';
  return why;
}

function sessionTitle(exercises:Exercise[],day:string){
  if(!exercises.length)return `No matching exercises · ${dayNames[day]||day}`;
  const movements=exercises.map(exercise=>coachingMovement[exercise.id]);
  const patterns=new Set(movements.map(movement=>movement.pattern));
  // Name the work that actually survived the equipment, exclusion and time filters.
  const muscles=[...new Set(movements.map(movement=>movement.pattern==='calf'?'Calves':movement.areas[0]))];
  const lower=movements.some(movement=>['squat','hinge','glute','calf'].includes(movement.pattern));
  const upper=movements.some(movement=>['push','pull','shoulder','arms'].includes(movement.pattern));
  const pushOnly=(patterns.has('push')||patterns.has('shoulder'))&&movements.every(movement=>['push','shoulder','core'].includes(movement.pattern));
  const pullOnly=patterns.has('pull')&&movements.every(movement=>['pull','arms','core'].includes(movement.pattern));
  const prefix=pushOnly?'Push day · ':pullOnly?'Pull day · ':lower&&!upper?'Lower body · ':upper&&!lower?'Upper body · ':'';
  const labels=muscles.map((muscle,index)=>index?muscle.toLowerCase():muscle);
  const targets=labels.length<2?labels[0]:`${labels.slice(0,-1).join(', ')} & ${labels.at(-1)}`;
  return `${prefix}${targets} · ${dayNames[day]||day}`;
}

function describeResistanceRoutine(routine:Routine,preferences:Preferences,exercises:Exercise[]){
  const selected=routine.exercises.flatMap(item=>{
    const exercise=exercises.find(candidate=>candidate.id===item.exerciseId);
    return exercise?[exercise]:[];
  });
  const day=routine.scheduledDay||'Your day';
  const coaching=getCoaching(preferences);
  routine.name=sessionTitle(selected,day);
  const patterns=new Set(selected.map(exercise=>coachingMovement[exercise.id].pattern));
  const lower=[...patterns].some(pattern=>['squat','hinge','glute','calf'].includes(pattern));
  const upper=[...patterns].some(pattern=>['push','pull','shoulder','arms'].includes(pattern));
  const region=!selected.length?'no matching session':coaching.sessionMinutes<=15?'brief practice with limited volume':lower&&!upper?'lower-body emphasis':upper&&!lower?'upper-body emphasis':lower&&patterns.has('push')&&patterns.has('pull')?'full-body practice':'focused practice';
  routine.description=`${day} · ${region} · about ${estimateRoutineMinutes(routine,exercises)} min including warm-up and rests. Built for ${preferences.goal.toLowerCase()}, ${preferences.experience.toLowerCase()} and your available equipment. ${coaching.focusAreas.length?`Priority: ${coaching.focusAreas.join(', ')}.`:''}`.trim();
}

export function recommendedMuscleGroups(routine:Routine):string[]{
  const groups=new Set<string>();
  routine.exercises.forEach(item=>{
    const movement=coachingMovement[item.exerciseId];
    if(!movement)return;
    let trained:string[];
    switch(movement.pattern){
      case 'push':trained=coachingRole(item.exerciseId)==='triceps'?['Triceps']:['Chest','Front delts','Triceps'];break;
      case 'shoulder':trained=item.exerciseId==='gym-2580-dumbbell-lateral-raise'?['Side delts']:['Front delts','Side delts','Triceps'];break;
      case 'pull':trained=coachingRole(item.exerciseId)==='rear-delt'?['Back','Rear delts']:coachingRole(item.exerciseId)==='lat-isolation'?['Back']:['Back','Rear delts','Biceps'];break;
      case 'arms':trained=['Biceps'];break;
      case 'squat':trained=coachingRole(item.exerciseId)==='knee-extension'?['Quads']:['Quads','Glutes'];break;
      case 'hinge':trained=item.exerciseId==='gym-1351-seated-leg-curl'?['Hamstrings']:['Hamstrings','Glutes'];break;
      case 'glute':trained=['Glutes'];break;
      case 'calf':trained=['Calves'];break;
      default:trained=['Core'];
    }
    if(erectorLoadedIds.has(item.exerciseId))trained.push('Spinal erectors');
    trained.forEach(group=>groups.add(group));
  });
  return [...groups];
}

function recoveryRoutine(day:string,index:number,minutes:number,reason:string):Routine{
  const duration=Math.min(20,minutes);
  return {id:index===0?'form-recommended':`form-recommended-${index+1}`,name:`Active recovery · ${dayNames[day]||day}`,scheduledDay:weekdays.includes(day)?day as TrainingDay:undefined,kind:'recovery',exercises:[],description:`${day} · ${duration} easy minutes. ${reason} This day stays in your schedule without adding another resistance session.`,recovery:{minutes:duration,steps:[
    'Start with 2 minutes of relaxed walking. Keep the effort easy enough to speak comfortably.',
    `Continue for about ${Math.max(4,duration-4)} minutes with an easy walk or very gentle cycling. Choose the comfortable option; do not add intervals, jumping or resistance sets.`,
    'Finish with 2 quiet minutes. Relax your shoulders and breathe normally; gentle standing movement is optional. No floor or overhead exercises are required.',
    'If you feel sore, unusually tired or uncomfortable, use this as a rest day instead. You do not have to fill the timer.',
  ]}};
}

export function buildRecommendedPlan(preferences:Preferences,exercises:Exercise[],context:PlanContext={}):RecommendedPlan{
  const coaching=getCoaching(preferences);
  const goal=goalType(preferences);
  const warnings:string[]=[];
  const youth=typeof context.age==='number'&&context.age>=13&&context.age<18;
  const effectivePreferences=youth?{...preferences,experience:'Getting started'}:preferences;
  const novice=beginner(effectivePreferences);
  const days=weekdays.filter(day=>preferences.days.includes(day));
  const scheduled=days.length?days:['Your day'];
  const assignments=scheduleAssignments(days,youth);
  const coreDays=directCoreDays(scheduled,assignments);
  const pool=[...new Map(exercises.map(exercise=>[exercise.id,exercise])).values()].filter(exercise=>{
    const meta=coachingMovement[exercise.id];
    return meta&&allowed(effectivePreferences,exercise,meta);
  });
  if(!days.length)warnings.push('Choose at least one available day to place this starter session in your week.');
  if(days.length===1)warnings.push('One day is a useful start. A second separated strength day can help you practice more consistently when your schedule allows.');
  if(novice&&!youth&&days.length>3)warnings.push('New to lifting: two or three separated full-body sessions are usually a simpler starting structure. Your selected days are preserved as smaller split sessions; six long, hard sessions are not automatically a better beginner plan. Review the per-day time gaps before applying this plan.');
  if(youth)warnings.push('For ages 13–17, practice resistance exercises with qualified supervision and light, controlled loads. This plan uses at most three nonconsecutive resistance days; other selected days stay as easy activity. It does not prescribe maximal strength tests.');
  const experiencedHypertrophy=!youth&&preferences.experience==='Experienced'&&['muscle','glutes','upper'].includes(goal);
  // Cluster budgets cover several muscles, not just the primary press/row.
  // Their ceilings do not multiply when the user chooses more training days.
  const weeklyScale=days.length===1?.55:1;
  const weeklyBudgets:Record<number,number>={
    [LOWER]:Math.round((novice?28:44)*weeklyScale),
    [PUSH]:Math.round((novice?20:34)*weeklyScale),
    [PULL]:Math.round((novice?20:34)*weeklyScale),
  };
  const roleUsed=new Map<string,number>();
  const roleLimit=()=>Math.ceil((novice?6:10)*weeklyScale);
  const muscleUsed:Record<string,number>={};
  const muscleCeiling=(muscle:string)=>Math.ceil((novice?12:18)*weeklyScale)+(coaching.focusAreas.includes(muscle as typeof coaching.focusAreas[number])?2:0);
  let dayMuscleLimit:Record<string,number>={},dayMuscleUsed:Record<string,number>={};
  const roomFor=(id:string)=>Math.min(...Object.entries(trainingSetCredits(id)).map(([muscle,credit])=>Math.floor(Math.min(muscleCeiling(muscle)-(muscleUsed[muscle]||0),(dayMuscleLimit[muscle]??Infinity)-(dayMuscleUsed[muscle]||0))/credit)));
  const addDose=(id:string,sets:number)=>{for(const [muscle,credit] of Object.entries(trainingSetCredits(id))){muscleUsed[muscle]=(muscleUsed[muscle]||0)+sets*credit;dayMuscleUsed[muscle]=(dayMuscleUsed[muscle]||0)+sets*credit;}};
  const occurrences:Record<number,number>={[LOWER]:0,[PUSH]:0,[PULL]:0};
  const frequency=(cluster:number)=>assignments.filter(mask=>mask&cluster).length;
  const used=new Map<string,number>();
  const routines=scheduled.map((day,index):Routine=>{
    const assignment=assignments[index];
    if(!assignment)return recoveryRoutine(day,index,coaching.sessionMinutes,youth?'A recovery day separates your supervised technique sessions.':'The surrounding resistance days already cover your weekly training dose and need room for recovery.');
    const patterns=plannedPatterns(effectivePreferences,assignment&LOWER?occurrences[LOWER]:index,assignment,coreDays.has(day));
    const remaining:Record<number,number>={0:coreDays.has(day)?(novice?2:3):0};
    for(const cluster of [LOWER,PUSH,PULL]){
      const count=frequency(cluster);
      remaining[cluster]=assignment&cluster?Math.floor(weeklyBudgets[cluster]/count)+(occurrences[cluster]<weeklyBudgets[cluster]%count?1:0):0;
      if(assignment&cluster)occurrences[cluster]++;
    }
    dayMuscleUsed={};dayMuscleLimit={};
    for(const [cluster,muscles] of [[LOWER,['Quads','Hamstrings','Glutes','Calves']],[PUSH,['Chest','Front delts','Side delts','Triceps']],[PULL,['Back','Rear delts','Biceps']]] as const){
      const future=Math.max(1,frequency(cluster)-occurrences[cluster]+1);
      for(const muscle of muscles)dayMuscleLimit[muscle]=Math.floor((muscleCeiling(muscle)-(muscleUsed[muscle]||0))/future*2)/2;
    }
    const selected:Exercise[]=[];
    const maxExercises=coaching.sessionMinutes<=15?3:coaching.sessionMinutes<=25?4:coaching.sessionMinutes<=30?5:novice?6:assignment===7?8:6;
    const routine:Routine={id:index===0?'form-recommended':`form-recommended-${index+1}`,scheduledDay:weekdays.includes(day)?day as TrainingDay:undefined,name:'',description:'',exercises:[]};
    for(const pattern of patterns){
      if(selected.length>=maxExercises)break;
      const cluster=clusterFor(pattern);
      if(!remaining[cluster])continue;
      const candidates=pool.filter(exercise=>coachingMovement[exercise.id].pattern===pattern&&!selected.some(item=>coachingRole(item.id)===coachingRole(exercise.id))&&(roleUsed.get(coachingRole(exercise.id))||0)<roleLimit()&&roomFor(exercise.id)>0).sort((a,b)=>roleRank(pattern,a.id,index)-roleRank(pattern,b.id,index)||selectionScore(effectivePreferences,b,index,used)-selectionScore(effectivePreferences,a,index,used));
      let choice:Exercise|undefined;
      let prescription:RoutineExercise|undefined;
      for(const exercise of candidates){
        const item=recommendedPrescription(effectivePreferences,exercise);
        item.sets=Math.min(item.sets,remaining[cluster],roleLimit()-(roleUsed.get(coachingRole(exercise.id))||0),roomFor(exercise.id));
        // A priority accessory should not consume the entire cluster's budget
        // before its foundational movement (or the running goal's calf work).
        const reserveFor=pattern==='shoulder'?'push':pattern==='arms'?'pull':goal==='athletic'&&coaching.sportFocus==='Running'&&cluster===LOWER&&pattern!=='calf'?'calf':pattern==='glute'?(patterns.includes('squat')?'squat':'hinge'):undefined;
        if(reserveFor&&patterns.includes(reserveFor)&&!selected.some(candidate=>coachingMovement[candidate.id].pattern===reserveFor)&&remaining[cluster]>1)item.sets=Math.min(item.sets,remaining[cluster]-1);
        // Budget the whole short session, rather than spending it on one lift.
        const minimumSets=coaching.sessionMinutes<=15?1:2;
        if(item.sets<minimumSets)continue;
        if(coaching.sessionMinutes<=15)item.sets=1;
        else if(coaching.sessionMinutes<=25)item.sets=Math.min(item.sets,2);
        else if(coaching.sessionMinutes<=45)item.sets=Math.min(item.sets,2);
        const check={...routine,exercises:[...routine.exercises,item].sort((a,b)=>Number(!!coachingMovement[b.exerciseId].compound)-Number(!!coachingMovement[a.exerciseId].compound))};
        while(item.sets>minimumSets&&estimateRoutineMinutes(check,exercises)>coaching.sessionMinutes)item.sets--;
        if(estimateRoutineMinutes(check,exercises)<=coaching.sessionMinutes){choice=exercise;prescription=item;break;}
      }
      if(!choice||!prescription)continue;
      const defaultSets=recommendedPrescription(effectivePreferences,choice).sets;
      prescription.notes=`${selectionReason(effectivePreferences,choice)} ${prescription.notes}${prescription.sets<defaultSets?' Fewer sets keep the weekly dose and session time manageable.':''}`;
      selected.push(choice);
      routine.exercises.push(prescription);
      remaining[cluster]-=prescription.sets;
      const role=coachingRole(choice.id);roleUsed.set(role,(roleUsed.get(role)||0)+prescription.sets);
      addDose(choice.id,prescription.sets);
      used.set(choice.id,(used.get(choice.id)||0)+1);
    }
    routine.exercises.sort((a,b)=>Number(!!coachingMovement[b.exerciseId].compound)-Number(!!coachingMovement[a.exerciseId].compound));
    // First secure useful exercise coverage, then add working sets toward the
    // time target without exceeding weekly dose or four sets per movement.
    const targetMinutes=Math.floor(coaching.sessionMinutes*.9);
    if(!novice&&coaching.sessionMinutes>45){
      let changed=true;
      while(changed&&estimateRoutineMinutes(routine,exercises)<targetMinutes){
        changed=false;
        for(const item of routine.exercises){
          const role=coachingRole(item.exerciseId),cluster=clusterFor(coachingMovement[item.exerciseId].pattern);
          const cap=coachingMovement[item.exerciseId].compound?4:3;
          if(item.sets>=cap||remaining[cluster]<1||(roleUsed.get(role)||0)>=roleLimit()||roomFor(item.exerciseId)<1)continue;
          item.sets++;
          if(estimateRoutineMinutes(routine,exercises)>coaching.sessionMinutes){item.sets--;continue;}
          remaining[cluster]--;roleUsed.set(role,(roleUsed.get(role)||0)+1);addDose(item.exerciseId,1);changed=true;
          if(estimateRoutineMinutes(routine,exercises)>=targetMinutes)break;
        }
      }
    }
    describeResistanceRoutine(routine,preferences,exercises);
    if(!routine.exercises.length){
      warnings.push(`${day}: your equipment, movement preferences and time allow 0 matching resistance exercises for this split. Keep this day easy or review your preferences; an excluded movement has not been substituted.`);
      return recoveryRoutine(day,index,coaching.sessionMinutes,'No suitable resistance exercise currently fits this day’s split and your preferences.');
    }
    if(coaching.sessionMinutes<=15)warnings.push(`${day}: this is a brief practice session with limited volume. Do not rush the warm-up or rests to fit extra work.`);
    return routine;
  });
  // The broad push/pull/lower split alone cannot capture an unsupported row's
  // substantial erector loading. Check actual selected exercises in both calendar
  // directions, including Sunday→Monday, before finalizing the plan.
  routines.forEach((routine,index)=>{
    const rowIndex=routine.exercises.findIndex(item=>item.exerciseId===unsupportedRowId);
    if(rowIndex<0||!routine.scheduledDay)return;
    const dayIndex=weekdays.indexOf(routine.scheduledDay);
    const nearbyLoadedTorso=routines.some((other,otherIndex)=>{
      if(otherIndex===index||!other.scheduledDay||!other.exercises.some(item=>erectorLoadedIds.has(item.exerciseId)))return false;
      const gap=Math.abs(weekdays.indexOf(other.scheduledDay)-dayIndex);
      return Math.min(gap,7-gap)<2;
    });
    if(!nearbyLoadedTorso)return;
    const original=routine.exercises[rowIndex];
    const alternatives=pool.filter(exercise=>coachingMovement[exercise.id].pattern==='pull'&&!erectorLoadedIds.has(exercise.id)&&!routine.exercises.some(item=>item.exerciseId!==unsupportedRowId&&coachingRole(item.exerciseId)===coachingRole(exercise.id))).sort((a,b)=>selectionScore(effectivePreferences,b,index,used)-selectionScore(effectivePreferences,a,index,used));
    let replacement:RoutineExercise|undefined;
    for(const exercise of alternatives){
      const item=recommendedPrescription(effectivePreferences,exercise);
      item.sets=Math.min(original.sets,experiencedHypertrophy&&coachingMovement[exercise.id].compound?5:item.sets);
      item.notes=`${selectionReason(effectivePreferences,exercise)} This supported or upright alternative leaves more recovery for your loaded lower-back work. ${item.notes}`;
      const trial={...routine,exercises:routine.exercises.map((existing,itemIndex)=>itemIndex===rowIndex?item:existing)};
      while(item.sets>1&&estimateRoutineMinutes(trial,exercises)>coaching.sessionMinutes)item.sets--;
      if(estimateRoutineMinutes(trial,exercises)<=coaching.sessionMinutes){replacement=item;break;}
    }
    const day=routine.scheduledDay;
    if(replacement){
      routine.exercises[rowIndex]=replacement;
      warnings.push(`${day}: a supported or upright pulling exercise replaces the bent-over barbell row to avoid adjacent days of substantial lower-back loading.`);
      describeResistanceRoutine(routine,preferences,exercises);
    }else{
      routine.exercises.splice(rowIndex,1);
      warnings.push(`${day}: the bent-over barbell row was left out because it would load your lower back too close to another loaded torso exercise. Your available equipment does not provide a suitable alternative within this session's time.`);
      if(routine.exercises.length)describeResistanceRoutine(routine,preferences,exercises);
      else routines[index]=recoveryRoutine(day,index,coaching.sessionMinutes,'This day leaves recovery between loaded lower-back exercises; no suitable supported pulling alternative currently fits your equipment and time.');
    }
  });
  routines.forEach(routine=>{
    if(routine.kind==='recovery')return;
    const minutes=estimateRoutineMinutes(routine,exercises);
    if(coaching.sessionMinutes-minutes>=Math.max(10,coaching.sessionMinutes*.2)){
      const reason=novice?'The beginner starting dose limits sets while you build tolerance.':routine.exercises.length<4?'Your available equipment, exclusions and recovery spacing limit complementary exercises.':'The weekly volume ceiling keeps extra work from accumulating just to fill the clock.';
      const note=`${routine.scheduledDay||'Your day'}: ${minutes} min planned / ${coaching.sessionMinutes} min requested. ${reason} Choose fewer, longer resistance days or adjust your equipment/preferences if you want a closer match.`;
      routine.description+=' '+note;
      warnings.push(note);
    }
  });
  const strengthDays=routines.filter(routine=>routine.kind!=='recovery').length;
  const recoveryDays=routines.length-strengthDays;
  const weeklyPatterns=new Set(routines.flatMap(routine=>routine.exercises.map(item=>coachingMovement[item.exerciseId].pattern)));
  if(!weeklyPatterns.has('pull'))warnings.push('Your current options do not include a suitable pulling exercise. A resistance band with a secure anchor, dumbbells or a row machine would help balance your upper-body training.');
  if(!weeklyPatterns.has('push'))warnings.push('No suitable chest/pushing exercise fits this plan. Review the equipment and movement preferences before treating it as a complete weekly program.');
  if(!weeklyPatterns.has('squat'))warnings.push('Knee-dominant leg work is limited by your current choices. The plan does not substitute a deep knee bend you asked to avoid.');
  const estimatedMinutes=Math.max(...routines.map(routine=>estimateRoutineMinutes(routine,exercises)),0);
  const styles=coaching.trainingStyles;
  const bodyweightOnly=styles.length===1&&styles[0]==='Bodyweight';
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
    coaching.sessionMinutes<=15?'These brief sessions use one controlled practice set per exercise. They provide limited training volume; build consistency here, then add time when you can.':beginner(effectivePreferences)?'Start with up to two controlled sets per exercise and a light effort. More reps are not automatically better: stop before technique changes; smaller sessions spread the weekly work without multiplying it.':'Work below failure and progress gradually; the listed rep ranges are starting points, not the only way to reach your goal.',
    `${days.length||1} planned session${days.length<=1?'':'s'} · up to about ${estimatedMinutes} minutes each within your ${coaching.sessionMinutes}-minute preference. Estimates include warm-up, progressive warm-up sets, set rests, equipment setup and both sides of unilateral exercises; equipment waits can add time.`,
    styles.length===1&&styles[0]==='Balanced'?'Exercise choices use your available equipment and balance different movement patterns.':bodyweightOnly?'Your bodyweight preference uses only bodyweight exercises.':`Your selected styles (${styles.join(', ')}) shape the mix of exercises when your equipment and movement preferences allow.`,
  ];
  rationale.push(`${days.length||1} selected day${days.length===1?'':'s'} stay in your plan: ${strengthDays} resistance and ${recoveryDays} active recovery. Full-body or split sessions are chosen around the spacing of those days, not by ranking one split as universally best.`);
  rationale.push('The repeating calendar leaves at least two calendar days between meaningful work for the same muscles and prefers three where practical, including across Sunday to Monday. This is a conservative planning rule: it approximates 48–72 hours only if you train at similar times. Soreness, poor sleep or fatigue can mean you need longer.');
  rationale.push('Presses also count toward triceps and front-deltoid recovery; pulls count toward biceps and rear-deltoids; lower-body lifts share glute work. Loaded hinges, barbell squats and unsupported barbell rows also share substantial spinal-erector demand, so supported pulling alternatives are used when needed. Direct core work is spaced separately. The weekly set budget is spread across your selected days instead of increasing every time you add a day.');
  if(experiencedHypertrophy)rationale.push('The starting allocation uses roughly 10 weekly sets for main movement roles, with complementary accessory work. Compound exercises overlap supporting muscles; these are not independent quotas for every muscle. This is not a proven personal optimum. Increase gradually only if performance and recovery support it.');
  if(youth)rationale.push('Your age changes the starting approach: supervised technique practice, light loads and two to three nonconsecutive resistance days when available, with the rest of your selected days kept easy. No heavy low-rep or maximal testing prescription is included.');
  else if(typeof context.age==='number'&&context.age>=65)rationale.push('Your experience and movement preferences guide the plan; age alone does not set your load or classify your ability. Start at an effort you control, use support where useful and allow extra recovery when you need it.');
  if(estimatedMinutes>0&&coaching.sessionMinutes-estimatedMinutes>=15)rationale.push(`Your ${coaching.sessionMinutes}-minute target could not be fully matched. Some days need less time because of the weekly dose, equipment, or recovery constraints. Each shorter day explains the gap; consider fewer, longer strength days if that fits your preference better.`);
  if(coaching.focusAreas.length)rationale.push(`Extra emphasis rotates across your priorities: ${coaching.focusAreas.join(', ')}. Other muscle groups remain part of the week.`);
  if(coaching.impact==='Low impact'||coaching.avoidMovements.length)rationale.push(`Your movement preferences are applied to every selected exercise${coaching.avoidMovements.length?`: no ${coaching.avoidMovements.join(', ').toLowerCase()}`:''}. There are no jumping drills in this starter plan.`);
  return {routines,rationale,estimatedMinutes,targetMinutes:coaching.sessionMinutes,summary:`${titles[goal]} · ${strengthDays} resistance${recoveryDays?` + ${recoveryDays} recovery`:''} days · up to about ${estimatedMinutes} min`,warnings:[...new Set(warnings)]};
}

export function buildRecommendedRoutine(preferences:Preferences,exercises:Exercise[],context:PlanContext={}):Routine{
  return buildRecommendedPlan(preferences,exercises,context).routines[0];
}

export function recommendationSummary(preferences:Preferences,context:PlanContext={}){
  if(getCoaching(preferences).sessionMinutes<=15)return 'Brief practice · 1 controlled set per exercise · limited volume';
  if(typeof context.age==='number'&&context.age>=13&&context.age<18)return 'Supervised technique practice · 10–15 controlled reps · light effort';
  if(beginner(preferences))return 'Technique first · 2 controlled sets · 60–90 sec or longer to recover';
  const goal=goalType(preferences);
  if(goal==='strength')return 'Strength focus · 5–8 reps on main lifts · up to 3 min rest';
  if(['muscle','glutes','upper'].includes(goal))return 'Muscle focus · 8–15 reps · 2–3 min rest on lifts; shorter holds';
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
  let loadedRehearsals=0;
  routine.exercises.forEach(item=>{
    const exercise=exercises.find(candidate=>candidate.id===item.exerciseId);
    if(!exercise)return;
    const target=warmupKey(exercise.muscle);
    if(seen.has(target))return;
    seen.add(target);
    const hold=isTimedExercise(exercise);
    const side=coachingMovement[exercise.id]?.unilateral?' per side':'';
    const loaded=exercise.equipment!=='Bodyweight'&&!!coachingMovement[exercise.id]?.compound&&loadedRehearsals<2;
    if(loaded)loadedRehearsals++;
    const brief=routine.exercises.reduce((sum,entry)=>sum+entry.sets,0)<=4;
    const seconds=loaded&&!brief?180:45;
    targeted.push({name:`Rehearse ${exercise.name.toLowerCase()}`,dose:loaded&&!brief?'2 gradual warm-up sets · about 3 min':hold?'10–15 easy seconds':`5–8 easy reps${side}`,seconds,target,cue:`Use ${exercise.equipment==='Bodyweight'?'an easy version and a comfortable range':'a much lighter load or resistance than your working sets'}. ${loaded&&!brief?'Begin light, then use a slightly heavier rehearsal set while staying well below fatigue. Allow a short rest and set up your working load. ':''}Follow the same setup shown in the exercise guide; stop if the movement hurts.`});
  });
  return [{name:'Raise your temperature',dose:'2 minutes',seconds:120,target:'Whole body',cue:'Walk or cycle at an easy pace, then gradually increase the pace if comfortable.'},...targeted.slice(0,3)];
}

export function restReason(preferences:Preferences,seconds:number){
  if(beginner(preferences))return `${seconds}s is a starting rest for technique practice. Take longer if breathing or control has not recovered.`;
  if(goalType(preferences)==='strength')return `${seconds}s supports recovery for strong, controlled reps; extend it if the next set would suffer.`;
  if(['muscle','glutes','upper'].includes(goalType(preferences)))return `${seconds}s gives you recovery to keep the next set productive. Rest longer if needed.`;
  return `${seconds}s gives you time to reset. Start the next set when your movement feels controlled.`;
}
