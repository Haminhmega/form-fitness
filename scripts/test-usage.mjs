import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile,readdir} from 'node:fs/promises';
import {build} from 'esbuild';
import {randomUUID} from 'node:crypto';
const bundled=await build({stdin:{contents:"export {default as worker} from './server/index.ts';export {usageSubject} from './server/usage.ts';export {hash} from './server/google-auth.ts';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false});
const {worker,usageSubject,hash}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const db=new DatabaseSync(':memory:');for(const f of(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())db.exec(await readFile('drizzle/'+f,'utf8'));
const env={ANALYTICS_ADMIN_EMAIL:'owner@example.test',DB:{prepare(sql){let args=[];return{bind(...v){args=v;return this},async first(){return db.prepare(sql).get(...args)||null},async run(){return{meta:{changes:Number(db.prepare(sql).run(...args).changes)}}}}}}};
async function call(path,user='a',body,extra={}){const r=await worker.fetch(new Request('https://form.test/api/usage/'+path,{method:body===undefined?'GET':'POST',headers:{...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.test'}:{}),Origin:'https://form.test','X-Form-Client':'1','X-Form-Account':user||'','Content-Type':'application/json',...extra},body:body===undefined?undefined:JSON.stringify(body)}),env);return{status:r.status,data:await r.json()}}
assert.equal((await call('report',null)).status,401);assert.equal((await call('report')).status,403);assert.equal((await call('consent')).data.enabled,false);
const event={id:randomUUID(),kind:'open'};assert.equal((await call('event','a',event)).status,200);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM form_usage_events').get().n,0);
assert.equal((await call('consent','a',{enabled:true},{Origin:'https://evil.test'})).status,403);assert.equal((await call('consent','a',{enabled:true},{'X-Form-Account':'b'})).status,403);
assert.equal((await call('consent','a',{enabled:true})).status,200);await call('event','a',event);await call('event','a',event);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM form_usage_events').get().n,1);
assert.equal((await call('event','a',{...event,id:randomUUID(),email:'leak@example.test'})).status,400);assert.equal((await call('event','a',{...event,id:randomUUID(),at:1})).status,400);
const report=await call('report','owner');assert.equal(report.status,200);assert.equal(report.data.weekly,1);assert.equal(report.data.days[0].opens,1);assert.equal(report.data.days[0].sessions,1);assert.doesNotMatch(JSON.stringify(report.data),/example.test|subject|user_id/);
await call('consent','owner',{enabled:true});await call('event','owner',{id:randomUUID(),kind:'open'});assert.equal(db.prepare('SELECT COUNT(*) AS n FROM form_usage_events').get().n,1,'Owner activity is excluded.');
const subject=await usageSubject('a'),now=Date.now();db.prepare('INSERT INTO form_usage_events VALUES(?,?,?,?)').run(randomUUID(),subject,'active',now-31*60000);db.prepare('INSERT INTO form_usage_events VALUES(?,?,?,?)').run(randomUUID(),subject,'open',now-86400000);db.prepare('INSERT INTO form_usage_events VALUES(?,?,?,?)').run(randomUUID(),subject,'open',now-91*86400000);
const enriched=(await call('report','owner')).data;assert.equal(enriched.weekly,1);assert.equal(enriched.days.reduce((s,d)=>s+d.sessions,0),3);assert.equal(enriched.days.reduce((s,d)=>s+d.opens,0),2);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM form_usage_events').get().n,3);
await call('consent','a',{enabled:false});assert.equal(db.prepare('SELECT COUNT(*) AS n FROM form_usage_events').get().n,0);await call('event','a',{id:randomUUID(),kind:'open'});assert.equal(db.prepare('SELECT COUNT(*) AS n FROM form_usage_events').get().n,0);
// An unverified legacy password address cannot grant owner access.
const token='p'.repeat(43);db.prepare('INSERT INTO form_password_identities(user_id,email,name,password_hash,salt,iterations,created_at) VALUES(?,?,?,?,?,?,?)').run('unverified','owner@example.test','Fake','hash','salt',600000,'today');db.prepare('INSERT INTO form_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(await hash(token),'unverified',Date.now()+60000);
assert.equal((await call('report',null,undefined,{Cookie:'__Host-form-session='+token})).status,403);
console.log('Usage checks passed: opt-in default, owner-only access, verified-email gate, account isolation, payload allowlist, duplicate events, sessions, retention, owner exclusion and opt-out erasure.');db.close();
