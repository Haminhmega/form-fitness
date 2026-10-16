import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';

// Explicit opt-in only. A disposable .test identity is removed in finally;
// credentials remain in memory and are never written to output or disk.
const [target,approval]=process.argv.slice(2);
if(!target||approval!=='--live')throw Error('Usage: node scripts/smoke-live-accounts.mjs https://your-site --live');
const origin=new URL(target).origin;
if(!origin.startsWith('https://'))throw Error('Live account checks require HTTPS.');
const email=`form-release-${randomUUID()}@example.test`;
const password=randomBytes(32).toString('base64url');
let cookie='',userId='',registered=false;
const statuses=[];
async function request(path,method='GET',body,overrideCookie=cookie){
  const response=await fetch(origin+path,{method,redirect:'error',signal:AbortSignal.timeout(20000),headers:{Origin:origin,'Content-Type':'application/json','X-Form-Client':'1','Sec-Fetch-Site':'same-origin',...(overrideCookie?{Cookie:overrideCookie}:{}),...(userId?{'X-Form-Account':userId}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();
  const session=response.headers.getSetCookie().find(value=>value.startsWith('__Host-form-session='));
  return {status:response.status,data,session:session?.split(';')[0]};
}
function expect(result,status,step){
  assert.equal(result.status,status,`${step} returned HTTP ${result.status}${typeof result.data.reference==='string'?` (reference ${result.data.reference})`:''}`);
  statuses.push({step,status:result.status});
}
try{
  const created=await request('/api/auth/register','POST',{name:'Disposable release check',email,password});
  expect(created,201,'register');registered=true;userId=created.data.user.id;cookie=created.session;
  assert.ok(cookie,'Registration must issue a secure session.');
  const initial=await request('/api/account');expect(initial,200,'load new account');assert.equal(initial.data.record,null);
  const document={profile:{name:'Disposable release check',age:null,heightCm:null,weightKg:null,targetWeightKg:null,activity:'Lightly active'},training:{preferences:{units:'kg',notifications:false,cloud:true,contribute:false,retention:'Keep until deleted',goal:'Grow glutes',experience:'Getting started',equipment:['Bodyweight','Dumbbells'],days:['Mon','Wed','Fri'],coaching:{version:1,focusAreas:['Glutes'],sessionMinutes:120,trainingStyle:'Free weights',trainingStyles:['Free weights','Machines','Bodyweight'],impact:'Low impact',avoidMovements:['Overhead pressing'],sportFocus:'General athleticism'},onboarded:true,firstTime:false},routines:[{id:'form-recommended-recovery',name:'Recovery · Sunday',description:'Easy recovery activity',scheduledDay:'Sun',kind:'recovery',recovery:{minutes:10,steps:['Take an easy walk if comfortable.','Choose full rest if needed.']},exercises:[]}],exercises:[],history:[]}};
  expect(await request('/api/account','PUT',{revision:0,document}),200,'save profile');
  expect(await request('/api/auth/login','POST',{email,password:'incorrect-synthetic-password'}),401,'reject wrong password');
  const previous=cookie;
  const login=await request('/api/auth/login','POST',{email,password});expect(login,200,'login');cookie=login.session;assert.ok(cookie);
  expect(await request('/api/account','GET',undefined,previous),401,'revoke previous session');
  const restored=await request('/api/account');expect(restored,200,'restore saved profile');assert.deepEqual(restored.data.record.document,document);
}finally{
  if(registered){
    if(!cookie||!userId)throw Error('Disposable account cleanup requires its registration session.');
    expect(await request('/api/account','DELETE',{confirm:'DELETE MY FORM ACCOUNT'}),200,'delete disposable account');
    expect(await request('/api/account'),401,'reject deleted session');
  }
}
console.log(JSON.stringify({origin,statuses,cleanup:'Disposable credentials, sessions and profile content removed.'},null,2));
