import assert from 'node:assert/strict';
import {build} from 'esbuild';

// This check is restricted to a local Worker and removes its fixture account.
const origin=process.env.FORM_REWARDS_RUNTIME_URL||'http://127.0.0.1:8790';
assert.equal(new URL(origin).hostname,'127.0.0.1','Only a local preview is allowed.');
const compiled=await build({stdin:{contents:"export {initialPreferences,initialExercises} from './src/data.ts';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const {initialPreferences,initialExercises}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const owner='local-rewards-'+crypto.randomUUID();
const headers={'Origin':origin,'Content-Type':'application/json','X-Form-Client':'1','X-Form-Account':owner,'oai-authenticated-user-id':owner,'oai-authenticated-user-email':'local-rewards@example.test'};
const call=async(path,method,body)=>{const response=await fetch(origin+path,{method,headers,body:body?JSON.stringify(body):undefined});return {status:response.status,body:await response.json()};};
try{
  const document={profile:{name:'Local runtime fixture',age:null,heightCm:null,weightKg:null,targetWeightKg:null,activity:'Lightly active'},training:{preferences:{...initialPreferences,days:['Mon','Tue','Wed','Thu','Fri']},routines:[],exercises:initialExercises,history:[]}};
  const saved=await call('/api/account','PUT',{revision:0,document});assert.equal(saved.status,200);
  const enrolled=await call('/api/rewards','POST',{action:'sync',timeZone:'UTC'});assert.equal(enrolled.status,200);assert.equal(enrolled.body.rewards.balance,0);
  const now=new Date();document.training.history.push({id:crypto.randomUUID(),name:'Runtime fixture',date:now.toISOString().slice(0,10),completedAt:now.toISOString(),duration:10,sets:1,volume:0,feedback:false,exercises:[{name:'Bodyweight squat',sets:[{id:crypto.randomUUID(),weight:0,reps:10,done:true}]}]});
  const updated=await call('/api/account','PUT',{revision:saved.body.record.revision,document});assert.equal(updated.status,200);
  const rewards=await call('/api/rewards','POST',{action:'sync',timeZone:'UTC'});assert.equal(rewards.status,200);assert.equal(rewards.body.rewards.balance,10);assert.equal(rewards.body.rewards.currentWeek.basePoints,20);
  const repeated=await call('/api/rewards','POST',{action:'sync',timeZone:'UTC'});assert.equal(repeated.body.rewards.balance,10);
  const denied=await call('/api/rewards','POST',{action:'purchase',item:'boost',requestId:crypto.randomUUID()});assert.equal(denied.status,409);assert.equal(denied.body.code,'INSUFFICIENT_CREDITS');
  console.log('Local workerd + migrated D1 passed: enrollment, saved-workout award, repeated sync and insufficient balance.');
}finally{
  assert.equal((await call('/api/account','DELETE',{confirm:'DELETE MY FORM ACCOUNT'})).status,200);
  assert.equal((await call('/api/rewards','GET')).body.code,'PROFILE_REQUIRED');
  console.log('Local fixture account and rewards removed.');
}
