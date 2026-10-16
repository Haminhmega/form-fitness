import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {build} from 'esbuild';
import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const directory=resolve('../form-movement-evidence');
await mkdir(directory,{recursive:true});
const bundle=await build({stdin:{contents:`
 import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
 import {ExerciseDemo} from './src/ExerciseDemo';import {initialExercises} from './src/data';
 import {coachingExercises} from './src/coaching-exercises';import {demonstrationKey} from './src/exercise-demonstrations';import './src/styles.css';
 const seen=new Set();const exercises=[...initialExercises,...coachingExercises].filter(e=>{const key=demonstrationKey(e);if(!key||seen.has(key))return false;seen.add(key);return true});
 function App(){const [id,setId]=useState('gym-1105-dumbbell-bench-press');const selected=exercises.find(e=>e.id===id)||{...exercises[0],id:'custom',custom:true,name:'My custom exercise'};
 const gallery=location.search.includes('gallery');
 return <main style={{maxWidth:gallery?1800:600,margin:'auto',padding:16}}><h1 style={{fontSize:24,marginBottom:16}}>Movement references</h1>{gallery?<div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:16}}>{exercises.map(e=><ExerciseDemo key={e.id} exercise={e}/>)}</div>:<><label htmlFor="exercise">Exercise</label><select id="exercise" value={id} onChange={e=>setId(e.target.value)} style={{marginBottom:16}}>{exercises.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}<option value="custom">Custom exercise</option></select><ExerciseDemo exercise={selected}/><div style={{height:1000}}/></>}</main>;
 }createRoot(document.getElementById('root')).render(<App/>);
 `,resolveDir:process.cwd(),loader:'tsx'},bundle:true,format:'iife',write:false,outdir:'demo-test'});
const js=bundle.outputFiles.find(f=>f.path.endsWith('.js')).text,css=bundle.outputFiles.find(f=>f.path.endsWith('.css')).text;
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:process.env.CI?{}:{channel:'msedge'})});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage(),errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname!=='movement.test'){external.push(url.href);return route.abort();}
 return route.fulfill({status:200,contentType:url.pathname==='/test.js'?'text/javascript':url.pathname==='/test.css'?'text/css':'text/html',body:url.pathname==='/test.js'?js:url.pathname==='/test.css'?css:'<!doctype html><html lang="en"><head><title>Movement reference test</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/test.css"></head><body><div id="root"></div><script src="/test.js"></script></body></html>'});});
 await page.goto('https://movement.test/');
 await expect(page.getByRole('img')).toHaveAccessibleName(/Flat dumbbell bench press/);
 const slider=page.getByRole('slider',{name:'Movement position'});
 await expect(slider).toHaveValue('0');
 await slider.focus();await slider.press('End');await expect(slider).toHaveValue('100');
 assert.equal(await slider.evaluate(el=>getComputedStyle(el).outlineStyle),'solid','Keyboard focus has a visible outline');
 await page.getByRole('button',{name:/01 \/ START/}).click();await expect(slider).toHaveValue('0');
 await page.getByRole('button',{name:'Play movement',exact:true}).click();
 await expect(slider).not.toHaveValue('0');
 await page.getByRole('button',{name:'Pause demonstration'}).click();
 await page.getByRole('button',{name:/02 \/ FINISH/}).click();await expect(slider).toHaveValue('100');
 for(const width of [375,390,1440]){
  await page.setViewportSize({width,height:width===1440?900:844});await page.evaluate(()=>scrollTo(0,0));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(width!==375)await page.screenshot({path:resolve(directory,`bench-${width}.png`)});
 }
 for(const element of await page.locator('.exercise-demo button,.exercise-demo input').all())assert.ok((await element.boundingBox()).height>=44,'Movement controls have at least 44px height');
 const axe=await new AxeBuilder({page}).include('.exercise-demo').withTags(['wcag2a','wcag2aa']).analyze();
 assert.deepEqual(axe.violations.map(v=>({id:v.id,description:v.description})),[]);
 await page.selectOption('#exercise','coach-cable-pushdown');await expect(slider).toHaveValue('0');
 await expect(page.getByRole('img')).toHaveAccessibleName(/Cable triceps pushdown/);
 await page.getByRole('button',{name:'Play movement',exact:true}).click();await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));
 await expect(page.getByRole('button',{name:'Play movement',exact:true})).toBeAttached();
 await page.evaluate(()=>scrollTo(0,0));await page.emulateMedia({reducedMotion:'reduce'});
 await expect(page.getByRole('button',{name:'Play movement',exact:true})).toHaveCount(0);
 await expect(page.getByText(/Reduced motion is on/)).toBeVisible();
 await slider.focus();await slider.press('End');await expect(slider).toHaveValue('100');
 await page.selectOption('#exercise','custom');await expect(page.getByText(/A matching demonstration/)).toBeVisible();await expect(page.getByRole('img')).toHaveCount(0);
 await page.selectOption('#exercise','plank');await expect(slider).toHaveCount(0);
 await page.setViewportSize({width:1800,height:1000});await page.goto('https://movement.test/?gallery');
 await expect(page.locator('.exercise-demo')).toHaveCount(31);
 await page.screenshot({path:resolve(directory,'gallery-start.png'),fullPage:true});
 for(const button of await page.locator('.demo-phase-controls button:nth-child(2)').all())await button.click();
 await page.screenshot({path:resolve(directory,'gallery-finish.png'),fullPage:true});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log('Movement UI passed: 31 references, keyboard/phase/playback controls, off-screen pause, reduced motion, custom fallback, 375/390/1440px layout, 44px targets, scoped axe A/AA, and zero external requests or runtime errors.');
 console.log('Rendered evidence: '+directory);
}finally{await browser.close();}
