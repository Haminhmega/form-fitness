import assert from 'node:assert/strict';
import {build} from 'esbuild';

const result=await build({
  stdin:{contents:"export {createWorkoutSession,createHistoryEntry,parseRepRange,getProgressionCue,selectNextRoutine} from './src/domain/workout.ts';",resolveDir:process.cwd()},
  bundle:true,
  format:'esm',
  platform:'node',
  write:false,
});
const {createWorkoutSession,createHistoryEntry,parseRepRange,getProgressionCue,selectNextRoutine}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));

const exercise={id:'squat',name:'Back squat',muscle:'Legs',equipment:'Barbell',supported:true,instructions:'',variation:'',filming:''};
const routine={id:'strength',name:'Strength day',description:'',exercises:[{exerciseId:'squat',sets:3,reps:'8-10',rest:90,notes:''}]};
const history=[{id:'old',name:'Strength day',date:'2026-10-13',duration:30,sets:2,volume:1050,feedback:false,exercises:[{exerciseId:'squat',name:'Old squat name',sets:[{id:'old-1',weight:50,reps:10,done:true},{id:'old-2',weight:55,reps:10,done:true}]}]}];
let id=0;
const session=createWorkoutSession(routine,[exercise],history,1_000,()=>`id-${++id}`);
assert.equal(session.startedAt,1_000);
assert.deepEqual(session.logs.squat.map(set=>[set.weight,set.reps,set.done]),[[50,10,false],[55,10,false],[55,8,false]]);
session.logs.squat[0].done=true;
session.notes.squat='Keep knees tracking over toes.';
const completed=createHistoryEntry(session,[exercise],61_000,'2026-10-14');
assert.equal(completed.duration,1);
assert.equal(completed.sets,1);
assert.equal(completed.volume,500);
assert.equal(completed.exercises[0].exerciseId,'squat');
assert.equal(completed.routineId,'strength');
assert.equal(completed.completedAt,'1970-01-01T00:01:01.000Z');
assert.equal(completed.exercises[0].notes,'Keep knees tracking over toes.');
assert.deepEqual(completed.exercises[0].sets.map(set=>set.id),['id-1']);

const routineNoteSession=createWorkoutSession({...routine,exercises:[{...routine.exercises[0],notes:'Pinned setup note'}]},[exercise],[],2_000,()=>`note-${++id}`);
routineNoteSession.logs.squat[0].done=true;
const routineNoteHistory=createHistoryEntry(routineNoteSession,[exercise],62_000,'2026-10-14');
assert.equal(routineNoteHistory.exercises[0].notes,undefined);

const sampleNewest={...history[0],id:'sample-new',date:'2026-10-14',sample:true,exercises:[{...history[0].exercises[0],sets:[{id:'sample-set',weight:100,reps:10,done:true}]}]};
const localOlder={...history[0],id:'local-old',date:'2026-10-13',exercises:[{...history[0].exercises[0],sets:[{id:'local-set',weight:40,reps:9,done:true}]}]};
const seededFromLocal=createWorkoutSession(routine,[exercise],[sampleNewest,localOlder],3_000,()=>`seed-${++id}`);
assert.deepEqual([seededFromLocal.logs.squat[0].weight,seededFromLocal.logs.squat[0].reps],[40,9]);

assert.deepEqual(parseRepRange('8–12'),{min:8,max:12});
assert.deepEqual(parseRepRange('8-10'),{min:8,max:10});
assert.match(getProgressionCue('8-10',1,[{id:'a',weight:50,reps:10,done:true}], 'kg','Barbell'),/\+2\.5 kg/);
assert.match(getProgressionCue('8-10',1,[{id:'a',weight:50,reps:8,done:true}], 'kg','Barbell'),/9 reps/);
assert.match(getProgressionCue('8-10',3,[{id:'a',weight:50,reps:10,done:true}], 'kg','Barbell'),/partial/);
const routines=[routine,{...routine,id:'accessory',name:'Accessory day'}];
assert.equal(selectNextRoutine(routines,[completed]).id,'accessory');
assert.equal(selectNextRoutine(routines,[{...completed,sample:true}]).id,'strength');
const longSession={...session,startedAt:0};
const longCompleted=createHistoryEntry(longSession,[exercise],5*60*60*1000,'2026-10-14');
assert.equal(longCompleted.duration,15);

console.log('Workout domain checks passed: previous performance, notes, progression cues, routine rotation and history totals.');
