import assert from 'node:assert/strict';
import {build} from 'esbuild';
const output=await build({stdin:{contents:"export * from './src/training-recommendations';export * from './src/coaching-exercises';export * from './src/training-duration';export * from './src/data';export * from './shared/coaching';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false});
const {buildRecommendedPlan,estimateRoutineMinutes,buildWarmup,coachingMovement,coachingRole,weeklyTrainingDose,trainingDurationAdvice,coachingExercises,initialExercises,initialPreferences,coachingDefaults}=await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].text).toString('base64'));
const exercises=[...initialExercises,...coachingExercises],week=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const schedules=[['Mon'],['Mon','Thu'],['Mon','Wed','Fri'],['Mon','Tue','Thu','Fri'],week.slice(0,5),week.slice(0,6),week];
const preferences={...initialPreferences,equipment:['Bodyweight','Dumbbells','Machines','Barbell','Bands'],coaching:coachingDefaults()};
let cases=0;
const report=[];
for(const goal of ['Build aesthetic physique','Grow glutes','Build strength','Improve athleticism','Build consistency','Improve fitness','Lose weight'])for(const experience of ['Getting started','Some experience','Experienced'])for(const days of schedules)for(let minutes=10;minutes<=120;minutes+=5){
  const prefs={...preferences,goal,experience,days,coaching:{...preferences.coaching,sessionMinutes:minutes}};
  const plan=buildRecommendedPlan(prefs,exercises);
  assert.equal(plan.targetMinutes,minutes);
  assert.deepEqual(plan.routines.map(r=>r.scheduledDay),days);
  for(const routine of plan.routines){
    const actual=estimateRoutineMinutes(routine,exercises);
    assert.ok(actual<=minutes,`${goal}/${experience}/${days.length}/${minutes}: ${actual}`);
    if(routine.kind==='recovery')continue;
    assert.equal(new Set(routine.exercises.map(item=>coachingRole(item.exerciseId))).size,routine.exercises.length,'No equivalent movement roles repeated');
    const order=routine.exercises.map(item=>Number(!!coachingMovement[item.exerciseId].compound));
    assert.deepEqual(order,[...order].sort((a,b)=>b-a),'Main lifts precede assistance work');
    const warmupSeconds=buildWarmup(routine,exercises).reduce((sum,move)=>sum+move.seconds,0);
    assert.ok(warmupSeconds>0&&warmupSeconds<actual*60,'Warm-up is part of, not additional to, the estimate');
    if(minutes-actual>=Math.max(10,minutes*.2))assert.ok(plan.warnings.some(w=>w.includes(`${routine.scheduledDay}: ${actual} min planned / ${minutes} min requested`)),'Every significant time gap is explained individually');
    assert.ok(routine.description.length<=1000);
  }
  assert.ok(Object.values(weeklyTrainingDose(plan.routines)).every(sets=>sets<=(experience==='Getting started'?12:18)),'Longer time cannot bypass the weekly muscle workload cap');
  if(goal==='Build aesthetic physique'&&experience==='Experienced'&&days.length===6&&[15,30,45,60,75,90,120].includes(minutes))report.push({target:minutes,planned:plan.routines.map(r=>estimateRoutineMinutes(r,exercises)),exercises:plan.routines.map(r=>r.exercises.length)});
  if(goal==='Build aesthetic physique'&&experience==='Experienced'&&days.length===6&&minutes===75){
    assert.ok(plan.routines.every(r=>r.exercises.length>=5&&estimateRoutineMinutes(r,exercises)>=60),'75-minute full-gym six-day plan has substantial sessions, not two-exercise placeholders');
    const push=plan.routines[1],pull=plan.routines[2];
    const roles=r=>new Set(r.exercises.map(item=>coachingRole(item.exerciseId)));
    for(const role of ['push','shoulder','lateral-raise','triceps'])assert.ok(roles(push).has(role));
    for(const role of ['pull','vertical-pull','arms','rear-delt'])assert.ok(roles(pull).has(role));
  }
  const advice=trainingDurationAdvice(prefs);
  assert.ok(advice.selected.length>50);
  cases++;
}
assert.deepEqual(trainingDurationAdvice({...preferences,experience:'Getting started'}).range,[30,45]);
assert.deepEqual(trainingDurationAdvice({...preferences,experience:'Experienced',goal:'Build strength'}).range,[60,90]);
assert.deepEqual(trainingDurationAdvice({...preferences,experience:'Experienced',goal:'Build strength'},16).range,[30,45]);
assert.deepEqual(trainingDurationAdvice({...preferences,experience:'Experienced',goal:'Build aesthetic physique'},70).range,[45,60],'Age alone does not downgrade experience');
console.log(`Duration checks passed: ${cases} plans, all 23 slider values, one–seven days, seven goals and three experience levels.`);
console.log(JSON.stringify(report));
