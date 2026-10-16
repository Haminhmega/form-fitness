import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium,expect} from '@playwright/test';
import {makeFeedbackFixture} from './test-form-feedback.mjs';

// Isolated React integration test. Media decoding and inference are explicitly
// mocked; this verifies replay state/UI, not a real camera or model's accuracy.
const fixture=makeFeedbackFixture({exerciseId:'pushup',bodyChange:true});
const bundle=await build({stdin:{contents:`
  import React from 'react';import {createRoot} from 'react-dom/client';
  import AIRecording from './src/AIRecording';import './src/styles.css';
  const exercise={id:'pushup',name:'Push-up',muscle:'Chest',equipment:'Bodyweight',supported:true,instructions:'Lower and press.',variation:'Standard',filming:'Side view'};
  createRoot(document.getElementById('root')).render(<AIRecording exercise={exercise} standalone onClose={()=>{}} onComplete={()=>{}} onExample={()=>{}}/>);
`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,format:'iife',write:false,outdir:'ui-test',plugins:[{
  name:'local-inference-fixture',setup(build){
    build.onResolve({filter:/\/ai\/analyzeVideo$/},()=>({path:'inference',namespace:'fixture'}));
    build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export async function analyzeVideo(){return ${JSON.stringify(fixture.result)}}`,loader:'js'}));
  }
}]});
const js=bundle.outputFiles.find(f=>f.path.endsWith('.js')).text,css=bundle.outputFiles.find(f=>f.path.endsWith('.css')).text;
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:process.env.CI?{}:{channel:'msedge'})});
try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.hostname!=='form-feedback.test')return route.abort();
    return route.fulfill({status:200,contentType:url.pathname==='/test.js'?'text/javascript':url.pathname==='/test.css'?'text/css':'text/html',body:url.pathname==='/test.js'?js:url.pathname==='/test.css'?css:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/test.css"></head><body><div id="root"></div><script src="/test.js"></script></body></html>'});
  });
  await page.addInitScript(()=>{
    const position=new WeakMap();
    for(const [name,value] of Object.entries({duration:8,videoWidth:600,videoHeight:800,readyState:4}))Object.defineProperty(HTMLVideoElement.prototype,name,{configurable:true,get:()=>value});
    Object.defineProperty(HTMLMediaElement.prototype,'currentTime',{configurable:true,get(){return position.get(this)||0},set(value){position.set(this,value);this.dispatchEvent(new Event('timeupdate'))}});
    HTMLMediaElement.prototype.pause=function(){};
    HTMLMediaElement.prototype.play=function(){this.dispatchEvent(new Event('play'));return Promise.resolve()};
    document.addEventListener('error',event=>{if(event.target instanceof HTMLVideoElement)event.stopImmediatePropagation()},true);
  });
  await page.goto('http://form-feedback.test/');
  await page.locator('input[type=file]').setInputFiles({name:'synthetic.webm',mimeType:'video/webm',buffer:Buffer.from('UI fixture, no video data')});
  await page.getByRole('checkbox',{name:/I confirm/}).check();
  await page.getByRole('button',{name:'Analyze push-up video',exact:true}).click();
  const card=page.locator('.form-feedback-card').filter({has:page.getByRole('heading',{name:'Review your hips dropping',exact:true})});
  await expect(card.locator('.feedback-phase')).toHaveText('Lowering phase');
  await expect(card.locator('.feedback-cue')).toContainText('Brace');
  await card.getByText('Why this may help',{exact:true}).click();
  await expect(card.locator('.feedback-why')).toContainText('does not measure spinal loading');
  await page.getByRole('checkbox',{name:'Show tracked joints'}).uncheck();
  await card.getByRole('button',{name:/Review moment/}).click();
  await expect(page.getByRole('checkbox',{name:'Show tracked joints'})).toBeChecked();
  await expect(page.locator('.ai-pose-overlay g[stroke="#ffb46b"] line')).toHaveCount(2);
  assert.ok(await page.locator('video').evaluate(v=>v.currentTime)>0,'Review button seeks the actual media element');
  await expect(page.locator('.feedback-review-caption')).toContainText('hips dropping');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No mobile page overflow');
  await page.locator('.form-feedback').screenshot({path:'../form-feedback-mobile.png'});
  await page.locator('video').evaluate(v=>{v.currentTime=7;});
  await expect(page.locator('.ai-pose-overlay g[stroke="#ffb46b"]')).toHaveCount(0);
  await card.getByRole('button',{name:/Review moment/}).click();
  await page.locator('video').evaluate(v=>v.play());
  await expect(page.locator('.ai-pose-overlay g[stroke="#ffb46b"]')).toHaveCount(0);
  await page.setViewportSize({width:1440,height:1000});
  await card.getByRole('button',{name:/Review moment/}).click();
  await expect(page.locator('.ai-pose-overlay g[stroke="#ffb46b"] line')).toHaveCount(2);
  await page.locator('.form-feedback').screenshot({path:'../form-feedback-desktop.png'});
  await page.getByRole('button',{name:'Analyze again',exact:true}).click();
  await expect(page.locator('.feedback-review-caption')).toHaveCount(0);
  assert.deepEqual(errors,[]);
  console.log('Feedback UI integration passed: phase/cue/explanation, timestamp seek, same-side highlight, overlay enable, clearing on scrub/play/reanalysis, and phone/desktop layout. Inference and media decoding were mocked.');
}finally{await browser.close();}
