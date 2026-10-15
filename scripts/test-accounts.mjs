import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {pbkdf2Sync} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {build} from 'esbuild';
const result=await build({stdin:{contents:"export {default as worker} from './server/index.ts'; export {googleAuth} from './server/google-auth.ts'; export {rateLimit} from './server/rate-limit.ts'; export {derivePasswordHash,PASSWORD_ITERATIONS} from './server/password-hash.ts'; export {initialExercises,initialRoutines,initialPreferences} from './src/data.ts'; export {buildAccountDocumentFromLocal,clearAccountWorkoutState,clearMigratedTraining,hasLocalDemo,readCachedAccount,readLastCachedAccount,readLocalPreferences} from './src/account-storage.ts';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false});
const {worker,googleAuth,rateLimit,derivePasswordHash,PASSWORD_ITERATIONS,initialExercises,initialRoutines,initialPreferences,buildAccountDocumentFromLocal,clearAccountWorkoutState,clearMigratedTraining,hasLocalDemo,readCachedAccount,readLastCachedAccount,readLocalPreferences}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
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
const cache={user:{id:'a',email:'a@example.test',name:'Account A',provider:'password',googleLinked:false},document:doc,revision:4,dirty:true};
const recoveryValues=new Map([['form-last-account','a'],['form-account-v1:a',JSON.stringify(cache)]]);
const readRecovery=name=>recoveryValues.get(name)||null;
assert.equal(readLastCachedAccount(readRecovery).dirty,true);
assert.equal(readLastCachedAccount(readRecovery).revision,4);
assert.equal(readLastCachedAccount(readRecovery).requiresSignIn,false);
assert.equal(readCachedAccount('b',readRecovery),null);
recoveryValues.set('form-account-v1:a',JSON.stringify({...cache,user:{...cache.user,id:'b'}}));
assert.equal(readLastCachedAccount(readRecovery),null,'A different account cannot be restored through a stale owner key.');
recoveryValues.set('form-account-v1:a','{malformed');
assert.equal(readLastCachedAccount(readRecovery),null);
assert.equal(readLastCachedAccount(()=>{throw Error('Storage disabled')}),null);
const timerStorage={'form-user:a:form-session-v1':JSON.stringify({id:'session-a'}),'form-workout-recovery-v1:a:session-a':'owned timer','form-workout-recovery-v1:b:session-b':'other timer'};
globalThis.localStorage=Object.defineProperties(timerStorage,{getItem:{value:name=>timerStorage[name]??null},removeItem:{value:name=>{delete timerStorage[name]}}});
const clearedSession=[];globalThis.sessionStorage={removeItem:name=>clearedSession.push(name)};
clearAccountWorkoutState('a');
assert.equal(timerStorage['form-workout-recovery-v1:a:session-a'],undefined);
assert.equal(timerStorage['form-workout-recovery-v1:b:session-b'],'other timer');
assert.deepEqual(clearedSession,['form-rest','form-warmup']);
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

async function passwordRequest(path,body,headers={},targetEnv=env){
  const response=await worker.fetch(new Request('https://form.test/api/auth/'+path,{method:'POST',headers:{Origin:'https://form.test','Content-Type':'application/json','X-Form-Client':'1','Sec-Fetch-Site':'same-origin','CF-Connecting-IP':'198.51.100.12',...headers},body:JSON.stringify(body)}),targetEnv);
  return {status:response.status,body:await response.json(),headers:response.headers};
}

// Node and local workerd do not enforce the production native PBKDF2 cap.
// Keep that restriction active during the actual registration/login flows.
const originalDeriveBits=crypto.subtle.deriveBits;
let rejectedNativeKdfCalls=0;
crypto.subtle.deriveBits=async function(algorithm,key,length){
  if(algorithm.name==='PBKDF2'&&algorithm.iterations>100_000){
    rejectedNativeKdfCalls++;
    throw new DOMException('Pbkdf2 failed: iteration counts above 100000 are not supported.','NotSupportedError');
  }
  return originalDeriveBits.call(this,algorithm,key,length);
};
const capProbeKey=await crypto.subtle.importKey('raw',new TextEncoder().encode('local cap probe'),'PBKDF2',false,['deriveBits']);
await assert.rejects(crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new Uint8Array(16),iterations:310_000},capProbeKey,256),{name:'NotSupportedError'});
assert.equal(PASSWORD_ITERATIONS,600_000);
for(const [password,salt,iterations] of [['password','salt',1],['password','salt',2],['pa\u0000sswörd','salt-你好',4096]]){
  const expected=pbkdf2Sync(password,salt,iterations,32,'sha256').toString('base64url');
  assert.equal(await derivePasswordHash(password,salt,iterations),expected,'Portable PBKDF2 must match the native algorithm and UTF-8 encoding.');
}
assert.equal(Buffer.from(await derivePasswordHash('password','salt',1),'base64url').toString('hex'),'120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b','PBKDF2-HMAC-SHA256 known-answer vector.');
await assert.rejects(derivePasswordHash('local fixture','salt',0),'Invalid KDF parameters must reject, never produce a credential.');
const registered=await passwordRequest('register',{name:'Password Tester',email:'Tester@Example.test',password:'correct horse battery staple'});
assert.equal(registered.status,201);assert.equal(registered.body.user.provider,'password');assert.equal(registered.body.user.email,'tester@example.test');
const storedPassword=db.prepare('SELECT password_hash,salt,iterations FROM form_password_identities WHERE user_id=?').get(registered.body.user.id);
assert.equal(storedPassword.iterations,600_000);
assert.equal(storedPassword.password_hash,pbkdf2Sync('correct horse battery staple',storedPassword.salt,600_000,32,'sha256').toString('base64url'));
const passwordCookie=registered.headers.getSetCookie().find(value=>value.startsWith('__Host-form-session=')).split(';')[0];
const passwordAccountResponse=await worker.fetch(new Request('https://form.test/api/account',{headers:{Cookie:passwordCookie}}),env);
assert.equal(passwordAccountResponse.status,200);const passwordAccount=await passwordAccountResponse.json();assert.equal(passwordAccount.user.provider,'password');assert.equal(passwordAccount.user.name,'Password Tester');
assert.equal((await passwordRequest('login',{email:'tester@example.test',password:'wrong password'},{Cookie:passwordCookie})).status,401);
const sessionStatus=async cookie=>(await worker.fetch(new Request('https://form.test/api/account',{headers:{Cookie:cookie}}),env)).status;
assert.equal(await sessionStatus(passwordCookie),200,'Failed login must preserve the current session.');
assert.equal((await passwordRequest('register',{name:'Other',email:'tester@example.test',password:'another secure password'})).status,409);
const passwordLogin=await passwordRequest('login',{email:'tester@example.test',password:'correct horse battery staple'},{Cookie:passwordCookie});assert.equal(passwordLogin.status,200);
const loginCookie=passwordLogin.headers.getSetCookie().find(value=>value.startsWith('__Host-form-session=')).split(';')[0];
assert.equal(await sessionStatus(passwordCookie),401,'A successful login must revoke the supplied previous session.');
assert.equal(await sessionStatus(loginCookie),200);
const otherDeviceLogin=await passwordRequest('login',{email:'tester@example.test',password:'correct horse battery staple'});
assert.equal(otherDeviceLogin.status,200);
assert.equal(await sessionStatus(loginCookie),200,'A new device must not revoke sessions on unrelated devices.');
const passwordUserId=passwordLogin.body.user.id;
const passwordDelete=await worker.fetch(new Request('https://form.test/api/account',{method:'DELETE',headers:{Cookie:loginCookie,Origin:'https://form.test','Content-Type':'application/json','X-Form-Client':'1','X-Form-Account':passwordUserId,'Sec-Fetch-Site':'same-origin'},body:JSON.stringify({confirm:'DELETE MY FORM ACCOUNT'})}),env);
assert.equal(passwordDelete.status,200);assert.equal(db.prepare('SELECT COUNT(*) AS count FROM form_password_identities WHERE user_id=?').get(passwordUserId).count,0);
assert.equal((await passwordRequest('login',{email:'tester@example.test',password:'correct horse battery staple'})).status,401);

// A legacy identity must still verify with its original 310,000 iterations.
const legacySalt='local-legacy-salt-fixture',legacyPassword='legacy password fixture';
db.prepare('INSERT INTO form_password_identities (user_id,email,name,password_hash,salt,iterations,created_at) VALUES (?,?,?,?,?,?,?)').run('password:legacy-fixture','legacy@example.test','Legacy Tester',pbkdf2Sync(legacyPassword,legacySalt,310_000,32,'sha256').toString('base64url'),legacySalt,310_000,new Date().toISOString());
assert.equal((await passwordRequest('login',{email:'legacy@example.test',password:legacyPassword})).status,200);
assert.equal((await passwordRequest('login',{email:'legacy@example.test',password:'wrong legacy password'})).status,401);
assert.equal((await passwordRequest('login',{email:'unknown@example.test',password:'unknown user password'})).status,401,'Unknown users must receive 401, not the old runtime 503.');

// Unexpected storage failures must not issue a session or create an identity.
const failedEmail='failed-write@example.test';
const failedWriteEnv={...env,DB:{prepare(sql){if(sql.startsWith('INSERT INTO form_password_identities'))throw Error('D1_ERROR local storage failure: failed-write@example.test, local failure fixture, private-cookie-value');return env.DB.prepare(sql)}}};
const capturedErrors=[],originalConsoleError=console.error;
let failedRegistration;
try{
  console.error=(...args)=>capturedErrors.push(args.join(' '));
  failedRegistration=await passwordRequest('register',{name:'Failure Tester',email:failedEmail,password:'local failure fixture'},{},failedWriteEnv);
}finally{console.error=originalConsoleError}
assert.equal(failedRegistration.status,503);
assert.equal(failedRegistration.body.code,'ACCOUNT_SERVICE_UNAVAILABLE');
assert.match(failedRegistration.body.reference,/^[a-f0-9-]{36}$/);
assert.equal(failedRegistration.headers.get('Set-Cookie'),null);
assert.equal(db.prepare('SELECT count(*) AS count FROM form_password_identities WHERE email=?').get(failedEmail).count,0);
assert.deepEqual(capturedErrors.map(value=>JSON.parse(value)),[{event:'account_request_failed',operation:'register',category:'database',reference:failedRegistration.body.reference}]);
assert.doesNotMatch(JSON.stringify([failedRegistration.body,capturedErrors]),/local storage failure|failed-write@example\.test|local failure fixture|private-cookie-value/);
assert.equal(rejectedNativeKdfCalls,1,'Only the explicit cap probe may use unsupported native PBKDF2.');
crypto.subtle.deriveBits=originalDeriveBits;

// Changing email or switching between login and registration cannot bypass the IP cap.
for(let i=0;i<30;i++)assert.equal((await passwordRequest(i%2?'login':'register',{email:`rotated-${i}@example.test`,password:'short'},{'CF-Connecting-IP':'198.51.100.90'})).status,400);
for(const path of ['login','register']){
  const blocked=await passwordRequest(path,{email:`new-${path}@example.test`,password:'valid long password',name:'IP cap test'},{'CF-Connecting-IP':'198.51.100.90'});
  assert.equal(blocked.status,429);assert.equal(blocked.headers.get('Retry-After'),'60');
}
assert.equal((await passwordRequest('login',{email:'other@example.test',password:'short'},{'CF-Connecting-IP':'198.51.100.91'})).status,400,'The cap is isolated by IP.');

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
