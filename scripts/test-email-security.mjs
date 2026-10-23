import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile,readdir} from 'node:fs/promises';
import {build} from 'esbuild';
const bundled=await build({stdin:{contents:"export {default as worker} from './server/index.ts';export {hash} from './server/google-auth.ts';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false});
const {worker,hash}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const db=new DatabaseSync(':memory:');for(const f of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())db.exec(await readFile('drizzle/'+f,'utf8'));
const env={RESEND_API_KEY:'fixture-resend',EMAIL_FROM:'Form <noreply@example.test>',AUTH_CODE_SECRET:'fixture-only-secret-with-more-than-32-characters',DB:{prepare(sql){let args=[];return{bind(...v){args=v;return this},async first(){return db.prepare(sql).get(...args)||null},async run(){return{meta:{changes:Number(db.prepare(sql).run(...args).changes)}}}}}}};
let deliveryFails=false;const messages=[];const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,init)=>{assert.equal(url,'https://api.resend.com/emails');assert.equal(init.headers.Authorization,'Bearer fixture-resend');messages.push(JSON.parse(init.body));return new Response('{}',{status:deliveryFails?500:200})};
async function call(path,body,headers={},target=env,method='POST'){
  const r=await worker.fetch(new Request('https://form.test/api/auth/'+path,{method,headers:{Origin:'https://form.test','X-Form-Client':'1','Content-Type':'application/json','CF-Connecting-IP':'192.0.2.50',...headers},body:method==='GET'?undefined:JSON.stringify(body)}),target);
  return{status:r.status,data:await r.json(),cookie:r.headers.get('Set-Cookie')?.split(';')[0]};
}
function resetLimits(){db.exec('DELETE FROM form_rate_limits')}
async function issue(email,purpose='register'){
  resetLimits();const r=await call('request-code',{email,purpose});assert.equal(r.status,200,JSON.stringify(r.data));return{email,challengeId:r.data.challengeId,code:messages.at(-1)?.text.match(/code is (\d{6})/)[1]};
}
try{
  assert.equal((await call('register',{name:'Test',email:'a@example.test',password:'password fixture'})).status,400);
  assert.equal((await call('request-code',{email:'a@example.test',purpose:'register'}, {},{...env,RESEND_API_KEY:undefined})).status,503);
  assert.equal((await call('request-code',{email:'a@example.test',purpose:'register'},{Origin:'https://other.test'})).status,403);
  let challenge=await issue('a@example.test');
  assert.equal((await call('request-code',{email:'a@example.test',purpose:'register'})).status,429);
  const stored=db.prepare('SELECT * FROM form_email_codes WHERE id=?').get(challenge.challengeId);assert.equal(stored.code_hash.length,64);assert.notEqual(stored.code_hash,challenge.code);
  assert.equal((await call('reset-password',{...challenge,password:'new password fixture'})).status,400,'Registration code cannot reset a password.');
  assert.equal((await call('register',{...challenge,email:'b@example.test',name:'Test',password:'password fixture'})).status,400);
  const registered=await call('register',{...challenge,name:'Test',password:'password fixture'});assert.equal(registered.status,201);
  assert.equal((await call('register',{...challenge,name:'Test',password:'password fixture'})).status,400,'Code cannot be reused.');
  const userId=registered.data.user.id,headers={Cookie:registered.cookie,'X-Form-Account':userId};
  const reset=await issue('a@example.test','reset');
  assert.equal((await call('reset-password',{...reset,password:'reset password fixture'})).status,200);
  assert.equal((await call('reset-password',{...reset,password:'reset password fixture'})).status,400);
  assert.equal((await call('account-email',undefined,headers,env,'GET')).status,401,'Reset revokes existing sessions.');
  resetLimits();assert.equal((await call('login',{email:'a@example.test',password:'password fixture'})).status,401);
  const login=await call('login',{email:'a@example.test',password:'reset password fixture'});assert.equal(login.status,200);headers.Cookie=login.cookie;
  assert.equal((await call('account-email',{action:'request',email:'new@example.test',password:'wrong password'},headers)).status,401);
  assert.equal((await call('account-email',{action:'request',email:'new@example.test',password:'reset password fixture'},{...headers,'X-Form-Account':'other'})).status,403);
  resetLimits();const change=await call('account-email',{action:'request',email:'new@example.test',password:'reset password fixture'},headers);assert.equal(change.status,200);
  const changeCode=messages.at(-1).text.match(/code is (\d{6})/)[1];
  assert.equal((await call('account-email',{action:'confirm',email:'new@example.test',password:'reset password fixture',challengeId:change.data.challengeId,code:changeCode},headers)).status,200);
  assert.equal((await call('account-email',undefined,headers,env,'GET')).status,401);
  resetLimits();assert.equal((await call('login',{email:'a@example.test',password:'reset password fixture'})).status,401);
  assert.equal((await call('login',{email:'new@example.test',password:'reset password fixture'})).status,200);
  assert.equal(db.prepare('SELECT user_id FROM form_password_identities WHERE email=?').get('new@example.test').user_id,userId,'Email updates preserve workout ownership.');
  challenge=await issue('expiry@example.test');db.prepare('UPDATE form_email_codes SET expires_at=0 WHERE id=?').run(challenge.challengeId);
  assert.equal((await call('register',{...challenge,name:'Test',password:'password fixture'})).status,400);
  challenge=await issue('attempts@example.test');const wrong=challenge.code==='000000'?'000001':'000000';
  for(let i=0;i<5;i++)assert.equal((await call('register',{...challenge,code:wrong,name:'Test',password:'password fixture'})).status,i===4?429:400);
  resetLimits();assert.equal((await call('register',{...challenge,name:'Test',password:'password fixture'})).status,201,'Registration throttle stopped the fifth guess before consuming an attempt.');
  challenge=await issue('new@example.test','reset');for(let i=0;i<5;i++)assert.equal((await call('reset-password',{...challenge,code:challenge.code==='000000'?'000001':'000000',password:'password fixture'})).status,400);
  assert.equal((await call('reset-password',{...challenge,password:'password fixture'})).status,400,'Five incorrect attempts exhaust the code.');
  resetLimits();const before=messages.length;const missing=await call('request-code',{email:'missing@example.test',purpose:'reset'});assert.equal(missing.status,200);assert.equal(messages.length,before);assert.equal(db.prepare('SELECT id FROM form_email_codes WHERE id=?').get(missing.data.challengeId),undefined);
  resetLimits();deliveryFails=true;assert.equal((await call('request-code',{email:'delivery@example.test',purpose:'register'})).status,503);assert.equal(db.prepare('SELECT id FROM form_email_codes WHERE email=?').get('delivery@example.test'),undefined);deliveryFails=false;
  // Provider users first verify their current address and add a password.
  const gId='google:fixture',token='g'.repeat(43);db.prepare('INSERT INTO form_google_identities VALUES(?,?,?,?)').run('fixture',gId,'google@example.test','Google User');db.prepare('INSERT INTO form_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(await hash(token),gId,Date.now()+7*86400000);
  const gh={Cookie:'__Host-form-session='+token,'X-Form-Account':gId};resetLimits();
  const add=await call('account-email',{action:'request',email:'google@example.test'},gh);assert.equal(add.status,200);
  assert.equal((await call('account-email',{action:'confirm',email:'google@example.test',password:'google password fixture',challengeId:add.data.challengeId,code:messages.at(-1).text.match(/code is (\d{6})/)[1]},gh)).status,200);
  assert.equal(db.prepare('SELECT user_id FROM form_password_identities WHERE email=?').get('google@example.test').user_id,gId);
  assert.equal(db.prepare('SELECT user_id FROM form_google_identities WHERE google_sub=?').get('fixture').user_id,gId);
  console.log('Email security passed: delivery mock, verification, expiry, throttling, attempts, purpose binding, replay, reset revocation, password-protected email change, stable ownership and provider password setup. No real email sent.');
}finally{globalThis.fetch=originalFetch;db.close()}
