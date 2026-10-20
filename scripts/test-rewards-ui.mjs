import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {build} from 'esbuild';
import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Real account provider, app, reward hook and Worker, with isolated SQLite and
// synthetic account identities. No request reaches the deployed app.
const bundle=await build({stdin:{contents:`
  import React from 'react';import {createRoot} from 'react-dom/client';
  import App from './src/App';import {AccountProvider} from './src/Account';
  import './src/styles.css';import './src/pwa.css';
  createRoot(document.getElementById('root')).render(<React.StrictMode><AccountProvider><App/></AccountProvider></React.StrictMode>);
`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,format:'iife',write:false,outdir:'rewards-ui-fixture',jsx:'automatic',plugins:[{name:'unused-ai-worker',setup(build){build.onResolve({filter:/\?worker&inline$/},()=>({path:'unused-worker',namespace:'test'}));build.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export default class {constructor(){throw Error("Video analysis is outside the rewards test.")}}',loader:'js'}));}}],define:{'import.meta.env.PROD':'false','import.meta.url':'"https://rewards.test/"','process.env.NODE_ENV':'"development"'},logLevel:'silent'});
const js=bundle.outputFiles.find(file=>file.path.endsWith('.js')).text;
const css=bundle.outputFiles.find(file=>file.path.endsWith('.css')).text;
const server=await build({stdin:{contents:"export {default as worker} from './server/index.ts';export {initialPreferences,initialExercises} from './src/data.ts';export {enrollRewards,syncRewards,addRewardDays,rewardWeekKey} from './shared/rewards.ts';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const {worker,initialPreferences,initialExercises,enrollRewards,syncRewards,addRewardDays,rewardWeekKey}=await import('data:text/javascript;base64,'+Buffer.from(server.outputFiles[0].text).toString('base64'));
const database=new DatabaseSync(':memory:');
for(const file of (await readdir('drizzle')).filter(file=>file.endsWith('.sql')).sort())database.exec(await readFile(path.join('drizzle',file),'utf8'));
const env={DB:{prepare(sql){
  let args=[];
  return {
    bind(...values){args=values;return this},
    async first(){return database.prepare(sql).get(...args)||null},
    async run(){return {meta:{changes:Number(database.prepare(sql).run(...args).changes)}}},
  };
}}};
const makeDocument=name=>({profile:{name,age:null,heightCm:null,weightKg:null,targetWeightKg:null,activity:'Lightly active'},training:{preferences:{...initialPreferences,days:['Mon','Tue','Wed','Thu','Fri'],onboarded:true,firstTime:true},routines:[{id:'reward-routine',name:'Short strength session',description:'Browser fixture',exercises:[{exerciseId:'squat',sets:1,reps:'10',rest:60,notes:''}]}],exercises:initialExercises,history:[]}});
const putAccount=(id,document)=>database.prepare('INSERT INTO form_accounts(user_id,document,revision,updated_at) VALUES(?,?,1,?)').run(id,JSON.stringify(document),new Date().toISOString());
putAccount('rewards-a',makeDocument('Rewards Tester'));
putAccount('rewards-b',makeDocument('Other Tester'));
const evidence=path.resolve(process.env.FORM_REWARDS_EVIDENCE||'../form-rewards-evidence');await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:process.env.CI?{}:{channel:'msedge'})});
const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'UTC',reducedMotion:'reduce'});
const page=await context.newPage(),errors=[],rewardRequests=[];
page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
let owner='rewards-a',failRewards=false,holdRewards=false,held=[],dropPurchaseResponse=false,expirePurchase=false;
await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.hostname!=='rewards.test')return route.abort();
  if(url.pathname.startsWith('/api/')){
    if(url.pathname==='/api/rewards'){
      rewardRequests.push({owner,method:req.method(),body:req.postData()?req.postDataJSON():null});
      if(holdRewards)await new Promise(resolve=>{held.push(resolve)});
      if(failRewards)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Rewards could not sync. Please retry.'})});
      if(expirePurchase&&req.postDataJSON()?.action==='purchase'){expirePurchase=false;return route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'Sign in again.'})});}
    }
    const headers=new Headers(req.headers());
    if(owner){headers.set('oai-authenticated-user-id',owner);headers.set('oai-authenticated-user-email',owner+'@example.test');}
    const response=await worker.fetch(new Request(req.url(),{method:req.method(),headers,body:['GET','HEAD'].includes(req.method())?undefined:req.postData()||undefined}),env);
    if(dropPurchaseResponse&&url.pathname==='/api/rewards'&&req.postDataJSON()?.action==='purchase'){dropPurchaseResponse=false;return route.abort('failed');}
    return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
  }
  return route.fulfill({contentType:url.pathname==='/test.js'?'text/javascript':url.pathname==='/test.css'?'text/css':'text/html',body:url.pathname==='/test.js'?js:url.pathname==='/test.css'?css:'<!doctype html><html lang="en"><head><title>Form rewards test</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/test.css"></head><body><div id="root"></div><script src="/test.js"></script></body></html>'});
});
const navigate=async name=>page.getByRole('navigation').getByRole('button',{name,exact:true}).click();
const ledger=()=>JSON.parse(database.prepare('SELECT document FROM form_rewards WHERE user_id=?').get('rewards-a').document);
const accountDocument=()=>JSON.parse(database.prepare('SELECT document FROM form_accounts WHERE user_id=?').get('rewards-a').document);
async function openRewards(){await navigate('Progress');await page.getByRole('button',{name:'Rewards & shop',exact:true}).click();await expect(page.locator('.rewards-wallet')).toBeVisible();}
async function finishWorkout(){
  await navigate('Today');
  await page.getByRole('button',{name:'Start workout',exact:true}).click();
  await page.getByRole('button',{name:'Skip warm-up',exact:true}).click();
  await page.getByRole('button',{name:'Complete set 1',exact:true}).click();
  await page.getByRole('button',{name:'Review & finish',exact:true}).first().click();
  await page.getByRole('button',{name:'Save workout',exact:true}).evaluate(button=>{button.click();button.click()});
  await expect(page.getByRole('heading',{name:'Keep showing up.',exact:true})).toBeVisible();
  await expect(page.getByText('Waiting to sync',{exact:true})).toHaveCount(0);
}

