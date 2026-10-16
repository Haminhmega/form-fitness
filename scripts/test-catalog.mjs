import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';

const catalog=JSON.parse(await readFile(new URL('../src/data/gym-exercises.json',import.meta.url),'utf8'));
assert.equal(catalog.length,2906);
assert.equal(new Set(catalog.map(item=>item.id)).size,catalog.length);
assert.equal(new Set(catalog.map(item=>item.name.toLowerCase())).size,catalog.length);
assert.ok(catalog.every(item=>item.catalog===true&&item.supported===false&&item.supportLevel==='logging_only'));
assert.ok(catalog.every(item=>item.id.startsWith('gym-')&&item.name&&item.muscle&&item.equipment&&item.instructions));
assert.ok(catalog.some(item=>item.name.toLowerCase().includes('bench press')));
assert.ok(catalog.some(item=>item.equipment==='Cable'));
assert.ok(catalog.some(item=>item.category==='Powerlifting'));

const result=await build({stdin:{contents:"export {sortExercises,popularExerciseIds} from './src/exercise-popularity.ts'; export {initialExercises} from './src/data.ts'; export {coachingExercises} from './src/coaching-exercises.ts'; export {demonstrationKey,demonstrationPose,demos} from './src/exercise-demonstrations.ts';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false});
const {sortExercises,popularExerciseIds,initialExercises,coachingExercises,demonstrationKey,demonstrationPose,demos}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const allExercises=[...initialExercises,...catalog,...coachingExercises.filter(item=>!catalog.some(entry=>entry.id===item.id))];
const byId=new Map(allExercises.map(exercise=>[exercise.id,exercise]));
assert.equal(new Set(popularExerciseIds).size,popularExerciseIds.length,'The curated ranking contains no duplicates');
assert.ok(popularExerciseIds.every(id=>byId.has(id)),'Every popular pick resolves to a real exercise');
const input=[{...initialExercises[0],id:'custom-aaa',name:'AAA custom movement',rating:10},byId.get('gym-928-barbell-bench-press-medium-grip'),byId.get('squat'),byId.get('pushup')];
const originalOrder=input.map(exercise=>exercise.id);
assert.deepEqual(sortExercises(input,'popular').map(exercise=>exercise.id),['squat','pushup','gym-928-barbell-bench-press-medium-grip','custom-aaa'],'Curated gym staples precede unranked exercises even when an unranked exercise has a high dataset rating');
assert.deepEqual(input.map(exercise=>exercise.id),originalOrder,'Sorting does not mutate shared catalog order');
assert.deepEqual(sortExercises(input,'name-asc').map(exercise=>exercise.name),['AAA custom movement','Barbell Bench Press - Medium Grip','Bodyweight squat','Push-up']);
assert.deepEqual(sortExercises(input,'name-desc').map(exercise=>exercise.id),sortExercises(input,'name-asc').map(exercise=>exercise.id).reverse());
const allPopular=sortExercises(allExercises,'popular');
assert.deepEqual(sortExercises([...allExercises].reverse(),'popular').map(exercise=>exercise.id),allPopular.map(exercise=>exercise.id),'Popular order is stable regardless of initial catalog order');
const chestBarbells=allExercises.filter(exercise=>/bench/i.test(exercise.name)&&exercise.equipment==='Barbell');
assert.equal(sortExercises(chestBarbells,'popular')[0].id,'gym-928-barbell-bench-press-medium-grip','Popularity sorting also applies within search and equipment filters');
const firstPages=[...allPopular.slice(0,60),...allPopular.slice(60,120)];
assert.equal(new Set(firstPages.map(exercise=>exercise.id)).size,120,'Pagination preserves unique stable results');

const boneLength=(pose,a,b)=>Math.hypot(pose[a][0]-pose[b][0],pose[a][1]-pose[b][1]);
const demonstrated=allExercises.filter(exercise=>demonstrationKey(exercise));
assert.equal(new Set(demonstrated.map(demonstrationKey)).size,Object.keys(demos).length,'Every authored demonstration resolves to an exercise');
for(const exercise of demonstrated){
  assert.ok(demonstrationKey(exercise),`${exercise.name} has its own demonstration`);
  const start=demonstrationPose(exercise,0);
  for(const phase of [.1,.25,.5,.75,.9,1]){
    const pose=demonstrationPose(exercise,phase);
    assert.ok(Object.values(pose).flat().every(Number.isFinite),`${exercise.name} positions stay finite`);
    for(const [a,b] of [['shoulder','hip'],['shoulder','elbow'],['elbow','hand'],['hip','knee'],['knee','ankle']]){
      assert.ok(Math.abs(boneLength(pose,a,b)-boneLength(start,a,b))<.01,`${exercise.name} ${a}-${b} segment does not stretch while animating`);
    }
    assert.ok(Object.values(pose).every(([x,y])=>x>=0&&x<=440&&y>=-10&&y<=310),`${exercise.name} remains within its stage`);
  }
  let previous=start;
  for(let step=1;step<=100;step++){
    const current=demonstrationPose(exercise,step/100);
    for(const part of Object.keys(current))assert.ok(Math.hypot(current[part][0]-previous[part][0],current[part][1]-previous[part][1])<4,`${exercise.name} ${part} does not flip abruptly between adjacent frames`);
    previous=current;
  }
}
const row=byId.get('row');
const rowStart=demonstrationPose(row,0),rowFinish=demonstrationPose(row,1);
for(const part of ['hip','farHand','farKnee','ankle'])assert.deepEqual(rowStart[part],rowFinish[part],`Row keeps its supporting ${part} stationary`);
assert.equal(demonstrationKey(byId.get('gym-960-pushups')),'pushup');
assert.equal(demonstrationKey(byId.get('gym-1669-one-arm-dumbbell-row')),'row');
assert.equal(demonstrationKey(byId.get('gym-2534-seated-dumbbell-shoulder-press')),'press');
assert.equal(demonstrationKey({...row,custom:true}),undefined,'Custom exercises never receive a guessed animation');
assert.equal(demonstrationKey({...row,equipment:'Cable'}),undefined,'Equipment mismatch never substitutes a dumbbell demonstration');
assert.equal(demonstrationKey(byId.get('gym-928-barbell-bench-press-medium-grip')),'bench-barbell','A bench press receives its own horizontal demonstration');
for(const id of ['coach-leg-extension','gym-1351-seated-leg-curl']){
 const exercise=byId.get(id),start=demonstrationPose(exercise,0);
 for(const phase of [.25,.5,.75,1])assert.deepEqual(demonstrationPose(exercise,phase).knee,start.knee,'Seated knee movements keep the machine pivot stationary');
}
for(const id of ['curl','coach-hammer-curl','coach-cable-pushdown']){
 const exercise=byId.get(id),start=demonstrationPose(exercise,0);
 for(const phase of [.25,.5,.75,1])assert.deepEqual(demonstrationPose(exercise,phase).elbow,start.elbow,'Elbow isolation movements keep the upper arm stationary');
}
for(const id of ['gym-1105-dumbbell-bench-press','gym-928-barbell-bench-press-medium-grip','coach-incline-dumbbell-press']){
 const exercise=byId.get(id),start=demonstrationPose(exercise,0),finish=demonstrationPose(exercise,1);
 for(const part of ['head','shoulder','hip','ankle'])assert.deepEqual(start[part],finish[part],'Bench-supported presses keep their contact points stationary');
 assert.ok(finish.hand[1]<start.hand[1]-50,'Bench presses move upward from the chest');
}
assert.notEqual(demonstrationKey(byId.get('coach-hammer-curl')),demonstrationKey(byId.get('curl')),'Neutral-grip curls have a distinct grip illustration');
for(const exercise of demonstrated)assert.equal(demonstrationKey({...exercise,equipment:'Unknown'}),undefined,'Equipment mismatch never receives a demonstration');
console.log(`Exercise catalog checks passed: ${catalog.length} unique movements, ${popularExerciseIds.length} curated popular picks, stable sorting and ${Object.keys(demos).length} articulated demonstrations with movement/contact-point checks.`);
