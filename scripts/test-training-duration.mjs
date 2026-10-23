import assert from 'node:assert/strict';
import {build} from 'esbuild';
const output=await build({stdin:{contents:"export * from './src/training-recommendations';export * from './src/coaching-exercises';export * from './src/training-duration';export * from './src/data';export * from './shared/coaching';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false});
const {buildRecommendedPlan,estimateRoutineMinutes,routineTiming,buildWarmup,coachingMovement,coachingRole,weeklyTrainingDose,trainingDurationAdvice,coachingExercises,initialExercises,initialPreferences,coachingDefaults}=await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].text).toString('base64'));
const exercises=[...initialExercises,...coachingExercises],week=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const schedules=[['Mon'],['Mon','Thu'],['Mon','Wed','Fri'],['Mon','Tue','Thu','Fri'],week.slice(0,5),week.slice(0,6),week];
const preferences={...initialPreferences,equipment:['Bodyweight','Dumbbells','Machines','Barbell','Bands'],coaching:coachingDefaults()};
let cases=0;
const report=[];
for(const goal of ['Build muscle & strength','Build aesthetic physique','Grow glutes','Build strength','Improve athleticism','Build consistency','Improve fitness','Lose weight'])for(const experience of ['Getting started','Some experience','Experienced'])for(const days of schedules)for(let minutes=10;minutes<=120;minutes+=5){
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
    if(minutes-actual>=Math.max(5,minutes*.1))assert.ok(plan.warnings.some(w=>w.includes(`${routine.scheduledDay}: ${actual} min planned / ${minutes} min requested`)),'Every significant time gap is explained individually');
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
  if(goal==='Build muscle & strength'&&experience!=='Getting started'&&days.length>=3&&days.length<=6&&[60,75,90].includes(minutes)){
    for(const routine of plan.routines.filter(r=>r.kind!=='recovery')){
      const timing=routineTiming(routine,exercises);
      assert.ok(timing.totalMinutes>=minutes*.68,'Combined goal does not return a 30-minute placeholder for a 60–90-minute full-gym session');
      if(days.length<=4)assert.ok(timing.totalMinutes>=minutes*.85,'Three/four-day full-gym plans substantially use the requested time');
      assert.ok(routine.exercises.length>=4&&timing.sets>=11,'Substantive exercise coverage and working sets');
      assert.ok(routine.exercises.some(item=>item.reps==='6–8'&&item.rest===240),'Strength-focused main lift');
      assert.ok(routine.exercises.some(item=>['8–12','10–15','20–40 sec'].includes(item.reps)),'Complementary assistance');
      assert.ok(routine.exercises.filter(item=>item.reps==='6–8').length<=2,'At most two strength-focused main lifts');
      assert.equal(timing.totalMinutes,Math.ceil((timing.warmupSeconds+timing.workSeconds+timing.restSeconds+timing.setupSeconds)/60),'Breakdown reconciles exactly');
    }
  }
  const advice=trainingDurationAdvice(prefs);
  assert.ok(advice.selected.length>50);
  cases++;
}
assert.deepEqual(trainingDurationAdvice({...preferences,experience:'Getting started'}).range,[60,75,90]);
assert.deepEqual(trainingDurationAdvice({...preferences,experience:'Experienced',goal:'Build strength'}).range,[60,75,90]);
assert.deepEqual(trainingDurationAdvice({...preferences,experience:'Experienced',goal:'Build strength'},16).range,[60,75,90]);
assert.deepEqual(trainingDurationAdvice({...preferences,experience:'Experienced',goal:'Build aesthetic physique'},70).range,[60,75,90],'Age alone does not downgrade experience');
console.log(`Duration checks passed: ${cases} plans, all 23 slider values, one–seven days, eight goals and three experience levels.`);
console.log(JSON.stringify(report));
