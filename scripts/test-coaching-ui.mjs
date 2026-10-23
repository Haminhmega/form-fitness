import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium,expect} from '@playwright/test';
// Real UI and planner, isolated account identity; no production account writes.
const bundle=await build({stdin:{contents:`
 import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
 import CoachingIntake from './src/CoachingIntake';import CoachPlanOverview from './src/CoachPlanOverview';import Workout from './src/Workout';
 import {initialPreferences,initialExercises} from './src/data';import {coachingDefaults} from './shared/coaching';
 import {prepareCoachingPlan} from './src/coaching-plan';import {createWorkoutSession} from './src/domain/workout';import './src/styles.css';
 function Test(){const [preferences,setPreferences]=useState({...initialPreferences,goal:'Build aesthetic physique',experience:'Experienced',equipment:['Bodyweight','Dumbbells','Machines','Barbell','Bands'],days:['Mon','Tue','Wed','Thu','Fri','Sat'],coaching:{...coachingDefaults(),sessionMinutes:75}});const [review,setReview]=useState(false),[step,setStep]=useState(0),[session,setSession]=useState(null);const prepared=prepareCoachingPlan(preferences,[],initialExercises);
 return <main style={{maxWidth:1000,margin:'auto',padding:16}}>{session?<Workout session={session} setSession={setSession} exercises={prepared.exercises} preferences={preferences} history={[]} onRecord={()=>{}} onFinish={()=>{}} onCancel={()=>setSession(null)} onBack={()=>setSession(null)} toast={()=>{}}/>:review?<CoachPlanOverview plan={prepared.plan} exercises={prepared.exercises} onEdit={()=>setReview(false)} onUse={()=>setSession(createWorkoutSession(prepared.routines[1],prepared.exercises,[]))}/>:<><button onClick={()=>setStep(2)}>Choose schedule</button><CoachingIntake step={step} preferences={preferences} onChange={setPreferences}/><button className="btn primary" onClick={()=>setReview(true)}>Preview weekly plan</button></>}</main>}
 createRoot(document.getElementById('root')).render(<Test/>);
 `,resolveDir:process.cwd(),loader:'tsx'},bundle:true,format:'iife',write:false,outdir:'ui-test',plugins:[{name:'isolated-account',setup(build){build.onResolve({filter:/^\.\/Account$/},()=>({path:'account',namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const useAccount=()=>({user:null});',loader:'js'}));}}]});
const js=bundle.outputFiles.find(file=>file.path.endsWith('.js')).text,css=bundle.outputFiles.find(file=>file.path.endsWith('.css')).text;
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:process.env.CI?{}:{channel:'msedge'})});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.hostname!=='coaching.test')return route.abort();return route.fulfill({status:200,contentType:url.pathname==='/test.js'?'text/javascript':url.pathname==='/test.css'?'text/css':'text/html',body:url.pathname==='/test.js'?js:url.pathname==='/test.css'?css:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/test.css"></head><body><div id="root"></div><script src="/test.js"></script></body></html>'});});
 await page.goto('https://coaching.test/');
 await expect(page.getByRole('button',{name:/^Build muscle & strength/})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('button',{name:/^Get stronger|^Muscle growth · hypertrophy|^Build aesthetic physique/})).toHaveCount(0);
 await page.getByRole('button',{name:/^Build muscle & strength/}).click();
 await page.getByRole('button',{name:'Choose schedule',exact:true}).click();
 await expect(page.getByText('Recommended: at least 3 days per week.',{exact:true})).toBeVisible();
 await expect(page.getByText('Suggested starting range: 60–90 minutes',{exact:true})).toBeVisible();
 await expect(page.getByText(/Shorter workouts can be effective too/)).toBeVisible();
 for(const minutes of [60,75,90])await expect(page.getByRole('button',{name:`Use ${minutes} min`,exact:true})).toBeVisible();
 for(const day of ['Tue','Thu','Fri','Sat'])await page.getByRole('button',{name:day,exact:true}).click();
 await expect(page.locator('.coach-days button[aria-pressed="true"]')).toHaveCount(2);
 for(const day of ['Tue','Thu','Fri','Sat'])await page.getByRole('button',{name:day,exact:true}).click();
 await page.getByRole('button',{name:'Use 60 min',exact:true}).click();
 const slider=page.getByRole('slider',{name:'Time for a typical workout',exact:true});
 await expect(slider).toHaveValue('60');
 await slider.focus();await slider.press('Home');await expect(slider).toHaveValue('10');
 await slider.press('End');await expect(slider).toHaveValue('120');
 await expect(page.getByText(/A long session: useful for some experienced programs/)).toBeVisible();
 for(let i=0;i<9;i++)await slider.press('ArrowLeft');
 await expect(slider).toHaveValue('75');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'../form-coaching-duration-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Preview weekly plan',exact:true}).click();
 await expect(page.locator('.coach-plan-day')).toHaveCount(6);
 await expect(page.locator('.coach-session-timing').first()).toContainText(/About 7[0-5] min planned/);
 await expect(page.locator('.coach-session-timing').first()).toContainText('75 min target');
 await expect(page.locator('.coach-session-timing').first()).toContainText('warm-up');
 await page.screenshot({path:'../form-coaching-plan-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Use this plan',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Warm up what you’ll train.',exact:true})).toBeVisible();
 await expect(page.getByText(/3 gradual warm-up sets/).first()).toBeVisible();
 await page.getByRole('button',{name:'Skip warm-up',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Dumbbell bench press',exact:true})).toBeVisible();
 await expect(page.locator('.session-exercise')).toHaveCount(5);
 await expect(page.getByRole('button',{name:'240s',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Complete set 1',exact:true}).click();
 await expect(page.locator('.rest-panel .tag')).toHaveText('RECOVER');
 for(const width of [375,390,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`No overflow at ${width}px`);}
 assert.deepEqual(errors,[]);
 console.log('Coaching UI passed: duration advice/buttons/keyboard slider, 75-minute six-day preview, applying the plan, progressive warm-up, real prescribed sets/rest and mobile/desktop layout. Account identity isolated.');
}finally{await browser.close();}
