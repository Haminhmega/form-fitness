import assert from 'node:assert/strict';
import {build} from 'esbuild';

const compiled=await build({stdin:{contents:"export * from './src/training-recommendations.ts'; export * from './src/coaching-exercises.ts'; export {initialExercises,initialPreferences} from './src/data.ts'; export * from './shared/coaching.ts';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false});
const {buildRecommendedPlan,buildRecommendedRoutine,estimateRoutineMinutes,buildWarmup,coachingExercises,coachingMovement,initialExercises,initialPreferences,coachingDefaults}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const exercises=[...initialExercises,...coachingExercises];
const byId=new Map(exercises.map(exercise=>[exercise.id,exercise]));
const base={...initialPreferences,goal:'Build muscle',experience:'Some experience',equipment:['Bodyweight','Dumbbells','Machines','Barbell','Bands'],days:['Mon','Wed','Fri'],coaching:coachingDefaults()};
const prefs=(changes={},coaching={})=>({...base,...changes,coaching:{...base.coaching,...coaching}});
const items=plan=>plan.routines.flatMap(routine=>routine.exercises);
const patterns=plan=>items(plan).map(item=>coachingMovement[item.exerciseId].pattern);
const ids=plan=>plan.routines.map(routine=>routine.exercises.map(item=>item.exerciseId));
const make=(changes={},coaching={})=>buildRecommendedPlan(prefs(changes,coaching),exercises);

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
assert.ok(items(novice).every(item=>item.sets===2));
assert.ok(items(novice).every(item=>!coachingMovement[item.exerciseId].experienced));
assert.match(novice.rationale[1],/More reps are not automatically better/);

const week=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const allDays=make({experience:'Getting started',days:week});
assert.equal(allDays.routines.length,3,'Seven available days never turn into seven novice lifting days');
assert.ok(allDays.warnings.some(warning=>/remaining days for recovery/.test(warning)));
assert.ok(!allDays.warnings.some(warning=>/consecutive/.test(warning)),'Planner selects separated days where available');
const experiencedWeek=make({experience:'Experienced',days:week});
assert.equal(experiencedWeek.routines.length,4);
assert.match(experiencedWeek.routines[0].description,/lower-body/);
assert.match(experiencedWeek.routines[1].description,/upper-body/);
assert.ok(experiencedWeek.warnings.some(warning=>/adjacent/.test(warning)));
assert.equal(make({days:['Sat']}).routines.length,1);
assert.ok(make({days:['Mon','Tue'],experience:'Getting started'}).warnings.some(warning=>/consecutive/.test(warning)));
const noDays=make({days:[]});
assert.equal(noDays.routines.length,1,'No availability still gives a reviewable unscheduled starter, not a crash');
assert.ok(noDays.warnings.some(warning=>/Choose at least one/.test(warning)));
assert.ok(buildRecommendedPlan(initialPreferences,exercises).routines.length>0,'Older accounts without coaching preferences retain safe defaults');

const avoids=['Jumping','Overhead pressing','Deep knee bends','Floor exercises'];
const timeLimits=[20,30,45,60,75];
let checked=0;
for(const goal of ['Learn the basics','Grow glutes','Build muscle','Build strength','Improve athleticism','Build upper body','Manage weight']){
  for(const experience of ['Getting started','Experienced']){
    for(const equipment of [['Bodyweight'],['Bodyweight','Dumbbells'],['Bodyweight','Machines'],['Bodyweight','Barbell'],['Bodyweight','Bands']]){
      for(const sessionMinutes of timeLimits){
        const configuration=prefs({goal,experience,equipment},{sessionMinutes,impact:'Low impact',avoidMovements:avoids});
        const plan=buildRecommendedPlan(configuration,exercises);
        for(const routine of plan.routines){
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
const impossible=buildRecommendedPlan(prefs({}, {avoidMovements:avoids}),initialExercises.filter(exercise=>exercise.id==='plank'||exercise.id==='press'||exercise.id==='squat'));
assert.equal(items(impossible).length,0,'Never silently insert an excluded exercise when no match exists');
assert.ok(impossible.warnings.some(warning=>/0 matching/.test(warning)));
assert.equal(impossible.estimatedMinutes,0);
assert.equal(buildRecommendedPlan(base,[]).routines[0].exercises.length,0);
assert.ok(coachingExercises.every(exercise=>exercise.supported===false&&exercise.supportLevel==='logging_only'),'Curated coaching movements never get unearned AI support badges');
assert.ok(coachingExercises.every(exercise=>exercise.instructions.split('. ').length>=3),'Added movements include usable setup and execution instructions');
console.log(`Coaching checks passed: ${checked} goal/experience/equipment/time combinations, exclusions, warmups, progression, schedule spacing, focus areas, legacy accounts and no input mutation.`);
