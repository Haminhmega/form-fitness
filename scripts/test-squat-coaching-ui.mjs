import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium,expect} from '@playwright/test';
import {squatAttemptInput,coachingTestTools} from './test-squat-coaching.mjs';

// Actual React view + real geometry analysis; decoding/inference mocked here.
// scripts/inspect-local-form-video.mjs separately exercises real video inference.
const {analyzeSquat,smoothPoseInput}=await coachingTestTools();
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
  for(const kind of ['hinge','squat']){
    const result=analyzeSquat(smoothPoseInput(squatAttemptInput({kind})));
    const bundle=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import AIRecording from './src/AIRecording';import './src/styles.css';const exercise={id:'squat',name:'Bodyweight squat',muscle:'Legs',equipment:'Bodyweight',supported:true,instructions:'Lower and stand.',variation:'Standard',filming:'Side view'};createRoot(document.getElementById('root')).render(<AIRecording exercise={exercise} standalone onClose={()=>{}} onComplete={()=>{}} onExample={()=>{}}/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,format:'iife',write:false,outdir:'ui-test',plugins:[{name:'local-inference-fixture',setup(build){build.onResolve({filter:/\/ai\/analyzeVideo$/},()=>({path:'inference',namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export async function analyzeVideo(){return ${JSON.stringify(result)}}`,loader:'js'}));}}]});
    const js=bundle.outputFiles.find(f=>f.path.endsWith('.js')).text,css=bundle.outputFiles.find(f=>f.path.endsWith('.css')).text;
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>{
      const u=new URL(route.request().url());if(u.hostname!=='coaching.test')return route.abort();
      return route.fulfill({contentType:u.pathname==='/test.js'?'text/javascript':u.pathname==='/test.css'?'text/css':'text/html',body:u.pathname==='/test.js'?js:u.pathname==='/test.css'?css:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/test.css"></head><body><div id="root"></div><script src="/test.js"></script></body></html>'});
    });
    await page.addInitScript(()=>{
      const position=new WeakMap();for(const [name,value] of Object.entries({duration:9,videoWidth:600,videoHeight:800,readyState:4}))Object.defineProperty(HTMLVideoElement.prototype,name,{configurable:true,get:()=>value});
      Object.defineProperty(HTMLMediaElement.prototype,'currentTime',{configurable:true,get(){return position.get(this)||0},set(value){position.set(this,value);this.dispatchEvent(new Event('timeupdate'))}});
      HTMLMediaElement.prototype.pause=function(){};HTMLMediaElement.prototype.play=function(){this.dispatchEvent(new Event('play'));return Promise.resolve()};
      document.addEventListener('error',e=>{if(e.target instanceof HTMLVideoElement)e.stopImmediatePropagation()},true);
    });
    await page.goto('https://coaching.test/');
    await page.locator('input[type=file]').setInputFiles({name:'synthetic.webm',mimeType:'video/webm',buffer:Buffer.from('UI fixture')});
    await page.getByRole('checkbox',{name:/I confirm/}).check();
    await page.getByRole('button',{name:'Analyze bodyweight squat video',exact:true}).click();
    if(kind==='hinge'){
      await expect(page.getByRole('heading',{name:'Adjustment recommended.',exact:true})).toBeVisible();
      await expect(page.getByRole('heading',{name:'Bend your knees more as you lower',exact:true})).toBeVisible();
      await expect(page.getByRole('list',{name:'Practice steps'}).locator('li')).toHaveCount(3);
      await expect(page.locator('.feedback-assessment')).toContainText('3 movement attempts reviewed · 0 full reps counted');
      await page.getByText('Another setup to try',{exact:true}).click();
      await expect(page.getByText(/This is an optional setup experiment/)).toBeVisible();
      await page.getByRole('button',{name:/Review moment/}).first().click();
      assert.ok(await page.locator('video').evaluate(v=>v.currentTime)>.4);
      await expect(page.locator('.ai-pose-overlay g[stroke="#ffb46b"] line')).toHaveCount(4);
    }else{
      await expect(page.getByRole('heading',{name:'Nice work—no issues detected.',exact:true})).toBeVisible();
      await expect(page.getByRole('heading',{name:'What went well',exact:true})).toBeVisible();
      await expect(page.locator('.form-feedback-summary')).toContainText('movement checks I could complete');
      await expect(page.locator('.feedback-observed')).toContainText('No mismatch');
      await expect(page.getByRole('heading',{name:'Adjustment recommended.',exact:true})).toHaveCount(0);
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.locator('.form-feedback').screenshot({path:`../form-squat-${kind}-mobile.png`});
    await page.setViewportSize({width:1440,height:1000});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(errors,[]);await page.close();
  }
  console.log('Squat coaching UI passed: judgment without counted reps, corrections, optional stance experiment, timed replay highlight, positive closure, and mobile/desktop layout. Media decoding/inference mocked.');
}finally{await browser.close()}
