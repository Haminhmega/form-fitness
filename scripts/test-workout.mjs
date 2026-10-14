import assert from 'node:assert/strict';
import {build} from 'esbuild';

const result=await build({
  stdin:{contents:"export {createWorkoutSession,createHistoryEntry} from './src/domain/workout.ts';",resolveDir:process.cwd()},
  bundle:true,
  format:'esm',
  platform:'node',
  write:false,
});
const {createWorkoutSession,createHistoryEntry}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));

const exercise={id:'squat',name:'Back squat',muscle:'Legs',equipment:'Barbell',supported:true,instructions:'',variation:'',filming:''};
const routine={id:'strength',name:'Strength day',description:'',exercises:[{exerciseId:'squat',sets:3,reps:'8-10',rest:90,notes:''}]};
const history=[{id:'old',name:'Strength day',date:'2026-10-13',duration:30,sets:2,volume:1050,feedback:false,exercises:[{exerciseId:'squat',name:'Old squat name',sets:[{id:'old-1',weight:50,reps:10,done:true},{id:'old-2',weight:55,reps:10,done:true}]}]}];
let id=0;
const session=createWorkoutSession(routine,[exercise],history,1_000,()=>`id-${++id}`);
assert.equal(session.startedAt,1_000);
assert.deepEqual(session.logs.squat.map(set=>[set.weight,set.reps,set.done]),[[50,10,false],[55,10,false],[55,8,false]]);
session.logs.squat[0].done=true;
const completed=createHistoryEntry(session,[exercise],61_000,'2026-10-14');
assert.equal(completed.duration,1);
assert.equal(completed.sets,1);
assert.equal(completed.volume,500);
assert.equal(completed.exercises[0].exerciseId,'squat');
assert.deepEqual(completed.exercises[0].sets.map(set=>set.id),['id-1']);

console.log('Workout domain checks passed: previous performance, session creation, completed-set filtering and history totals.');
