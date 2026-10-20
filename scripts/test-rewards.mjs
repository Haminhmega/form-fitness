import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile,readdir} from 'node:fs/promises';
import {build} from 'esbuild';
const built=await build({stdin:{contents:`export * from './shared/rewards.ts'; export {handleRewards,reconcileSavedRewards} from './server/rewards.ts'; export {default as worker} from './server/index.ts'; export {initialPreferences,initialExercises,initialRoutines} from './src/data.ts';`,resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false});
const {enrollRewards,syncRewards,purchaseReward,rewardsSnapshot,rewardMonthComparison,rewardDate,rewardWeekKey,rewardLedgerSchema,handleRewards,reconcileSavedRewards,worker,initialPreferences,initialExercises,initialRoutines}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const date=value=>new Date(value.length===10?value+'T20:00:00Z':value);
const makeDoc=(days=['Mon','Tue','Wed','Thu','Fri'])=>({profile:{name:'Rewards fixture',age:null,heightCm:null,weightKg:null,targetWeightKg:null,activity:'Lightly active'},training:{preferences:{...initialPreferences,days},routines:initialRoutines,exercises:initialExercises,history:[]}});
const session=(id,completedAt,extra={})=>({id,name:'Logged session',date:completedAt.slice(0,10),completedAt,duration:20,sets:1,volume:0,feedback:false,exercises:[{name:'Bodyweight squat',sets:[{id:'set-'+id,weight:0,reps:10,done:true}]}],...extra});
const add=(document,id,day,extra={})=>{document.training.history.push(session(id,day+'T15:00:00Z',extra));return document;};
const enrolled='2026-10-19T10:00:00Z';
let checks=0;const checked=()=>{checks++;};

{
  const doc=makeDoc();add(doc,'legacy','2026-10-18');
  let ledger=enrollRewards(doc,'America/New_York',date(enrolled));
  assert.equal(ledger.balance,0);assert.equal(ledger.weeks[0].goal,5);
  for(let day=19;day<=25;day++){
    add(doc,'day-'+day,`2026-10-${day}`);ledger=syncRewards(ledger,doc,date(`2026-10-${day}`));
  }
  assert.equal(ledger.awards.length,5);assert.equal(ledger.balance,50);assert.equal(ledger.awards.reduce((sum,a)=>sum+a.basePoints,0),100);
  assert.deepEqual(ledger.awards.map(a=>a.basePoints),[20,20,20,20,20]);
  const repeated=syncRewards(ledger,doc,date('2026-10-25'));
  assert.deepEqual(repeated,ledger,'Repeating a sync must not award again.');
  doc.training.history=[];ledger=syncRewards(ledger,doc,date('2026-10-25'));
  add(doc,'day-19','2026-10-25');add(doc,'new-id-same-day','2026-10-19');
  ledger=syncRewards(ledger,doc,date('2026-10-25'));
  assert.equal(ledger.balance,50,'Deleting, restoring, moving an observed ID, and duplicating its date cannot mint credits.');checked();
}
{
  const doc=makeDoc(['Mon','Wed','Fri','Mon']);let ledger=enrollRewards(doc,'UTC',date(enrolled));
  for(const day of [19,21,23]){add(doc,'thirds-'+day,`2026-10-${day}`);ledger=syncRewards(ledger,doc,date(`2026-10-${day}`));}
  assert.deepEqual(ledger.awards.map(a=>a.basePoints),[33,33,34]);assert.equal(ledger.balance,30);
  doc.training.preferences.days=['Tue','Thu'];ledger=syncRewards(ledger,doc,date('2026-10-24'));
  assert.equal(rewardsSnapshot(ledger,date('2026-10-24')).currentWeek.goal,3);
  assert.deepEqual(rewardsSnapshot(ledger,date('2026-10-24')).nextGoal,{goal:2,effectiveWeek:'2026-10-26'});
  ledger=syncRewards(ledger,doc,date('2026-10-26'));
  assert.equal(rewardsSnapshot(ledger,date('2026-10-26')).currentWeek.goal,2);checked();
}
{
  const doc=makeDoc();let ledger=enrollRewards(doc,'UTC',date(enrolled));
  add(doc,'sample','2026-10-19',{sample:true});add(doc,'empty','2026-10-19',{sets:999,exercises:[]});
  add(doc,'unchecked','2026-10-19',{exercises:[{name:'Squat',sets:[{id:'unchecked',done:false,reps:10,weight:0}]}]});
  add(doc,'zero-reps','2026-10-19',{exercises:[{name:'Squat',sets:[{id:'zero',done:true,reps:0,weight:0}]}]});
  add(doc,'short-recovery','2026-10-19',{kind:'recovery',duration:4,exercises:[]});
  doc.training.history.push(session('invalid-time','not-a-date'));add(doc,'future','2026-10-25');
  ledger=syncRewards(ledger,doc,date('2026-10-19'));assert.equal(ledger.balance,0);
  add(doc,'recovery','2026-10-19',{kind:'recovery',duration:5,exercises:[]});ledger=syncRewards(ledger,doc,date('2026-10-19'));
  assert.equal(ledger.balance,10);
  ledger=syncRewards(ledger,doc,date('2026-10-25'));assert.equal(ledger.balance,10,'A future-dated entry is not accepted later.');checked();
}
{
  const doc=makeDoc(['Mon','Tue','Wed','Thu','Fri','Sat','Sun']);let ledger=enrollRewards(doc,'America/New_York',date('2026-10-26T10:00:00Z'));
  doc.training.history=[session('fall-first','2026-11-01T05:30:00Z',{date:'2026-11-02'}),session('fall-second','2026-11-01T06:30:00Z')];
  ledger=syncRewards(ledger,doc,date('2026-11-01T07:00:00Z'));
  assert.equal(ledger.awards.length,1);assert.equal(ledger.awards[0].date,'2026-11-01','Timestamp in the fixed timezone wins over editable local date.');
  assert.equal(rewardDate(date('2026-11-02T00:30:00Z'),'America/New_York'),'2026-11-01');
  assert.equal(rewardWeekKey('2026-11-01'),'2026-10-26');assert.equal(rewardWeekKey('2026-11-02'),'2026-11-02');
  assert.equal(rewardDate(date('2027-03-14T07:30:00Z'),'America/New_York'),'2027-03-14');checked();
}
{
  const doc=makeDoc(['Mon']);let ledger=enrollRewards(doc,'UTC',date(enrolled));
  add(doc,'delayed','2026-10-25');ledger=syncRewards(ledger,doc,date('2026-10-31'));
  assert.equal(ledger.balance,10,'The previous week can receive a completed session during its grace period.');
  add(doc,'too-late','2026-10-20');ledger=syncRewards(ledger,doc,date('2026-11-02'));
  assert.equal(ledger.balance,10);assert.equal(ledger.weeks[0].status,'met');
  assert.equal(rewardsSnapshot(ledger,date('2026-11-02')).streak.pendingWeek,'2026-10-26');checked();
}
{
  const doc=makeDoc();let ledger=enrollRewards(doc,'UTC',date('2026-10-12T10:00:00Z'));
  add(doc,'seven-calendar-days','2026-10-13');add(doc,'eight-calendar-days','2026-10-12');
  ledger=syncRewards(ledger,doc,date('2026-10-20'));
  assert.deepEqual(ledger.awards.map(award=>award.sessionId),['seven-calendar-days']);
  const absence=syncRewards(enrollRewards(makeDoc(),'UTC',date('2010-01-04')),makeDoc(),date('2030-01-07'));
  assert.equal(absence.balance,0);assert.equal(absence.freezes,0);assert.equal(rewardsSnapshot(absence,date('2030-01-07')).streak.weeks,0);
  assert.throws(()=>syncRewards(enrollRewards(makeDoc(),'UTC',date(enrolled)),makeDoc(),date('2200-01-01')),/calendar range/,'Calendar expansion has a fixed upper bound.');checked();
}
{
  const doc=makeDoc(['Mon']);let ledger=enrollRewards(doc,'UTC',date(enrolled));
  add(doc,'week-one','2026-10-19');ledger=syncRewards(ledger,doc,date('2026-10-19'));
  ledger.balance=60;ledger=purchaseReward(ledger,'freeze',crypto.randomUUID(),date('2026-10-20'));
  ledger=syncRewards(ledger,doc,date('2026-11-09'));
  assert.equal(ledger.weeks.find(w=>w.key==='2026-10-19').status,'met');
  assert.equal(ledger.weeks.find(w=>w.key==='2026-10-26').status,'protected');
  assert.equal(ledger.freezes,0);assert.equal(rewardsSnapshot(ledger,date('2026-11-09')).streak.weeks,1);
  ledger=syncRewards(ledger,doc,date('2026-11-16'));assert.equal(rewardsSnapshot(ledger,date('2026-11-16')).streak.weeks,0);
  const partial=enrollRewards(makeDoc(), 'UTC',date('2026-10-21'));partial.freezes=1;
  const reviewed=syncRewards(partial,makeDoc(),date('2026-11-02'));assert.equal(reviewed.weeks[0].status,'intro');assert.equal(reviewed.freezes,1);checked();
}
{
  const doc=makeDoc(['Mon','Tue','Wed','Thu','Fri','Sat','Sun']);let ledger=enrollRewards(doc,'UTC',date(enrolled));
  for(const day of [19,21,23]){add(doc,'earn-'+day,`2026-10-${day}`);ledger=syncRewards(ledger,doc,date(`2026-10-${day}`));}
  ledger=purchaseReward(ledger,'boost',crypto.randomUUID(),date('2026-10-24T10:00:00Z'));
  add(doc,'delayed-before-purchase','2026-10-22');ledger=syncRewards(ledger,doc,date('2026-10-24'));
  assert.equal(ledger.awards.at(-1).bonusPoints,0);assert.ok(ledger.boost,'A delayed pre-purchase session cannot consume a newly purchased boost.');
  add(doc,'after-purchase','2026-10-25');ledger=syncRewards(ledger,doc,date('2026-10-25'));
  assert.ok(ledger.awards.at(-1).bonusPoints>0);assert.equal(ledger.boost,null);checked();
}
{
  const doc=makeDoc();let ledger=enrollRewards(doc,'UTC',date(enrolled));
  for(const day of [19,20,21]){add(doc,'boost-credit-'+day,`2026-10-${day}`);ledger=syncRewards(ledger,doc,date(`2026-10-${day}`));}
  const requestId=crypto.randomUUID();ledger=purchaseReward(ledger,'boost',requestId,date('2026-10-21T21:00:00Z'));
  assert.equal(ledger.balance,0);assert.deepEqual(purchaseReward(ledger,'boost',requestId,date('2026-10-21T22:00:00Z')),ledger);
  assert.throws(()=>purchaseReward(ledger,'freeze',requestId),error=>error.code==='REQUEST_REUSED');
  assert.throws(()=>purchaseReward(ledger,'boost',crypto.randomUUID()),error=>error.code==='BOOST_ACTIVE');
  add(doc,'boost-next','2026-10-22');ledger=syncRewards(ledger,doc,date('2026-10-22'));
  assert.equal(ledger.awards.at(-1).bonusPoints,10);assert.equal(ledger.balance,10);assert.equal(ledger.boost,null);
  ledger=purchaseReward(ledger,'boost',requestId,date('2026-10-22'));assert.equal(ledger.boost,null);assert.equal(ledger.balance,10,'Retry after consumption cannot reactivate a purchased boost.');
  assert.throws(()=>purchaseReward(ledger,'freeze',crypto.randomUUID()),error=>error.code==='INSUFFICIENT_CREDITS');
  ledger.balance=200;ledger=purchaseReward(ledger,'freeze',crypto.randomUUID());ledger=purchaseReward(ledger,'freeze',crypto.randomUUID());
  assert.throws(()=>purchaseReward(ledger,'freeze',crypto.randomUUID()),error=>error.code==='INVENTORY_FULL');checked();
}
{
  const doc=makeDoc(['Mon']);let ledger=enrollRewards(doc,'UTC',date('2026-09-01T08:00:00Z'));
  for(const day of ['2026-09-05','2026-09-12','2026-09-28','2026-10-05','2026-10-12']){add(doc,day,day);ledger=syncRewards(ledger,doc,date(day));}
  const snapshot=rewardsSnapshot(ledger,date('2026-10-20'));
  const comparison=rewardMonthComparison(snapshot,'2026-10');
  assert.equal(comparison.currentPoints,200);assert.equal(comparison.previousPoints,200);assert.equal(comparison.previousFullPoints,300);assert.equal(comparison.delta,0);
  assert.equal(comparison.previousPeriodComplete,true);
  const past=rewardMonthComparison(snapshot,'2026-09');assert.equal(past.previousPeriodComplete,false);assert.equal(past.previousPoints,0);
  assert.equal(snapshot.lifetime.days,5);assert.equal(snapshot.months[0].daysBreakdown.length,2);
  assert.throws(()=>rewardLedgerSchema.parse({...ledger,balance:-1}));checked();
}

const db=new DatabaseSync(':memory:');
for(const file of (await readdir(new URL('../drizzle/',import.meta.url))).filter(name=>name.endsWith('.sql')).sort())db.exec(await readFile(new URL('../drizzle/'+file,import.meta.url),'utf8'));
let beforeWrite=null;
const env={DB:{prepare(sql){let args=[];return {bind(...values){args=values;return this;},async first(){if(beforeWrite&&/^(UPDATE form_rewards|INSERT INTO form_rewards)/.test(sql)){const hook=beforeWrite;beforeWrite=null;await hook();}return db.prepare(sql).get(...args)||null;},async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}};}};}},ASSETS:{fetch:()=>new Response('app')}};
const storeDoc=(id,document)=>db.prepare("INSERT INTO form_accounts (user_id,document,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(user_id) DO UPDATE SET document=excluded.document,revision=form_accounts.revision+1,updated_at=excluded.updated_at").run(id,JSON.stringify(document),enrolled);
const getLedger=id=>JSON.parse(db.prepare('SELECT document FROM form_rewards WHERE user_id=?').get(id).document);
const storeLedger=(id,ledger)=>db.prepare('UPDATE form_rewards SET document=?,revision=revision+1 WHERE user_id=?').run(JSON.stringify(ledger),id);
async function request(id,body,now=enrolled,extra={},method=body?'POST':'GET'){
  const req=new Request('https://form.test/api/rewards',{method,headers:{...(id?{'oai-authenticated-user-id':id,'oai-authenticated-user-email':id+'@example.test'}:{}),'Origin':'https://form.test','X-Form-Client':'1','X-Form-Account':id||'','Content-Type':'application/json',...extra},body:body?JSON.stringify(body):undefined});
  const response=await handleRewards(req,env,date(now));return {status:response.status,body:await response.json(),headers:response.headers};
}
{
  storeDoc('a',makeDoc());storeDoc('b',makeDoc());
  assert.equal((await request(null)).status,401);assert.equal((await request('a',null,enrolled,{'X-Form-Account':'b'})).status,403);
  assert.equal((await request('missing',{action:'sync',timeZone:'UTC'})).body.code,'PROFILE_REQUIRED');
  assert.equal((await request('a')).body.rewards,null);assert.equal(db.prepare('SELECT COUNT(*) count FROM form_rewards').get().count,0,'GET does not enroll.');
  assert.equal((await request('a',{action:'sync',timeZone:'UTC'},enrolled,{Origin:'https://other.test'})).status,403);
  assert.equal((await request('a',{action:'sync',timeZone:'UTC'},enrolled,{'Content-Type':'text/plain'})).status,415);
  assert.equal((await request('a',{action:'sync',timeZone:'invalid'})).status,400);
  assert.equal((await request('a',{action:'sync',timeZone:'UTC',balance:10000})).status,400);
  assert.equal((await request('a',{action:'purchase',item:'boost',requestId:'not-a-uuid'})).status,400);
  assert.equal((await request('a',{action:'sync',timeZone:'UTC'},enrolled,{},'PUT')).status,405);
  assert.equal((await request('a',{action:'sync',timeZone:'UTC',padding:'a'.repeat(2000)})).status,400);
  const enrolledResponse=await request('a',{action:'sync',timeZone:'UTC'});assert.equal(enrolledResponse.status,200);assert.equal(enrolledResponse.body.rewards.balance,0);
  assert.equal(enrolledResponse.headers.get('Cache-Control'),'private, no-store');
  assert.equal((await request('b')).body.rewards,null);checked();
}
{
  const doc=makeDoc();add(doc,'server-day','2026-10-19');storeDoc('a',doc);
  const parallel=await Promise.all(Array.from({length:4},()=>request('a',{action:'sync',timeZone:'Pacific/Auckland'},'2026-10-19T20:00:00Z')));
  assert.ok(parallel.every(response=>response.status===200));
  assert.equal(getLedger('a').balance,10);assert.equal(getLedger('a').awards.length,1);assert.equal(getLedger('a').timeZone,'UTC');
  const funded=getLedger('a');funded.balance=60;storeLedger('a',funded);
  const purchaseId=crypto.randomUUID();const retry=await Promise.all([request('a',{action:'purchase',item:'boost',requestId:purchaseId},'2026-10-19T21:00:00Z'),request('a',{action:'purchase',item:'boost',requestId:purchaseId},'2026-10-19T21:00:00Z')]);
  assert.deepEqual(retry.map(response=>response.status),[200,200]);assert.equal(getLedger('a').balance,30);assert.equal(getLedger('a').purchases.length,1);
  const collision=await request('a',{action:'purchase',item:'freeze',requestId:purchaseId},'2026-10-19T21:00:00Z');assert.equal(collision.status,409);assert.equal(collision.body.code,'REQUEST_REUSED');
  const remaining=getLedger('a');remaining.boost=null;remaining.balance=60;storeLedger('a',remaining);
  const simultaneous=await Promise.all([request('a',{action:'purchase',item:'boost',requestId:crypto.randomUUID()},'2026-10-19T22:00:00Z'),request('a',{action:'purchase',item:'freeze',requestId:crypto.randomUUID()},'2026-10-19T22:00:00Z')]);
  assert.deepEqual(simultaneous.map(response=>response.status).sort(),[200,409]);assert.ok(getLedger('a').balance>=0);checked();
}
{
  const goalDoc=makeDoc(['Tue','Thu']);storeDoc('a',goalDoc);
  await reconcileSavedRewards(env,'a',date('2026-10-25'));
  const monday=await request('a',{action:'sync',timeZone:'UTC'},'2026-10-26');assert.equal(monday.body.rewards.currentWeek.goal,2,'Saving before Monday records the next goal before the first Monday rewards request.');checked();
}
{
  const now=new Date(),before=new Date(now.getTime()-60_000),doc=makeDoc();storeDoc('save-hook',doc);
  assert.equal((await request('save-hook',{action:'sync',timeZone:'UTC'},before.toISOString())).status,200);
  doc.training.history.push(session('auto-earned',now.toISOString()));
  const response=await worker.fetch(new Request('https://form.test/api/account',{method:'PUT',headers:{'oai-authenticated-user-id':'save-hook','oai-authenticated-user-email':'save-hook@example.test',Origin:'https://form.test','Content-Type':'application/json','X-Form-Client':'1','X-Form-Account':'save-hook'},body:JSON.stringify({revision:1,document:doc})}),env);
  assert.equal(response.status,200);assert.equal(getLedger('save-hook').balance,10,'Account saving awards newly saved workouts without requiring a rewards visit.');checked();
}
{
  beforeWrite=async()=>{db.prepare("UPDATE form_accounts SET document='null',revision=revision+1 WHERE user_id='a'").run();db.prepare("DELETE FROM form_rewards WHERE user_id='a'").run();};
  const raced=await request('a',{action:'sync',timeZone:'UTC'},'2026-10-26');assert.equal(raced.status,409);assert.equal(raced.body.code,'PROFILE_REQUIRED');assert.equal(db.prepare("SELECT * FROM form_rewards WHERE user_id='a'").get(),undefined,'An in-flight CAS cannot recreate a deleted wallet.');
  storeDoc('c',makeDoc());assert.equal((await request('c',{action:'sync',timeZone:'UTC'})).status,200);
  const deletion=await worker.fetch(new Request('https://form.test/api/account',{method:'DELETE',headers:{'oai-authenticated-user-id':'c','oai-authenticated-user-email':'c@example.test',Origin:'https://form.test','Content-Type':'application/json','X-Form-Client':'1','X-Form-Account':'c'},body:JSON.stringify({confirm:'DELETE MY FORM ACCOUNT'})}),env);
  assert.equal(deletion.status,200);assert.equal(db.prepare("SELECT * FROM form_rewards WHERE user_id='c'").get(),undefined);
  assert.equal((await request('c',{action:'sync',timeZone:'UTC'})).status,409);checked();
}
{
  storeDoc('first-enroll-race',makeDoc());
  beforeWrite=async()=>{db.prepare("UPDATE form_accounts SET document='null',revision=revision+1 WHERE user_id='first-enroll-race'").run();};
  const first=await request('first-enroll-race',{action:'sync',timeZone:'UTC'});
  assert.equal(first.status,409);assert.equal(first.body.code,'PROFILE_REQUIRED');
  assert.equal(db.prepare("SELECT * FROM form_rewards WHERE user_id='first-enroll-race'").get(),undefined,'The initial INSERT also checks the active account revision atomically.');checked();
}
console.log(`Rewards: ${checks} scenario groups passed (goal scoring, eligibility, immutable awards, time zones/DST, offline grace, streaks, potions, month comparisons, authentication, SQLite CAS concurrency, goal saves, and account deletion).`);
