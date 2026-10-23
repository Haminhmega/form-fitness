import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium,expect} from '@playwright/test';
const bundle=await build({stdin:{contents:"export * from './src/data';export {createWorkoutSession} from './src/domain/workout';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const {initialPreferences,initialExercises,initialRoutines,initialHistory,createWorkoutSession}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const browser=await chromium.launch({headless:true,...(process.env.CI?{}:{channel:'msedge'})});
const base=process.env.FORM_TEST_URL||'http://127.0.0.1:5192/';
try{
  for(const kind of ['warmup','lifting','recovery','unavailable'])for(const owner of ['guest','fixture']){
    const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),writes=[],errors=[];
    page.on('dialog',d=>d.accept());page.on('pageerror',e=>errors.push(e.message));
    const preferences={...initialPreferences,onboarded:true,firstTime:false};
    const document={profile:{name:'Tester',age:null,heightCm:null,weightKg:null,targetWeightKg:null,activity:'Lightly active'},training:{preferences,routines:initialRoutines,exercises:initialExercises,history:initialHistory}};
    await page.route('**/api/**',route=>{
      const r=route.request(),path=new URL(r.url()).pathname;if(r.method()!=='GET')writes.push({path,body:r.postDataJSON()});
      const body=path==='/api/auth/options'?{password:true,google:false}:path==='/api/usage/consent'?{enabled:false,admin:false}:path==='/api/account'&&owner!=='guest'?{user:{id:owner,email:'fixture@example.test',name:'Tester',provider:'password',googleLinked:false},record:{document,revision:1,updatedAt:new Date().toISOString()}}:{error:'Fixture unavailable'};
      return route.fulfill({status:'error' in body?401:200,contentType:'application/json',body:JSON.stringify(body)});
    });
    await page.goto(base);
    const routine=kind==='recovery'?{id:'recovery-fixture',name:'Recovery day',description:'',kind:'recovery',exercises:[],recovery:{minutes:20,steps:['Easy walk']}}:initialRoutines[0];
    const session=createWorkoutSession(routine,initialExercises,[]);session.warmupComplete=kind==='lifting';
    if(kind==='lifting'){const first=Object.values(session.logs)[0][0];first.done=true;first.reps=9;session.notes[session.exercises[0].exerciseId]='Keep this note';}
    if(kind==='unavailable')session.exercises[0].exerciseId='missing-exercise';
    const sessionKey=owner==='guest'?'form-session-v1':`form-user:${owner}:form-session-v1`,timerKey=`form-workout-recovery-v1:${owner}:${session.id}`;
    await page.evaluate(({session,sessionKey,timerKey,preferences,history})=>{
      localStorage.setItem('form-local-demo-v1','1');localStorage.setItem('form-preferences-v1',JSON.stringify(preferences));localStorage.setItem('form-history-v1',JSON.stringify(history));localStorage.setItem(sessionKey,JSON.stringify(session));
      localStorage.setItem(timerKey,JSON.stringify({sessionId:session.id,restUntil:Date.now()+120000,warmupUntil:Date.now()+180000}));
      localStorage.setItem('form-workout-recovery-v1:other:other-session','other-owner-timer');
      window.history.replaceState({formView:'Workout'},'');
    },{session,sessionKey,timerKey,preferences,history:initialHistory});
    await page.reload();await expect(page.getByRole('button',{name:'Cancel session',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Cancel session',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Cancel this session?'});
    await expect(dialog).toBeVisible();await expect(dialog.getByRole('button',{name:'Keep training'})).toBeFocused();
    await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(page.getByRole('button',{name:'Cancel session',exact:true})).toBeFocused();
    assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).id,sessionKey),session.id);
    await page.getByRole('button',{name:'Cancel session',exact:true}).click();await dialog.getByRole('button',{name:'Keep training'}).click();
    if(kind==='lifting'){await expect(page.getByRole('spinbutton',{name:'Set 1 reps',exact:true})).toHaveValue('9');await expect(page.getByRole('button',{name:'Undo completion of set 1',exact:true})).toHaveAttribute('aria-pressed','true');}
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(kind==='lifting'&&owner==='guest'){await page.getByRole('button',{name:'Back to Today',exact:true}).click();assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).id,sessionKey),session.id);await page.reload();await page.getByRole('button',{name:/Resume session/}).click();}
    await page.getByRole('button',{name:'Cancel session',exact:true}).click();await dialog.getByRole('button',{name:'Discard session'}).click();
    await expect(page.getByRole('button',{name:'Cancel session',exact:true})).toHaveCount(0);
    await expect.poll(()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),sessionKey)).toBe(null);
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),timerKey),null);assert.equal(await page.evaluate(()=>localStorage.getItem('form-workout-recovery-v1:other:other-session')),'other-owner-timer');
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('form-history-v1'))),initialHistory);
    assert.deepEqual(writes.filter(w=>w.path!=='/api/rewards'||w.body.action!=='sync'),[],'Cancellation does not save account history or purchase rewards; ordinary account reward reconciliation is allowed.');
    await page.reload();await expect(page.getByRole('button',{name:'Cancel session',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:/Resume session/})).toHaveCount(0);
    assert.deepEqual(errors,[]);await context.close();
  }
  console.log('Cancel session passed: warm-up, lifting, recovery and missing exercise; guest/account ownership, Escape and keep-training, focus, mobile fit, timer cleanup, preserved history, no account writes and no resurrection after reload.');
}finally{await browser.close()}