try{
  holdRewards=true;
  await page.goto('https://rewards.test/');
  await expect.poll(()=>held.length).toBeGreaterThan(0);
  await page.screenshot({path:path.join(evidence,'loading-mobile.png'),fullPage:true});
  holdRewards=false;held.splice(0).forEach(release=>release());
  await expect.poll(()=>database.prepare('SELECT COUNT(*) AS n FROM form_rewards').get().n).toBe(1);
  await navigate('Progress');
  await page.getByRole('button',{name:'Rewards & shop',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Your effort, rewarded.',exact:true})).toBeVisible();
  await page.screenshot({path:path.join(evidence,'empty-mobile.png'),fullPage:true});
  await finishWorkout();
  await expect.poll(()=>ledger().balance).toBe(10);
  assert.equal(accountDocument().training.history.length,1,'Double-clicking Save records one workout.');
  assert.equal(ledger().awards[0].basePoints,20);
  await finishWorkout();
  await expect.poll(()=>accountDocument().training.history.length).toBe(2);
  assert.equal(ledger().balance,10,'A second session on the same day earns no duplicate credits.');
  await page.locator('.history-entry').first().locator('summary').click();
  await page.locator('.history-entry').first().getByRole('button',{name:'Delete workout',exact:true}).click();
  await expect.poll(()=>accountDocument().training.history.length).toBe(1);
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await expect.poll(()=>accountDocument().training.history.length).toBe(2);
  assert.equal(ledger().balance,10,'Delete and undo cannot mint more credits.');

  // Give the isolated test account a genuine domain-generated previous month.
  // These synthetic sessions exist only in this test database.
  const now=new Date(),previousMonth=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-1,1,12));
  const fixtureDoc=makeDocument('Rewards Tester');
  let fixtureLedger=enrollRewards(fixtureDoc,'UTC',new Date(previousMonth.toISOString().slice(0,10)+'T00:00:00Z'));
  for(let offset=0,earned=0;earned<10;offset++){
    const day=addRewardDays(previousMonth.toISOString().slice(0,10),offset),date=new Date(day+'T12:00:00Z');
    if([0,6].includes(date.getUTCDay()))continue;
    fixtureDoc.training.history.push({id:`fixture-${earned}`,name:'Synthetic workout',date:day,completedAt:date.toISOString(),duration:35,sets:1,volume:0,feedback:false,exercises:[{name:'Squat',sets:[{id:`fixture-set-${earned}`,weight:0,reps:10,done:true}]}]});
    fixtureLedger=syncRewards(fixtureLedger,fixtureDoc,new Date(day+'T13:00:00Z'));earned++;
  }
  fixtureLedger=syncRewards(fixtureLedger,accountDocument(),now);
  database.prepare('UPDATE form_rewards SET document=?,revision=revision+1 WHERE user_id=?').run(JSON.stringify(fixtureLedger),'rewards-a');
  await page.reload();await openRewards();
  await expect(page.locator('.rewards-wallet')).toContainText('110');
  assert.equal(await page.getByLabel('Rewards month').locator('option').count(),2);
  await page.getByLabel('Rewards month').selectOption(previousMonth.toISOString().slice(0,7));
  await expect(page.locator('.rewards-month-score>strong')).toHaveText('200points');
  await page.getByLabel('Rewards month').selectOption(now.toISOString().slice(0,7));
  await expect(page.locator('.rewards-month-score>strong')).toHaveText('20points');
  await expect(page.getByText(/Ad rewards are not available yet/)).toBeVisible();

  // Simulate a stale balance after activity on another device. A definitive
  // rejection must release the pending action so the other item stays usable.
  const beforeStale=ledger();
  database.prepare('UPDATE form_rewards SET document=?,revision=revision+1 WHERE user_id=?').run(JSON.stringify({...beforeStale,balance:0}),'rewards-a');
  await page.getByRole('button',{name:'Get streak freeze',exact:true}).click();
  await page.getByRole('button',{name:'Confirm streak freeze',exact:true}).click();
  await expect(page.locator('.rewards-status')).toContainText('Complete more earning days');
  await expect(page.getByRole('button',{name:'Retry freeze purchase',exact:true})).toHaveCount(0);
  assert.equal(await page.evaluate(()=>localStorage.getItem('form-user:rewards-a:reward-purchase-v1')),null);
  database.prepare('UPDATE form_rewards SET document=?,revision=revision+1 WHERE user_id=?').run(JSON.stringify(beforeStale),'rewards-a');
  await page.getByRole('button',{name:'Retry rewards',exact:true}).click();
  await expect(page.getByRole('button',{name:'Get point boost',exact:true})).toBeEnabled();

  // The Worker commits, but the response is lost: reload and retry must reuse
  // the persisted transaction identifier rather than spend a second time.
  await page.getByRole('button',{name:'Get point boost',exact:true}).click();
  await expect(page.getByRole('button',{name:'Confirm point boost',exact:true})).toBeFocused();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.getByRole('button',{name:'Get point boost',exact:true})).toBeFocused();
  await page.getByRole('button',{name:'Get point boost',exact:true}).click();
  dropPurchaseResponse=true;
  await page.getByRole('button',{name:'Confirm point boost',exact:true}).click();
  await expect(page.getByRole('button',{name:'Retry boost purchase',exact:true})).toBeVisible();
  assert.equal(ledger().balance,80);
  const pendingId=await page.evaluate(()=>JSON.parse(localStorage.getItem('form-user:rewards-a:reward-purchase-v1')).requestId);
  expirePurchase=true;await page.getByRole('button',{name:'Retry boost purchase',exact:true}).click();
  await expect(page.getByRole('link',{name:'Sign in again',exact:true})).toBeVisible();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('form-user:rewards-a:reward-purchase-v1')).requestId),pendingId);
  await page.reload();await openRewards();
  await page.getByRole('button',{name:'Retry boost purchase',exact:true}).click();
  await expect(page.getByRole('button',{name:'Retry boost purchase',exact:true})).toHaveCount(0);
  const boosts=rewardRequests.filter(item=>item.body?.action==='purchase'&&item.body.item==='boost');
  assert.equal(boosts.length,3);assert.equal(new Set(boosts.map(item=>item.body.requestId)).size,1);
  assert.equal(ledger().balance,80);assert.equal(ledger().purchases.length,1);
  await page.getByRole('button',{name:'Get streak freeze',exact:true}).click();
  await page.getByRole('button',{name:'Confirm streak freeze',exact:true}).click();
  await expect(page.locator('.rewards-wallet')).toContainText('20');
  assert.equal(ledger().freezes,1);assert.equal(ledger().purchases.length,2);
  await expect(page.getByRole('button',{name:'Boost ready',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'40 more credits',exact:true})).toBeDisabled();

  const rendered=[];
  for(const [width,height] of [[375,844],[390,844],[1440,900]]){
    await page.setViewportSize({width,height});await page.evaluate(()=>window.scrollTo(0,0));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`No overflow at ${width}px`);
    const audit=await new AxeBuilder({page}).include('.rewards-panel').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    assert.deepEqual(audit.violations.map(item=>({id:item.id,nodes:item.nodes.map(n=>n.target)})),[],`Rewards accessibility at ${width}px`);
    const smallControls=await page.locator('.rewards-panel button:visible,.rewards-panel select:visible,.rewards-panel summary:visible').evaluateAll(elements=>elements.filter(element=>{const b=element.getBoundingClientRect();return b.width<44||b.height<44}).map(element=>element.textContent));
    assert.deepEqual(smallControls,[],`44px reward controls at ${width}px`);
    const artifact=`rewards-${width}.png`;await page.screenshot({path:path.join(evidence,artifact),fullPage:true});
    rendered.push({viewport:`${width}x${height}`,artifact,observation:'Monthly score, goal/bonus breakdown, credits, stored freeze and used boost fit without horizontal overflow. Axe A/AA and 44px control checks passed.'});
  }
  await page.setViewportSize({width:390,height:844});
  await context.setOffline(true);
  await expect(page.locator('.rewards-status')).toContainText('last synced');
  await page.screenshot({path:path.join(evidence,'offline-mobile.png'),fullPage:true});
  const offlineRequests=rewardRequests.length;
  await expect(page.getByRole('button',{name:'40 more credits',exact:true})).toBeDisabled();
  assert.equal(rewardRequests.length,offlineRequests);
  failRewards=true;await context.setOffline(false);
  await expect(page.getByRole('button',{name:'Retry rewards',exact:true})).toBeVisible();
  await page.screenshot({path:path.join(evidence,'error-mobile.png'),fullPage:true});
  failRewards=false;await page.getByRole('button',{name:'Retry rewards',exact:true}).click();
  await expect(page.getByRole('button',{name:'Retry rewards',exact:true})).toHaveCount(0);

  owner='rewards-b';await page.reload();await openRewards();
  await expect(page.locator('.rewards-wallet')).toContainText('0');
  await expect(page.locator('.rewards-month-score>strong')).toHaveText('0points');
  assert.equal(ledger().balance,20,'Changing the signed-in account leaves A’s wallet intact.');
  owner=null;await page.evaluate(preferences=>{localStorage.removeItem('form-last-account');localStorage.setItem('form-local-demo-v1','1');localStorage.setItem('form-preferences-v1',JSON.stringify({...preferences,onboarded:true}))},initialPreferences);
  const callsBeforeGuest=rewardRequests.length;
  await page.reload();await navigate('Progress');await page.getByRole('button',{name:'Rewards & shop',exact:true}).click();
  await expect(page.getByRole('button',{name:'Sign in to earn rewards',exact:true})).toBeVisible();
  assert.equal(rewardRequests.length,callsBeforeGuest,'The local demo makes no rewards request.');
  await page.screenshot({path:path.join(evidence,'guest-mobile.png'),fullPage:true});
  await page.getByRole('button',{name:'Sign in to earn rewards',exact:true}).click();
  await expect(page.getByRole('button',{name:'Log in to Form',exact:true})).toBeVisible();
  assert.deepEqual(errors,[]);
  await writeFile(path.join(evidence,'report.json'),JSON.stringify({contract:'docs/rewards-design.md: goal rewards stay secondary to training; separate monthly score/credits and clearly priced shop with honest sync states.',targetViewports:['375x844','390x844','1440x900'],accessibility:{status:'pass',evidence:'Axe WCAG A/AA scans of Rewards at three widths; keyboard confirmation/cancel focus; all measured controls >=44px; reduced motion enabled.'},responsive:{status:'pass',evidence:'No horizontal overflow at 375,390,1440px; screenshots captured with real components.'},contentStates:{loading:{status:'pass',evidence:'Held real endpoint response; loading-mobile.png'},empty:{status:'pass',evidence:'New account zero credits and unavailable shop; empty-mobile.png'},error:{status:'pass',evidence:'503 response and retry recovery; error-mobile.png'},partial:{status:'pass',evidence:'Offline last-confirmed balance, purchases unavailable; offline-mobile.png'},success:{status:'pass',evidence:'Actual workout sync, one award/date, two purchases, reload/retry without duplicate charge.'},permission:{status:'pass',evidence:'Guest CTA reaches account sign-in with zero reward requests; guest-mobile.png'}},renderedEvidence:rendered},null,2)+'\n');
  console.log('Rewards UI passed: real workout autosync, duplicate finish/day and delete/undo, monthly comparison, purchase confirmation/focus, lost-response retry across reload, shop inventory, offline/error recovery, account isolation, guest sign-in, 3 responsive/axe audits.');
}finally{await browser.close();database.close();}
