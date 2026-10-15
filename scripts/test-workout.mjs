import assert from 'node:assert/strict';
import {build} from 'esbuild';

const result=await build({
  stdin:{contents:"export {createWorkoutSession,createHistoryEntry,parseRepRange,getProgressionCue,selectNextRoutine} from './src/domain/workout.ts'; export {getExerciseSupportLevel,getAnalyzer,listAnalyzers} from './src/ai/registry.ts'; export {buildRecommendedRoutine,buildWarmup,recommendedPrescription,restReason} from './src/training-recommendations.ts';",resolveDir:process.cwd()},
  bundle:true,
  format:'esm',
  platform:'node',
  write:false,
});
const {createWorkoutSession,createHistoryEntry,parseRepRange,getProgressionCue,selectNextRoutine,getExerciseSupportLevel,getAnalyzer,listAnalyzers,buildRecommendedRoutine,buildWarmup,recommendedPrescription,restReason}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));

const exercise={id:'squat',name:'Back squat',muscle:'Legs',equipment:'Barbell',supported:true,instructions:'',variation:'',filming:''};
const routine={id:'strength',name:'Strength day',description:'',exercises:[{exerciseId:'squat',sets:3,reps:'8-10',rest:90,notes:''}]};
const history=[{id:'old',name:'Strength day',date:'2026-10-13',duration:30,sets:2,volume:1050,feedback:false,exercises:[{exerciseId:'squat',name:'Old squat name',sets:[{id:'old-1',weight:50,reps:10,done:true},{id:'old-2',weight:55,reps:10,done:true}]}]}];
let id=0;
const session=createWorkoutSession(routine,[exercise],history,1_000,()=>`id-${++id}`);
assert.equal(session.startedAt,1_000);
assert.deepEqual(session.logs.squat.map(set=>[set.weight,set.reps,set.done]),[[50,10,false],[55,10,false],[55,8,false]]);
session.logs.squat[0].done=true;
session.notes.squat='Keep knees tracking over toes.';
session.feedback=true;
session.feedbackExerciseId='squat';
session.feedbackKind='analysis';
const completed=createHistoryEntry(session,[exercise],61_000,'2026-10-14');
assert.equal(completed.duration,1);
assert.equal(completed.sets,1);
assert.equal(completed.volume,500);
assert.equal(completed.exercises[0].exerciseId,'squat');
assert.equal(completed.routineId,'strength');
assert.equal(completed.completedAt,'1970-01-01T00:01:01.000Z');
assert.equal(completed.exercises[0].notes,'Keep knees tracking over toes.');
assert.equal(completed.feedbackExerciseId,'squat');
assert.equal(completed.feedbackKind,'analysis');
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
assert.equal(listAnalyzers().length,136);
assert.equal(getAnalyzer('squat').spec.canonicalName,'Bodyweight squat');
assert.equal(getAnalyzer('pushup').spec.validation,'beta');
const beta=listAnalyzers().find(analyzer=>analyzer.spec.validation==='beta');
assert.ok(beta);
assert.equal(getExerciseSupportLevel({...exercise,id:beta.spec.id,supported:false,supportLevel:'logging_only'}),'experimental_ai');
assert.equal(getExerciseSupportLevel({...exercise,supported:true,supportLevel:'real_ai'}),'real_ai');
assert.equal(getExerciseSupportLevel({...exercise,id:'pushup',supported:false,supportLevel:'illustrative_only'}),'experimental_ai');
assert.equal(getExerciseSupportLevel({...exercise,id:'unknown-illustration',supported:false,supportLevel:'illustrative_only'}),'illustrative_only');
assert.equal(getExerciseSupportLevel({...exercise,id:'custom',supported:true,supportLevel:'real_ai',custom:true}),'logging_only');

const preferences={units:'kg',notifications:false,cloud:false,contribute:false,retention:'Keep until I delete',goal:'Grow glutes',experience:'Getting started',equipment:['Bodyweight','Dumbbells'],days:['Mon','Wed','Fri'],onboarded:true,firstTime:true};
const gluteExercises=[
  {...exercise,id:'glute-bridge',name:'Glute bridge',muscle:'Glutes',equipment:'Bodyweight'},
  {...exercise,id:'rdl',name:'Dumbbell Romanian deadlift',muscle:'Legs',equipment:'Dumbbells'},
  {...exercise,id:'reverse-lunge',name:'Reverse lunge',muscle:'Glutes',equipment:'Bodyweight'},
  {...exercise,id:'plank',name:'Forearm plank',muscle:'Core',equipment:'Bodyweight'},
];
const suggested=buildRecommendedRoutine(preferences,gluteExercises);
assert.equal(suggested.id,'form-recommended');
assert.match(suggested.name,/Glute focus/);
assert.equal(suggested.exercises[0].exerciseId,'glute-bridge');
assert.deepEqual([suggested.exercises[0].sets,suggested.exercises[0].reps,suggested.exercises[0].rest],[2,'10–15',60]);
assert.match(suggested.exercises[0].notes,/technique/i);
assert.match(restReason(preferences,60),/technique/i);
const warmup=buildWarmup(suggested,gluteExercises);
assert.equal(warmup[0].target,'Whole body');
assert.ok(warmup.some(move=>move.target==='Glutes'));
assert.equal(new Set(warmup.map(move=>move.target)).size,warmup.length);
const strengthPrescription=recommendedPrescription({...preferences,goal:'Build strength',experience:'Experienced'},exercise);
assert.deepEqual([strengthPrescription.sets,strengthPrescription.reps,strengthPrescription.rest],[4,'5–8',120]);

console.log('Workout domain checks passed: history, progression, personalized recommendations, warm-ups, rest guidance and analyzer support gates.');
