import assert from 'node:assert/strict';
import {build} from 'esbuild';
const compiled=await build({entryPoints:['src/workout-recovery.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {readWorkoutTimers,saveWorkoutTimers,clearWorkoutTimers}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
function storage(){
  const values={};
  return Object.defineProperties(values,{
    getItem:{value:key=>values[key]??null},
    setItem:{value:(key,value)=>{values[key]=String(value)}},
    removeItem:{value:key=>{delete values[key]}},
  });
}
const reset=()=>{globalThis.localStorage=storage();globalThis.sessionStorage=storage()};
reset();
const sessionId='workout-a',restUntil=Date.now()+90000,warmupUntil=Date.now()+180000,timers={sessionId,restUntil,warmupUntil};
saveWorkoutTimers(timers,'account-a');
saveWorkoutTimers({...timers,sessionId:'workout-b',restUntil:restUntil+1000},'account-b');
saveWorkoutTimers({...timers,sessionId:'second-workout'},'account-a');
assert.deepEqual(readWorkoutTimers(sessionId,'account-a'),timers);
assert.equal(readWorkoutTimers(sessionId,'account-b').restUntil,0,'A different account cannot read the same session ID.');
assert.equal(readWorkoutTimers('another-workout','account-a').restUntil,0);
clearWorkoutTimers(sessionId,'account-a');
assert.equal(readWorkoutTimers(sessionId,'account-a').restUntil,0);
assert.equal(readWorkoutTimers('second-workout','account-a').restUntil,restUntil);
assert.equal(readWorkoutTimers('workout-b','account-b').restUntil,restUntil+1000);
clearWorkoutTimers(undefined,'account-a');
assert.equal(readWorkoutTimers('second-workout','account-a').restUntil,0);
assert.equal(readWorkoutTimers('workout-b','account-b').restUntil,restUntil+1000,'Clearing A must preserve B.');
saveWorkoutTimers(timers,'account-a:child');clearWorkoutTimers(undefined,'account-a');
assert.deepEqual(readWorkoutTimers(sessionId,'account-a:child'),timers,'Owner prefixes cannot overlap.');
saveWorkoutTimers({sessionId,restUntil:Date.now()-100,warmupUntil:NaN});
assert.deepEqual(readWorkoutTimers(sessionId),{sessionId,restUntil:0,warmupUntil:0});
localStorage.setItem('form-workout-recovery-v1:guest:'+sessionId,'broken');
assert.equal(readWorkoutTimers(sessionId).restUntil,0);

reset();
localStorage.setItem('form-workout-recovery-v1',JSON.stringify(timers));
assert.equal(readWorkoutTimers('wrong-session','account-b').restUntil,0);
assert.ok(localStorage.getItem('form-workout-recovery-v1'),'An unmatched legacy session remains available to its owner.');
assert.deepEqual(readWorkoutTimers(sessionId,'account-a'),timers);
assert.equal(localStorage.getItem('form-workout-recovery-v1'),null);
assert.deepEqual(readWorkoutTimers(sessionId,'account-a'),timers,'Durable migration survives subsequent reads.');

reset();
localStorage.setItem('form-user:account-a:form-session-v1',JSON.stringify({id:sessionId}));
sessionStorage.setItem('form-rest',restUntil);sessionStorage.setItem('form-warmup',warmupUntil);
assert.equal(readWorkoutTimers(sessionId,'account-b').restUntil,0);
assert.equal(readWorkoutTimers('wrong-session','account-a').restUntil,0);
assert.equal(sessionStorage.getItem('form-rest'),String(restUntil));
assert.deepEqual(readWorkoutTimers(sessionId,'account-a'),timers);
assert.equal(sessionStorage.getItem('form-rest'),null);assert.equal(sessionStorage.getItem('form-warmup'),null);
globalThis.sessionStorage=storage();
assert.deepEqual(readWorkoutTimers(sessionId,'account-a'),timers,'A new app process restores the migrated timers without tab storage.');

reset();
localStorage.setItem('form-session-v1',JSON.stringify({id:sessionId}));
sessionStorage.setItem('form-rest',restUntil);
assert.equal(readWorkoutTimers(sessionId).restUntil,restUntil,'Guest legacy timers use the guest active-session key.');

reset();
const original=localStorage;
original.setItem('form-user:account-a:form-session-v1',JSON.stringify({id:sessionId}));
original.setItem('form-workout-recovery-v1',JSON.stringify(timers));
sessionStorage.setItem('form-rest',restUntil);sessionStorage.setItem('form-warmup',warmupUntil);
globalThis.localStorage={getItem:original.getItem,setItem:()=>{throw Error('quota')},removeItem:()=>{throw Error('blocked')}};
assert.deepEqual(readWorkoutTimers(sessionId,'account-a'),timers);
assert.ok(original.getItem('form-workout-recovery-v1'),'Do not erase legacy recovery if the migrated write fails.');
clearWorkoutTimers(sessionId,'account-a');
assert.equal(sessionStorage.getItem('form-rest'),null);assert.equal(sessionStorage.getItem('form-warmup'),null,'Local-storage deletion failure must not prevent owned tab timer cleanup.');
globalThis.localStorage={getItem:()=>{throw Error('blocked')},setItem:()=>{throw Error('blocked')},removeItem:()=>{throw Error('blocked')}};
assert.equal(readWorkoutTimers(sessionId).restUntil,0);saveWorkoutTimers(timers);clearWorkoutTimers();
console.log('Workout recovery passed: durable timers, owner/session isolation, legacy migrations, expired or malformed values, and unavailable storage.');
