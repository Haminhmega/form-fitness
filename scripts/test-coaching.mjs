import assert from 'node:assert/strict';
import {build} from 'esbuild';

const compiled=await build({stdin:{contents:"export * from './src/training-recommendations.ts'; export * from './src/coaching-exercises.ts'; export {initialExercises,initialPreferences} from './src/data.ts'; export * from './shared/coaching.ts';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false});
const {buildRecommendedPlan,buildRecommendedRoutine,estimateRoutineMinutes,recommendedMuscleGroups,recommendationSummary,buildWarmup,coachingExercises,coachingMovement,initialExercises,initialPreferences,coachingDefaults}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const exercises=[...initialExercises,...coachingExercises];
const byId=new Map(exercises.map(exercise=>[exercise.id,exercise]));
const base={...initialPreferences,goal:'Build muscle',experience:'Some experience',equipment:['Bodyweight','Dumbbells','Machines','Barbell','Bands'],days:['Mon','Wed','Fri'],coaching:coachingDefaults()};
const prefs=(changes={},coaching={})=>({...base,...changes,coaching:{...base.coaching,...coaching}});
const items=plan=>plan.routines.flatMap(routine=>routine.exercises);
const patterns=plan=>items(plan).map(item=>coachingMovement[item.exerciseId].pattern);
const ids=plan=>plan.routines.map(routine=>routine.exercises.map(item=>item.exerciseId));
const make=(changes={},coaching={})=>buildRecommendedPlan(prefs(changes,coaching),exercises);
function checkSessionName(routine){
  assert.ok(routine.name.length<=100,'Session name fits the persisted account schema');
  const selected=routine.exercises.map(item=>coachingMovement[item.exerciseId]);
  if(!selected.length){assert.match(routine.name,/Active recovery/);assert.equal(routine.kind,'recovery');return;}
  const primaryMuscles=new Set(selected.map(movement=>movement.pattern==='calf'?'calves':movement.areas[0].toLowerCase()));
  for(const muscle of ['glutes','legs','chest','back','shoulders','arms','core','calves']){
    assert.equal(routine.name.toLowerCase().includes(muscle),primaryMuscles.has(muscle),`Session title reflects actual ${muscle} work`);
  }
  if(routine.name.startsWith('Push day'))assert.ok(selected.every(movement=>['push','shoulder','core'].includes(movement.pattern)),'Push day never includes a pull or leg exercise');
  if(routine.name.startsWith('Pull day'))assert.ok(selected.every(movement=>['pull','arms','core'].includes(movement.pattern)),'Pull day never includes a press or leg exercise');
  assert.doesNotMatch(routine.name,/Muscle building [A-D]|Glute focus [A-D]|Athletic foundation [A-D]/,'Name describes this session, not only the overall goal');
}

const before=JSON.stringify({base,exercises});
const hypertrophy=make();
const glutes=make({goal:'Grow glutes'});
const strength=make({goal:'Build strength'});
const athletic=make({goal:'Improve athleticism'});
assert.notDeepEqual(ids(hypertrophy),ids(glutes),'Glute growth changes exercise selection, not just the title');
assert.ok(patterns(glutes).includes('push')&&patterns(glutes).includes('pull'),'Glute plans retain both upper-body directions');
assert.equal(coachingMovement[glutes.routines[0].exercises[0].exerciseId].pattern,'glute');
assert.ok(items(glutes).filter(item=>coachingMovement[item.exerciseId].areas.includes('Glutes')).length>=5,'Glute emphasis recurs through the week');
assert.notDeepEqual(ids(athletic),ids(hypertrophy),'Athleticism changes selected movements');
assert.ok(items(athletic).some(item=>coachingMovement[item.exerciseId].balance),'Athletic foundation includes supported control/balance');
assert.match(athletic.rationale[0],/general foundation/);
assert.ok(items(strength).some(item=>item.rest===150&&item.reps==='5–8'));
assert.ok(items(hypertrophy).some(item=>item.rest===120&&item.reps==='8–12'));
assert.ok(items(glutes).some(item=>!coachingMovement[item.exerciseId].compound&&item.rest===90&&item.reps==='10–15'),'Accessory work uses its own rep/rest range, not a compound prescription');
assert.ok(items(hypertrophy).every(item=>item.notes.length>80),'Each prescription explains selection and effort/progression');
assert.equal(JSON.stringify({base,exercises}),before,'Planner never mutates exercises or preferences');
assert.equal(hypertrophy.routines[0].id,'form-recommended');
assert.equal(new Set(hypertrophy.routines.map(routine=>routine.id)).size,3);
assert.equal(new Set(ids(hypertrophy).map(day=>day.join('|'))).size,3,'Separate days contain different exercise combinations');
assert.equal(new Set(hypertrophy.routines.map(routine=>routine.name)).size,3,'Day suffixes distinguish repeated muscle combinations');
assert.match(hypertrophy.routines[0].name,/Monday/);
hypertrophy.routines.forEach(checkSessionName);
assert.deepEqual(buildRecommendedRoutine(base,exercises),hypertrophy.routines[0]);

const shoulderFocus=make({}, {focusAreas:['Shoulders']});
assert.equal(coachingMovement[shoulderFocus.routines[0].exercises[0].exerciseId].pattern,'shoulder','Explicit area focus changes the early exercise slots');
const running=make({goal:'Improve athleticism'}, {sportFocus:'Running'});
assert.equal(coachingMovement[running.routines[0].exercises[1].exerciseId].pattern,'calf','Running foundation includes calf training early enough to fit the time budget');
for(const sessionMinutes of [20,75]){
  const shortRunning=make({goal:'Improve athleticism',experience:'Getting started',equipment:['Bodyweight']},{sportFocus:'Running',sessionMinutes,avoidMovements:['Floor exercises']});
  for(const routine of shortRunning.routines){
    const selectedPatterns=routine.exercises.map(item=>coachingMovement[item.exerciseId].pattern);
    assert.equal(new Set(selectedPatterns).size,selectedPatterns.length,'Running overrides never select two hinge variants in one session');
    assert.ok(estimateRoutineMinutes(routine,exercises)<=sessionMinutes);
  }
  assert.equal(/trunk control/.test(shortRunning.rationale[0]),patterns(shortRunning).includes('core'),'Athletic rationale only claims trunk work when the time budget includes it');
  assert.equal(/calf strength/.test(shortRunning.rationale[0]),patterns(shortRunning).includes('calf'));
}
const novice=make({experience:'Getting started',goal:'Grow glutes'});
assert.ok(items(novice).every(item=>item.sets>=1&&item.sets<=2),'Beginners receive small sets distributed across their weekly plan');
assert.ok(items(novice).every(item=>!coachingMovement[item.exerciseId].experienced));
assert.match(novice.rationale[1],/More reps are not automatically better/);

const week=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const allDays=make({experience:'Getting started',days:week});
assert.equal(allDays.routines.length,7,'Every selected day remains in the plan');
assert.equal(allDays.routines.filter(routine=>routine.kind==='recovery').length,1,'Seven days include recovery instead of adding a seventh resistance dose');
assert.ok(allDays.rationale.some(reason=>/without multiplying|instead of increasing/.test(reason)));
const experiencedWeek=make({experience:'Experienced',days:week});
assert.equal(experiencedWeek.routines.length,7);
assert.match(experiencedWeek.routines[0].description,/lower-body/);
assert.match(experiencedWeek.routines[1].description,/upper-body/);
assert.ok(experiencedWeek.rationale.some(reason=>/similar times/.test(reason)));
assert.equal(make({days:['Sat']}).routines.length,1);
assert.equal(make({days:['Mon','Tue'],experience:'Getting started'}).routines.length,2,'Adjacent selected days become complementary splits instead of dropping a day');
const noDays=make({days:[]});
assert.equal(noDays.routines.length,1,'No availability still gives a reviewable unscheduled starter, not a crash');
assert.ok(noDays.warnings.some(warning=>/Choose at least one/.test(warning)));
assert.ok(buildRecommendedPlan(initialPreferences,exercises).routines.length>0,'Older accounts without coaching preferences retain safe defaults');

const avoids=['Jumping','Overhead pressing','Deep knee bends','Floor exercises'];
const timeLimits=[10,15,20,25,30,45,60,75,90,120];
let checked=0;
for(const goal of ['Learn the basics','Grow glutes','Build muscle','Build strength','Improve athleticism','Build upper body','Manage weight']){
  for(const experience of ['Getting started','Experienced']){
    for(const equipment of [['Bodyweight'],['Bodyweight','Dumbbells'],['Bodyweight','Machines'],['Bodyweight','Barbell'],['Bodyweight','Bands']]){
      for(const sessionMinutes of timeLimits){
        const configuration=prefs({goal,experience,equipment},{sessionMinutes,impact:'Low impact',avoidMovements:avoids});
        const plan=buildRecommendedPlan(configuration,exercises);
        for(const routine of plan.routines){
          checkSessionName(routine);
          assert.ok(estimateRoutineMinutes(routine,exercises)<=sessionMinutes,'Estimated work, both sides, warm-up and rest fit the selected time');
          assert.equal(new Set(routine.exercises.map(item=>item.exerciseId)).size,routine.exercises.length);
          assert.equal(new Set(routine.exercises.map(item=>coachingMovement[item.exerciseId].pattern)).size,routine.exercises.length,'Every session reserves each pattern for one movement');
          for(const item of routine.exercises){
            const exercise=byId.get(item.exerciseId);
            const meta=coachingMovement[item.exerciseId];
            assert.ok(!meta.floor&&!meta.overhead&&!meta.deepKnee,'Hard movement exclusions apply even with limited equipment');
            assert.ok(!/jump|plyometric/i.test(exercise.name));
            const equipmentGroup=/machine|cable/i.test(exercise.equipment)?'Machines':/band/i.test(exercise.equipment)?'Bands':exercise.equipment;
            assert.ok(equipmentGroup==='Bodyweight'||equipment.includes(equipmentGroup),`No unavailable equipment: ${exercise.name}`);
          }
          const warmup=buildWarmup(routine,exercises);
          assert.equal(warmup[0].target,'Whole body');
          assert.equal(new Set(warmup.map(move=>move.target)).size,warmup.length);
          for(const move of warmup.slice(1))assert.ok(routine.exercises.some(item=>move.name===`Rehearse ${byId.get(item.exerciseId).name.toLowerCase()}`),'Warmups derive from the actual allowed session');
        }
        checked++;
      }
    }
  }
}
const bodyweightStyle=make({}, {trainingStyle:'Bodyweight'});
assert.ok(items(bodyweightStyle).every(item=>byId.get(item.exerciseId).equipment==='Bodyweight'));
assert.ok(bodyweightStyle.warnings.some(warning=>/pulling exercise/.test(warning)),'Bodyweight-only plan honestly reports missing pulling equipment');
const machines=make({}, {trainingStyle:'Machines'});
assert.ok(items(machines).filter(item=>/machine|cable/i.test(byId.get(item.exerciseId).equipment)).length>items(hypertrophy).filter(item=>/machine|cable/i.test(byId.get(item.exerciseId).equipment)).length,'Style affects ranking of available alternatives');
const explicitBodyweight=make({}, {trainingStyle:'Machines',trainingStyles:['Bodyweight']});
assert.deepEqual(ids(explicitBodyweight),ids(bodyweightStyle),'New style selections take precedence over the old single choice');
for(const trainingStyles of [['Free weights','Machines'],['Bodyweight','Machines'],['Balanced','Bodyweight'],['Balanced','Free weights','Machines']]){
  const mixed=make({}, {trainingStyle:'Bodyweight',trainingStyles});
  assert.ok(items(mixed).some(item=>byId.get(item.exerciseId).equipment!=='Bodyweight'),'A mixed selection including legacy Bodyweight permits loaded work');
  if(trainingStyles.includes('Free weights'))assert.ok(items(mixed).some(item=>['Dumbbells','Barbell'].includes(byId.get(item.exerciseId).equipment)),'Requested free weights appear when available');
  if(trainingStyles.includes('Machines'))assert.ok(items(mixed).some(item=>/machine|cable/i.test(byId.get(item.exerciseId).equipment)),'Requested machines appear when available');
  if(trainingStyles.includes('Bodyweight'))assert.ok(items(mixed).some(item=>byId.get(item.exerciseId).equipment==='Bodyweight'),'Requested bodyweight work appears in a mixed plan');
  mixed.routines.forEach(checkSessionName);
}
const unavailableMix=make({equipment:['Bodyweight']},{trainingStyles:['Free weights','Machines']});
assert.ok(items(unavailableMix).every(item=>byId.get(item.exerciseId).equipment==='Bodyweight'),'Styles never invent unavailable equipment');
for(const sessionMinutes of [10,15]){
  const short=make({experience:'Getting started'}, {sessionMinutes});
  assert.ok(items(short).length>0);
  assert.ok(items(short).every(item=>item.sets===1),'Brief sessions fit practice sets rather than rushing normal volume');
  assert.ok(short.routines.every(routine=>/brief practice with limited volume/.test(routine.description)&&!/full-body practice/.test(routine.description)));
  assert.ok(short.rationale.some(reason=>/limited training volume/.test(reason)));
}
const longPlan=make({}, {sessionMinutes:120});
assert.ok(longPlan.estimatedMinutes<90,'Long time allowance is not filled with unnecessary volume');
assert.ok(items(longPlan).every(item=>item.sets<=3));
assert.ok(longPlan.rationale.some(reason=>/not a requirement to fill/.test(reason)));
const narrowPush=buildRecommendedPlan(prefs({days:['Mon']},{sessionMinutes:60}),exercises.filter(exercise=>['coach-wall-pushup','press'].includes(exercise.id)));
assert.match(narrowPush.routines[0].name,/^Push day · Chest · Monday$/,'A shoulder title is omitted when the weekly dose only includes chest work');
checkSessionName(narrowPush.routines[0]);
const narrowPull=buildRecommendedPlan(prefs({days:['Fri']},{sessionMinutes:60,focusAreas:['Arms']}),exercises.filter(exercise=>['row','curl'].includes(exercise.id)));
assert.match(narrowPull.routines[0].name,/^Pull day · Arms & back · Friday$/);
checkSessionName(narrowPull.routines[0]);
const impossible=buildRecommendedPlan(prefs({}, {avoidMovements:avoids}),initialExercises.filter(exercise=>exercise.id==='plank'||exercise.id==='press'||exercise.id==='squat'));
assert.equal(items(impossible).length,0,'Never silently insert an excluded exercise when no match exists');
assert.ok(impossible.warnings.some(warning=>/0 matching/.test(warning)));
assert.ok(impossible.routines.every(routine=>routine.kind==='recovery'),'Impossible resistance constraints are shown as recovery, not an empty workout');
assert.equal(impossible.estimatedMinutes,20);
impossible.routines.forEach(checkSessionName);
assert.equal(buildRecommendedPlan(base,[]).routines[0].exercises.length,0);
assert.ok(coachingExercises.every(exercise=>exercise.supported===false&&exercise.supportLevel==='logging_only'),'Curated coaching movements never get unearned AI support badges');
assert.ok(coachingExercises.every(exercise=>exercise.instructions.split('. ').length>=3),'Added movements include usable setup and execution instructions');

function assertRecoverySpacing(plan,selectedDays){
  assert.deepEqual(plan.routines.map(routine=>routine.scheduledDay),selectedDays,'Every selected weekday is returned exactly once and no extra day is invented');
  const exposures=new Map();
  for(const routine of plan.routines){
    checkSessionName(routine);
    if(routine.kind==='recovery'){
      assert.equal(routine.exercises.length,0);
      assert.ok(routine.recovery.steps.length>=3&&routine.recovery.minutes>=10&&routine.recovery.minutes<=20);
      assert.equal(estimateRoutineMinutes(routine,exercises),routine.recovery.minutes);
    }
    for(const muscle of recommendedMuscleGroups(routine)){
      const days=exposures.get(muscle)||[];
      days.push(week.indexOf(routine.scheduledDay));
      exposures.set(muscle,days);
    }
  }
  for(const [muscle,days] of exposures){
    for(let index=0;index<days.length;index++){
      const gap=(days[(index+1)%days.length]-days[index]+7)%7||7;
      assert.ok(gap>=2,`${muscle} receives at least two calendar days before repeat work, including week wrap`);
    }
  }
}
const scheduleStart=performance.now();
let schedulesChecked=0;
for(let mask=1;mask<128;mask++){
  const days=week.filter((_,index)=>mask&(1<<index));
  for(const age of [16,30,70]){
    const configuration=prefs({days,experience:'Experienced'},{sessionMinutes:90});
    const plan=buildRecommendedPlan(configuration,exercises,{age});
    assertRecoverySpacing(plan,days);
    if(age<18){
      const resistance=plan.routines.filter(routine=>routine.kind!=='recovery');
      assert.ok(resistance.length<=3,'Youth retain all selected days but at most three resistance days');
      assert.ok(items(plan).every(item=>item.reps!=='5–8'&&item.sets<=2&&!coachingMovement[item.exerciseId].experienced));
    }
    schedulesChecked++;
  }
}
assert.ok(performance.now()-scheduleStart<8000,'All127schedules across ages run within a practical regression budget');
const worstStart=performance.now();
for(let index=0;index<100;index++)buildRecommendedPlan(prefs({days:week},{sessionMinutes:120}),exercises);
assert.ok(performance.now()-worstStart<1500,'Cached seven-day planning remains interactive');
const sixDays=make({days:week.slice(0,6),experience:'Getting started'},{sessionMinutes:90});
assert.equal(sixDays.routines.filter(routine=>routine.kind==='recovery').length,0,'Six adult days can fit a lower/push/pull split twice');
assert.ok(sixDays.routines.every(routine=>routine.exercises.length<=4),'Dense beginner weeks use small sessions');
for(const experience of ['Getting started','Experienced']){
  const spaced=make({experience,days:['Mon','Wed','Fri']},{sessionMinutes:120});
  const spread=make({experience,days:week.slice(0,6)},{sessionMinutes:120});
  const sets=plan=>items(plan).reduce((sum,item)=>sum+item.sets,0);
  if(experience==='Getting started')assert.ok(sets(spread)<=sets(spaced),'Adding more beginner days distributes rather than multiplies the weekly dose');
  else{
    const mainSets=(plan,pattern)=>items(plan).filter(item=>coachingMovement[item.exerciseId].pattern===pattern).reduce((sum,item)=>sum+item.sets,0);
    assert.equal(mainSets(spread,'push'),10);
    assert.equal(mainSets(spread,'pull'),10);
    assert.equal(mainSets(spread,'push'),mainSets(spaced,'push'),'Experienced main pressing dose is distributed, not doubled, across six days');
    assert.equal(mainSets(spread,'pull'),mainSets(spaced,'pull'),'Experienced main pulling dose is distributed, not doubled, across six days');
    assert.ok(sets(spread)<=52&&sets(spaced)<=52,'Both formats share the same total weekly budget; some accessories may not fit shorter day structures');
  }
}
const adult=buildRecommendedPlan(prefs({days:week,experience:'Experienced'}),exercises,{age:30});
const older=buildRecommendedPlan(prefs({days:week,experience:'Experienced'}),exercises,{age:70});
assert.deepEqual(ids(older),ids(adult),'Age alone does not classify an experienced older adult as a beginner');
assert.ok(older.rationale.some(reason=>/age alone does not/i.test(reason)));
const teenStrength=buildRecommendedPlan(prefs({goal:'Build strength',days:week,experience:'Experienced'}),exercises,{age:16});
assert.ok(items(teenStrength).every(item=>item.reps==='10–15'||item.reps==='20–30 sec'),'Youth strength goal keeps controlled technique practice, not heavy low-rep prescriptions');
assert.ok(teenStrength.warnings.some(warning=>/qualified supervision/.test(warning)));
assert.match(recommendationSummary(prefs({goal:'Build strength',experience:'Experienced'}),{age:16}),/10–15 controlled reps/,'Youth dashboard summary matches the technique prescription');
assert.doesNotMatch(recommendationSummary(prefs({goal:'Build strength',experience:'Experienced'}),{age:16}),/5–8/);
assert.deepEqual(buildRecommendedRoutine(prefs({days:week}),exercises,{age:16}),buildRecommendedPlan(prefs({days:week}),exercises,{age:16}).routines[0]);
const fullBody=make({days:['Mon','Wed','Fri']});
assert.ok(fullBody.routines.every(routine=>recommendedMuscleGroups(routine).includes('Chest')&&recommendedMuscleGroups(routine).includes('Back')&&recommendedMuscleGroups(routine).includes('Glutes')),'Three spaced days retain full-body coverage rather than forcing PPL');
const experiencedMuscle=make({experience:'Experienced',days:week.slice(0,6)},{sessionMinutes:120});
const beginnerMuscle=make({experience:'Getting started',days:week.slice(0,6)},{sessionMinutes:120});
const workSets=plan=>items(plan).reduce((sum,item)=>sum+item.sets,0);
assert.ok(workSets(experiencedMuscle)>workSets(beginnerMuscle)*1.5,'An experienced hypertrophy plan has a substantive larger starting dose than a beginner technique plan');
assert.ok(experiencedMuscle.rationale.some(reason=>/about 10 weekly main/.test(reason)&&/not a proven personal optimum/.test(reason)));
const briefMuscle=make({experience:'Experienced',days:week.slice(0,6)},{sessionMinutes:15});
assert.ok(workSets(briefMuscle)<workSets(experiencedMuscle),'Short available time reduces dose instead of shortening prescribed rests');
assert.ok(experiencedMuscle.estimatedMinutes<90,'A two-hour allowance still does not force excess volume');

const barbellConfig=prefs({days:week.slice(0,6),experience:'Experienced',goal:'Build strength',equipment:['Bodyweight','Barbell']},{sessionMinutes:60,trainingStyles:['Free weights']});
const barbellOnly=buildRecommendedPlan(barbellConfig,exercises);
assertRecoverySpacing(barbellOnly,barbellConfig.days);
assert.equal(barbellOnly.routines.find(routine=>routine.scheduledDay==='Wed').kind,'recovery','Unsupported Wednesday rows yield to recovery before Thursday loaded hinges');
assert.ok(barbellOnly.routines.find(routine=>routine.scheduledDay==='Sat').exercises.some(item=>item.exerciseId==='gym-1640-bent-over-barbell-row'),'A sufficiently spaced unsupported row is preserved');
assert.ok(barbellOnly.warnings.some(warning=>/lower back too close/.test(warning)));
const supportedAlternatives=buildRecommendedPlan({...barbellConfig,equipment:['Bodyweight','Barbell','Machines']},exercises);
const supportedWednesday=supportedAlternatives.routines.find(routine=>routine.scheduledDay==='Wed');
assert.ok(supportedWednesday.exercises.some(item=>coachingMovement[item.exerciseId].pattern==='pull'),'Available supported machine replaces the unsupported row');
assert.ok(!recommendedMuscleGroups(supportedWednesday).includes('Spinal erectors'));
assertRecoverySpacing(supportedAlternatives,barbellConfig.days);
assert.ok(recommendedMuscleGroups({exercises:[{exerciseId:'gym-1640-bent-over-barbell-row'}]}).includes('Spinal erectors'));
assert.ok(recommendedMuscleGroups({exercises:[{exerciseId:'rdl'}]}).includes('Spinal erectors'));
assert.ok(!recommendedMuscleGroups({exercises:[{exerciseId:'row'}]}).includes('Spinal erectors'),'A bench-supported row is not treated as the same substantial unsupported-torso loading');
for(let mask=1;mask<128;mask++){
  const days=week.filter((_,index)=>mask&(1<<index));
  assertRecoverySpacing(buildRecommendedPlan({...barbellConfig,days},exercises),days);
  schedulesChecked++;
}
console.log(`Coaching checks passed: ${checked} goal/experience/equipment/time combinations and ${schedulesChecked} cyclic weekly schedules, mixed styles, secondary muscle recovery, youth/older-adult context, weekly volume, honest titles, warmups and no input mutation.`);
