import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
const result=await build({stdin:{contents:"export {default as worker} from './server/index.ts'; export {initialExercises,initialRoutines,initialPreferences} from './src/data.ts';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false});
const {worker,initialExercises,initialRoutines,initialPreferences}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const db=new DatabaseSync(':memory:');db.exec(await readFile(new URL('../drizzle/0000_cultured_radioactive_man.sql',import.meta.url),'utf8'));
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
async function call(id,method='GET',body,extra={}){const response=await worker.fetch(new Request('https://form.test/api/account',{method,headers:{...(id?{'oai-authenticated-user-id':id,'oai-authenticated-user-email':id+'@example.test'}:{}),Origin:'https://form.test','Content-Type':'application/json','X-Form-Client':'1',...extra},body:body?JSON.stringify(body):undefined}),env);return {status:response.status,body:await response.json(),headers:response.headers}}
assert.equal((await call(null)).status,401);
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
assert.equal(await (await worker.fetch(new Request('https://form.test/'),env)).text(),'static app');
assert.equal((await worker.fetch(new Request('https://form.test/api/unknown'),env)).status,404);
const row=db.prepare('SELECT document FROM form_accounts WHERE user_id=?').get('a');assert.equal(JSON.parse(row.document).profile.name,'Test Person');db.close();
console.log('Account API checks passed: authentication, isolation, origin, validation, CAS concurrency, sample filtering, deletion/recreation, no-store and static routing.');
