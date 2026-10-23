import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import {chromium,expect} from '@playwright/test';

const baseline=process.argv.includes('--baseline');
const output=new URL(`../../form-mobile-evidence/${baseline?'before':'after'}/`,import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CI?{}:{channel:'msedge'})});
const report=[];
try{
  for(const width of [320,390,430,768,1440]){
    const context=await browser.newContext({viewport:{width,height:width>760?1000:844},reducedMotion:'reduce'});
    const page=await context.newPage(),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/api/**',route=>route.fulfill({status:route.request().url().endsWith('/auth/options')?200:401,contentType:'application/json',body:JSON.stringify(route.request().url().endsWith('/auth/options')?{password:true,emailCodes:true,google:false}:{error:'Local guest fixture'})}));
    const nav=name=>page.getByRole('navigation',{name:width<=760?'Mobile navigation':'Primary navigation'}).getByRole('button',{name,exact:true}).click();
    async function capture(screen){
      if(!['exercise','rest','cancel','appearance'].includes(screen))await page.evaluate(()=>window.scrollTo(0,0));
      const measurements=await page.evaluate(()=>({
        overflow:document.documentElement.scrollWidth>innerWidth,
        smallControls:[...document.querySelectorAll('button,input:not([type=checkbox]):not([type=radio]),select,summary')].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden').map(e=>({label:(e.getAttribute('aria-label')||e.textContent||'input').trim().slice(0,50),height:Math.round(e.getBoundingClientRect().height),width:Math.round(e.getBoundingClientRect().width)})).filter(e=>e.height<44||e.width<44),
        smallFields:[...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]),select,textarea')].filter(e=>e.getClientRects().length).filter(e=>parseFloat(getComputedStyle(e).fontSize)<16).map(e=>e.getAttribute('aria-label')||e.name),
      }));
      report.push({width,screen,...measurements});
      if(!baseline){
        assert.equal(measurements.overflow,false,`${width}px ${screen} must not overflow`);
        if(width<=430){
          assert.deepEqual(measurements.smallControls,[],`${width}px ${screen}: touch targets must be at least 44px`);
          assert.deepEqual(measurements.smallFields,[],`${width}px ${screen}: fields must use at least 16px text`);
        }
        if(width===390&&['today','progress','profile','workout','cancel'].includes(screen)){
          const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
          assert.deepEqual(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[],`${screen} accessibility`);
        }
      }
      if(width===390&&screen==='workout')await page.screenshot({path:`${output}/390-workout-phone.png`});
      if(width===390||width===1440)await page.screenshot({path:`${output}/${width}-${screen}.png`,fullPage:screen==='workout'});
    }
    await page.goto(process.env.FORM_TEST_URL||'http://127.0.0.1:5192/');
    await capture('welcome');
    await page.getByRole('button',{name:'Explore the local demo',exact:true}).click();
    await page.getByRole('button',{name:'Close training preferences',exact:true}).click();
    await capture('today');
    await nav('Train');await capture('routines');
    await page.getByRole('tab',{name:'Exercise library',exact:true}).click();
    await page.getByLabel('Search exercises',{exact:true}).fill('squat');
    await expect(page.getByRole('button',{name:'View Bodyweight squat details',exact:true})).toBeVisible();
    await capture('library');
    await page.getByRole('button',{name:'View Bodyweight squat details',exact:true}).click();await capture('exercise');
    await nav('Progress');await capture('progress');
    await nav('Profile');await capture('profile');
    if(!baseline){
      const appearance=page.locator('.appearance-panel');
      await expect(appearance).not.toHaveAttribute('open');
      await appearance.locator('summary').click();
      await expect(page.getByRole('button',{name:'Pink theme',exact:true})).toBeVisible();
      await page.getByRole('button',{name:'Pink theme',exact:true}).click();
      await expect(page.getByRole('button',{name:'Pink theme',exact:true})).toHaveAttribute('aria-pressed','true');
      await capture('appearance');
      await appearance.locator('summary').click();
      const install=page.locator('.install-panel');
      await install.locator('summary').click();
      await expect(install.getByText('Add to Home Screen',{exact:true})).toBeVisible();
      await install.locator('summary').click();
    }
    await nav('Today');await page.getByRole('button',{name:'Start workout',exact:true}).click();await capture('warmup');
    await page.getByRole('button',{name:'Skip warm-up',exact:true}).click();await capture('workout');
    if(!baseline&&width<=430){
      await expect(page.getByRole('navigation',{name:'Mobile navigation'})).toBeHidden();
      const dock=page.locator('.workout-dock');
      const bounds=await dock.boundingBox();assert.ok(bounds&&bounds.y+bounds.height<=845,'Workout controls stay on screen');
      const instructions=page.locator('.workout-guide .exercise-instructions');
      await instructions.locator(':scope > summary').click();
      await expect(instructions).toHaveAttribute('open');
      await instructions.locator(':scope > summary').click();
      await expect(instructions).not.toHaveAttribute('open');
    }
    await page.getByRole('spinbutton',{name:'Set 1 reps',exact:true}).fill('9');
    await page.getByRole('button',{name:'Complete set 1',exact:true}).click();
    await capture('rest');
    if(!baseline&&width<=430){
      const spacing=await page.evaluate(()=>({padding:parseFloat(getComputedStyle(document.querySelector('main')).paddingBottom),dock:innerHeight-document.querySelector('.workout-dock').getBoundingClientRect().top}));
      assert.ok(spacing.padding>spacing.dock,'Warm-up transition and growing rest dock reserve content space');
    }
    if(!baseline&&width<=430){
      await page.locator('.workout-dock').getByRole('button',{name:'Skip rest',exact:true}).click();
      await expect(page.locator('.workout-dock .dock-rest')).toHaveCount(0);
      await page.locator('.workout-dock').getByRole('button',{name:'Log set 2',exact:true}).click();
      await expect(page.getByRole('button',{name:'Undo completion of set 2',exact:true})).toBeVisible();
      await page.getByRole('button',{name:'Back to Today',exact:true}).click();
      await expect(page.getByRole('navigation',{name:'Mobile navigation'})).toBeVisible();
      await nav('Profile');
      await page.locator('.appearance-panel > summary').click();
      await page.getByRole('button',{name:'Blue theme',exact:true}).click();
      const floating=await page.locator('.mobile-nav, .resume-bar, .toast').evaluateAll(els=>els.filter(el=>el.getClientRects().length).map(el=>{const r=el.getBoundingClientRect();return {name:el.className,top:r.top,bottom:r.bottom,left:r.left,right:r.right}}));
      for(let i=0;i<floating.length;i++)for(let j=i+1;j<floating.length;j++)assert.ok(floating[i].bottom+7<=floating[j].top||floating[j].bottom+7<=floating[i].top,`Floating controls need at least 8px separation: ${JSON.stringify(floating)}`);
      await page.screenshot({path:`${output}/${width}-floating-spacing.png`});
      await page.getByRole('button',{name:'Dismiss notification'}).click();
      await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
      const clearance=await page.evaluate(()=>({space:parseFloat(getComputedStyle(document.querySelector('main')).paddingBottom),bars:Math.max(...[...document.querySelectorAll('.resume-bar,.mobile-nav')].map(el=>innerHeight-el.getBoundingClientRect().top))}));
      assert.ok(clearance.space>clearance.bars,'Content reserves enough room for the floating controls');
      await page.getByRole('button',{name:'Resume',exact:true}).click();
    }
    await page.getByRole('button',{name:'Cancel session',exact:true}).click();await capture('cancel');
    await page.getByRole('dialog',{name:'Cancel this session?'}).getByRole('button',{name:'Keep training',exact:true}).click();
    await expect(page.getByRole('spinbutton',{name:'Set 1 reps',exact:true})).toHaveValue('9');
    assert.deepEqual(errors,[]);await context.close();
  }
  await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify({screens:report.length,overflow:report.filter(r=>r.overflow).map(r=>`${r.width}/${r.screen}`),undersizedPhoneControls:report.filter(r=>r.width<=430).reduce((sum,r)=>sum+r.smallControls.length,0),accessibilityAudits:baseline?0:5,output},null,2));
}finally{await browser.close()}

