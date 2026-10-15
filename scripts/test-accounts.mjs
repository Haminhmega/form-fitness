import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile,readdir} from 'node:fs/promises';
import {build} from 'esbuild';
const result=await build({stdin:{contents:"export {default as worker} from './server/index.ts'; export {googleAuth} from './server/google-auth.ts'; export {rateLimit} from './server/rate-limit.ts'; export {initialExercises,initialRoutines,initialPreferences} from './src/data.ts'; export {buildAccountDocumentFromLocal,clearMigratedTraining,hasLocalDemo,readLocalPreferences} from './src/account-storage.ts';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false});
const {worker,googleAuth,rateLimit,initialExercises,initialRoutines,initialPreferences,buildAccountDocumentFromLocal,clearMigratedTraining,hasLocalDemo,readLocalPreferences}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const db=new DatabaseSync(':memory:');for(const file of (await readdir(new URL('../drizzle/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())db.exec(await readFile(new URL('../drizzle/'+file,import.meta.url),'utf8'));
const env={
  DB:{prepare(sql){
    let args=[];
    return {
      bind(...values){args=values;return this},
      async first(){return db.prepare(sql).get(...args)||null},
      async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}}}
    };
  }},
  ASSETS:{fetch:()=>new Response('static app')}
};
const doc={profile:{name:'Test Person',age:null,heightCm:175,weightKg:72,targetWeightKg:null,activity:'Lightly active'},training:{preferences:initialPreferences,routines:initialRoutines,exercises:initialExercises,history:[]}};
const localHistory=[{id:'local-workout',name:'Preserved workout',date:'2026-10-14',duration:35,sets:1,volume:500,feedback:false,exercises:[{name:'Squat',sets:[{id:'set-1',weight:50,reps:10,done:true}]}]},{id:'sample-workout',name:'Sample workout',date:'2026-10-13',duration:20,sets:1,volume:100,feedback:false,exercises:[],sample:true}];
const localPreferences={...initialPreferences,notifications:true,goal:'Build consistency'};
const localValues=new Map([
  ['form-user:a:form-routines-v1',JSON.stringify(initialRoutines)],
  ['form-user:a:form-exercises-v1',JSON.stringify(initialExercises)],
  ['form-user:a:form-preferences-v1',JSON.stringify(localPreferences)],
  ['form-user:a:form-history-v1',JSON.stringify(localHistory)],
]);
const migrated=buildAccountDocumentFromLocal('a',doc.profile,{...initialPreferences,goal:'Build muscle'},key=>localValues.get(key)||null);
assert.equal(migrated.training.history[0].id,'local-workout');
assert.equal(migrated.training.history.length,1);
assert.equal(migrated.training.history[0].exercises[0].sets[0].reps,10);
assert.equal(migrated.training.preferences.notifications,true);
assert.equal(migrated.training.preferences.goal,'Build muscle');
assert.equal(migrated.training.preferences.firstTime,true);
assert.equal(migrated.training.preferences.onboarded,true);
const removed=[];clearMigratedTraining('a',key=>removed.push(key));
assert.deepEqual(removed.sort(),['form-user:a:form-exercises-v1','form-user:a:form-history-v1','form-user:a:form-preferences-v1','form-user:a:form-routines-v1']);
assert.ok(!removed.some(key=>key.endsWith('form-session-v1')||key.endsWith('form-devices-v1')));
const malformed=buildAccountDocumentFromLocal('a',doc.profile,initialPreferences,key=>key.endsWith('form-history-v1')?'not-json':null);
assert.deepEqual(malformed.training.history,[]);
assert.equal(readLocalPreferences('a',initialPreferences,key=>localValues.get(key)||null).notifications,true);
assert.deepEqual(readLocalPreferences('missing',initialPreferences,()=>'{bad'),initialPreferences);
assert.equal(hasLocalDemo(key=>key==='form-local-demo-v1'?'1':null),true);
assert.equal(hasLocalDemo(key=>key==='form-session-v1'?'{}':null),true);
assert.equal(hasLocalDemo(()=>null),false);
async function call(id,method='GET',body,extra={}){const response=await worker.fetch(new Request('https://form.test/api/account',{method,headers:{...(id?{'oai-authenticated-user-id':id,'oai-authenticated-user-email':id+'@example.test'}:{}),Origin:'https://form.test','Content-Type':'application/json','X-Form-Client':'1','X-Form-Account':id||'',...extra},body:body?JSON.stringify(body):undefined}),env);return {status:response.status,body:await response.json(),headers:response.headers}}
assert.equal((await call(null)).status,401);
assert.equal((await call('a','PUT',{revision:0,document:doc},{'X-Form-Account':'b'})).body.code,'ACCOUNT_CHANGED');
assert.equal((await call('a','PUT',{revision:0,document:doc},{'X-Form-Account':''})).status,403);
assert.equal((await call('a','PUT',{}, {Origin:'https://other.test'})).status,403);
assert.equal((await call('a','PUT',{revision:0,document:doc,ownerId:'b'})).status,400);
assert.equal((await call('a','POST',{})).status,405);
assert.equal((await call('a','PUT',{revision:0,document:doc},{'Content-Type':'text/plain'})).status,415);
const invalid=structuredClone(doc);invalid.profile.weightKg=-1;assert.equal((await call('a','PUT',{revision:0,document:invalid})).status,400);
let created=await call('a','PUT',{revision:0,document:doc});assert.equal(created.status,200);assert.equal(created.body.record.revision,1);
assert.equal((await call('b')).body.record,null);assert.equal((await call('a','PUT',{revision:0,document:doc})).status,409);
const sharedRevision=created.body.record.revision;const writes=await Promise.all([call('a','PUT',{revision:sharedRevision,document:doc}),call('a','PUT',{revision:sharedRevision,document:doc})]);assert.deepEqual(writes.map(r=>r.status).sort(),[200,409]);
let current=(await call('a')).body.record;assert.equal(current.revision,2);assert.equal((await call('a')).headers.get('Cache-Control'),'private, no-store');
const withSamples=structuredClone(doc);withSamples.training.history=[{id:'sample',name:'Sample',date:'2026-10-13',duration:1,sets:1,volume:1,feedback:false,exercises:[],sample:true}];
assert.equal((await call('a','PUT',{revision:current.revision,document:withSamples})).body.record.document.training.history.length,0);
current=(await call('a')).body.record;
assert.equal((await call('b','DELETE',{confirm:'DELETE MY FORM ACCOUNT'})).status,200);assert.notEqual((await call('a')).body.record,null);
assert.equal((await call('a','DELETE',{confirm:'no'})).status,400);assert.equal((await call('a','DELETE',{confirm:'DELETE MY FORM ACCOUNT'})).status,200);assert.equal((await call('a')).body.record,null);
assert.equal((await call('a','PUT',{revision:current.revision,document:doc})).status,409);
const recreated=await call('a','PUT',{revision:0,document:doc});assert.equal(recreated.status,200);assert.ok(recreated.body.record.revision>current.revision);assert.equal((await call('a','PUT',{revision:current.revision,document:doc})).status,409);
const staticResponse=await worker.fetch(new Request('https://form.test/'),env);assert.equal(await staticResponse.text(),'static app');assert.match(staticResponse.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);assert.doesNotMatch(staticResponse.headers.get('Content-Security-Policy'),/unsafe-inline[^;]*script|script-src[^;]*unsafe-inline/);
assert.equal((await worker.fetch(new Request('https://form.test/api/unknown'),env)).status,404);
const row=db.prepare('SELECT document FROM form_accounts WHERE user_id=?').get('a');assert.equal(JSON.parse(row.document).profile.name,'Test Person');

async function passwordRequest(path,body){
  const response=await worker.fetch(new Request('https://form.test/api/auth/'+path,{method:'POST',headers:{Origin:'https://form.test','Content-Type':'application/json','X-Form-Client':'1','Sec-Fetch-Site':'same-origin','CF-Connecting-IP':'198.51.100.12'},body:JSON.stringify(body)}),env);
  return {status:response.status,body:await response.json(),headers:response.headers};
}
const registered=await passwordRequest('register',{name:'Password Tester',email:'Tester@Example.test',password:'correct horse battery staple'});
assert.equal(registered.status,201);assert.equal(registered.body.user.provider,'password');assert.equal(registered.body.user.email,'tester@example.test');
const passwordCookie=registered.headers.getSetCookie().find(value=>value.startsWith('__Host-form-session=')).split(';')[0];
const passwordAccountResponse=await worker.fetch(new Request('https://form.test/api/account',{headers:{Cookie:passwordCookie}}),env);
assert.equal(passwordAccountResponse.status,200);const passwordAccount=await passwordAccountResponse.json();assert.equal(passwordAccount.user.provider,'password');assert.equal(passwordAccount.user.name,'Password Tester');
assert.equal((await passwordRequest('login',{email:'tester@example.test',password:'wrong password'})).status,401);
assert.equal((await passwordRequest('register',{name:'Other',email:'tester@example.test',password:'another secure password'})).status,409);
const passwordLogin=await passwordRequest('login',{email:'tester@example.test',password:'correct horse battery staple'});assert.equal(passwordLogin.status,200);
const loginCookie=passwordLogin.headers.getSetCookie().find(value=>value.startsWith('__Host-form-session=')).split(';')[0];
const passwordUserId=passwordLogin.body.user.id;
const passwordDelete=await worker.fetch(new Request('https://form.test/api/account',{method:'DELETE',headers:{Cookie:loginCookie,Origin:'https://form.test','Content-Type':'application/json','X-Form-Client':'1','X-Form-Account':passwordUserId,'Sec-Fetch-Site':'same-origin'},body:JSON.stringify({confirm:'DELETE MY FORM ACCOUNT'})}),env);
assert.equal(passwordDelete.status,200);assert.equal(db.prepare('SELECT COUNT(*) AS count FROM form_password_identities WHERE user_id=?').get(passwordUserId).count,0);
assert.equal((await passwordRequest('login',{email:'tester@example.test',password:'correct horse battery staple'})).status,401);

const authEnv={...env,GOOGLE_CLIENT_ID:'test.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:'test-secret',AUTH_ORIGIN:'https://form.test'};
let verifiedSub='google-sub-a';
const auth=googleAuth({
  exchange:async()=>new Response(JSON.stringify({id_token:'signed-test-token'}),{status:200,headers:{'Content-Type':'application/json'}}),
  verify:async()=>({sub:verifiedSub,email:verifiedSub+'@example.test',name:'Google Tester'}),
});
const unavailable=await auth(new Request('https://form.test/auth/google'),env);assert.equal(unavailable.status,303);assert.equal(unavailable.headers.get('Location'),'/?auth_error=unavailable');
const oauthHeaders={'Sec-Fetch-Site':'same-origin'};
async function startGoogle(path='/auth/google',headers={}){
  const response=await auth(new Request('https://form.test'+path,{headers:{...oauthHeaders,...headers}}),authEnv);
  assert.equal(response.status,303);
  const target=new URL(response.headers.get('Location'));
  const state=target.searchParams.get('state');assert.match(state,/^[A-Za-z0-9_-]{43}$/);
  return {response,state,stateCookie:`__Host-form-oauth=${state}`};
}
const direct=await startGoogle();
const directCallback=await auth(new Request(`https://form.test/auth/google/callback?state=${direct.state}&code=test-code`,{headers:{Cookie:direct.stateCookie}}),authEnv);
assert.equal(directCallback.status,303);assert.equal(directCallback.headers.get('Location'),'/?auth_success=google');
const sessionCookie=directCallback.headers.getSetCookie().find(value=>value.startsWith('__Host-form-session='));assert.ok(sessionCookie?.includes('HttpOnly')&&sessionCookie.includes('Secure')&&sessionCookie.includes('SameSite=Lax'));
assert.equal(db.prepare('SELECT user_id FROM form_google_identities WHERE google_sub=?').get(verifiedSub).user_id,'google:'+verifiedSub);
const replay=await auth(new Request(`https://form.test/auth/google/callback?state=${direct.state}&code=test-code`,{headers:{Cookie:direct.stateCookie}}),authEnv);assert.equal(replay.headers.get('Location'),'/?auth_error=expired');

const platformHeaders={'oai-authenticated-user-id':'a','oai-authenticated-user-email':'a@example.test','Sec-Fetch-Site':'same-origin'};
const link=await startGoogle('/auth/google?mode=link',platformHeaders);
const linked=await auth(new Request(`https://form.test/auth/google/callback?state=${link.state}&code=test-code`,{headers:{...platformHeaders,Cookie:link.stateCookie}}),authEnv);
assert.equal(linked.headers.get('Location'),'/?auth_success=google');assert.equal(db.prepare('SELECT user_id FROM form_google_identities WHERE google_sub=?').get(verifiedSub).user_id,'a');
assert.equal(db.prepare('SELECT COUNT(*) AS count FROM form_sessions WHERE user_id=?').get('google:'+verifiedSub).count,0);

// A linked account can subsequently use the ordinary Continue with Google path.
const linkedDirect=await startGoogle();
const linkedDirectCallback=await auth(new Request(`https://form.test/auth/google/callback?state=${linkedDirect.state}&code=test-code`,{headers:{Cookie:linkedDirect.stateCookie}}),authEnv);
assert.equal(linkedDirectCallback.headers.get('Location'),'/?auth_success=google');
assert.ok(db.prepare('SELECT COUNT(*) AS count FROM form_sessions WHERE user_id=?').get('a').count>0);

const linkedSessionCookie=linkedDirectCallback.headers.getSetCookie().find(value=>value.startsWith('__Host-form-session=')).split(';')[0];
const dualSignout=await auth(new Request('https://form.test/api/auth/signout',{method:'POST',headers:{...platformHeaders,Origin:'https://form.test','X-Form-Client':'1',Cookie:linkedSessionCookie}}),authEnv);
assert.equal(dualSignout.status,200);assert.equal((await dualSignout.json()).hasPlatformSession,true);

verifiedSub='google-sub-b';
const secondLink=await startGoogle('/auth/google?mode=link',platformHeaders);
const rejected=await auth(new Request(`https://form.test/auth/google/callback?state=${secondLink.state}&code=test-code`,{headers:{...platformHeaders,Cookie:secondLink.stateCookie}}),authEnv);
assert.equal(rejected.headers.get('Location'),'/?auth_error=account_has_google');

const stale=await worker.fetch(new Request('https://form.test/api/account',{headers:{...platformHeaders,Cookie:`__Host-form-session=${'a'.repeat(43)}`}}),authEnv);
assert.equal(stale.status,200);assert.equal((await stale.json()).user.googleLinked,true);assert.ok(stale.headers.getSetCookie().some(value=>value.includes('Max-Age=0')));
assert.equal(await rateLimit(authEnv,'regression-bucket',2,60),null);assert.equal(await rateLimit(authEnv,'regression-bucket',2,60),null);assert.equal((await rateLimit(authEnv,'regression-bucket',2,60)).status,429);

db.close();
console.log('Account, password and Google auth checks passed: registration, login, hashing, authentication, isolation, validation, CAS, replay rejection, safe linking, stale-session fallback, rate limiting, deletion and static routing.');
