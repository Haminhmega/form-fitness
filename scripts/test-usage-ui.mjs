import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {build} from 'esbuild';
import {chromium,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Local account fixtures only. No request reaches a production endpoint.
const bundle=await build({stdin:{contents:`
  import {createRoot} from 'react-dom/client';
  import {UsageTelemetry,UsageSettings,BetaUsageNotice} from './src/Usage';
  import './src/styles.css';import './src/account.css';import './src/progress-profile.css';import './src/mobile.css';import './src/glass.css';import './src/spacing.css';
  const user={id:'tester',email:'tester@example.test',provider:'password',name:'Tester',googleLinked:false};
  const guest=location.pathname==='/guest';
  createRoot(document.getElementById('root')).render(<main className="profile-page" style={{maxWidth:600,padding:16}}><h1>Form beta</h1><UsageTelemetry user={guest?null:user}/>{!guest&&<><BetaUsageNotice user={user} onManage={()=>document.querySelector('.account-usage').scrollIntoView()}/><UsageSettings user={user}/></>}</main>);
`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,format:'iife',platform:'browser',jsx:'automatic',write:false,outdir:'usage-ui-fixture'});
const js=bundle.outputFiles.find(f=>f.path.endsWith('.js')).text,css=bundle.outputFiles.find(f=>f.path.endsWith('.css')).text;
const browser=await chromium.launch({headless:true,...(process.env.CI?{}:{channel:'msedge'})});
const output=new URL('../../form-usage-evidence/',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1');
await mkdir(output,{recursive:true});
try{
  for(const width of [320,390,430,1440]){
    const context=await browser.newContext({viewport:{width,height:900}});
    const page=await context.newPage(),events=[],writes=[],errors=[];
    let enabled=true,admin=false,unavailable=false,dashboardAccess='private';
    page.on('pageerror',e=>errors.push(e.message));await page.clock.install();
    await page.route('**/*',async route=>{
      const request=route.request(),path=new URL(request.url()).pathname;
      if(path==='/api/usage/consent'){
        if(request.method()==='POST'){writes.push(request.postDataJSON());enabled=request.postDataJSON().enabled}
        return route.fulfill({status:unavailable?503:200,contentType:'application/json',body:JSON.stringify(unavailable?{error:'Fixture unavailable'}:{enabled,admin,dashboardAccess})});
      }
      if(path==='/api/usage/report')return route.fulfill({contentType:'application/json',body:JSON.stringify({generatedAt:new Date().toISOString(),windowStart:'2026-10-01',firstEvent:null,weekly:3,monthly:5,days:[],months:[]})});
      if(path==='/api/usage/event'){events.push(request.postDataJSON());return route.fulfill({contentType:'application/json',body:'{"accepted":true}'})}
      return route.fulfill({contentType:path==='/app.js'?'text/javascript':path==='/app.css'?'text/css':'text/html',body:path==='/app.js'?js:path==='/app.css'?css:'<!doctype html><html lang="en"><head><title>Beta usage fixture</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>'});
    });
    await page.goto('https://usage.test/');
    await expect.poll(()=>events.filter(e=>e.kind==='open').length).toBe(1);
    assert.equal(writes.length,0,'Recording starts without a preference click or consent write');
    await expect(page.getByLabel('Share basic usage activity')).toBeChecked();
    const info=page.locator('.account-usage > .more-info');
    await expect(info).not.toHaveAttribute('open');
    await info.locator('summary').click();await expect(info.getByText(/Events contain activity timestamps/)).toBeVisible();
    await info.locator('summary').click();
    await expect(info.getByText(/Events contain activity timestamps/)).toBeHidden();
    await expect(page.getByRole('complementary',{name:'Beta usage reporting'})).toBeVisible();
    await page.clock.fastForward(60000);await expect.poll(()=>events.filter(e=>e.kind==='active').length).toBe(1);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    assert.deepEqual(audit.violations.map(v=>v.id),[]);
    await page.screenshot({path:`${output}/${width}-beta-usage.png`,fullPage:true});
    await page.getByRole('button',{name:'Dismiss usage notice'}).click();
    assert.equal(writes.length,0,'Notice dismissal does not change reporting');
    await page.clock.fastForward(60000);await expect.poll(()=>events.filter(e=>e.kind==='active').length).toBe(2);
    const activeCount=events.length;await page.clock.fastForward(6*60000);assert.equal(events.length,activeCount,'Idle tabs do not emit heartbeats');
    await page.getByLabel('Share basic usage activity').click();
    await expect.poll(()=>writes.at(-1)?.enabled).toBe(false);
    const stopped=events.length;await page.clock.fastForward(60000);assert.equal(events.length,stopped,'Opt-out stops telemetry immediately');
    await page.reload();await expect(page.getByLabel('Share basic usage activity')).toBeEnabled();
    await expect(page.getByLabel('Share basic usage activity')).not.toBeChecked();
    await page.clock.fastForward(60000);assert.equal(events.length,stopped,'Reload preserves the server opt-out');
    await page.getByLabel('Share basic usage activity').click();
    await expect.poll(()=>events.length).toBeGreaterThan(stopped);
    for(const event of events)assert.deepEqual(Object.keys(event).sort(),['id','kind'],'No personal content in events');
    dashboardAccess='verify-email';await page.reload();
    await expect(page.getByText('Private usage dashboard',{exact:true})).toBeVisible();
    await expect(page.getByText(/Your owner email needs verification/)).toBeVisible();
    await expect(page.getByRole('button',{name:'Refresh usage report'})).toHaveCount(0);
    await expect(page.getByRole('link',{name:'Open sign-in to reset password'})).toHaveAttribute('href','/?auth=login');
    if(width<=430){
      const bounds=await page.locator('.account-action-stack > *').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,width:r.width,height:r.height}}));
      assert.ok(bounds[1].top-bounds[0].bottom>=11,'Owner action buttons need separation');
      assert.ok(bounds.every(b=>b.height>=44),'Wrapped action buttons remain tappable');
      await page.screenshot({path:`${output}/${width}-usage-spacing.png`,fullPage:true});
      await page.evaluate(()=>{document.documentElement.style.fontSize='200%';document.querySelector('.account-usage').style.fontSize='200%'});
      await page.screenshot({path:`${output}/${width}-usage-large-text.png`,fullPage:true});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Expanded text does not overflow');
      assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>el.getClientRects().length&&el.getBoundingClientRect().right>innerWidth+1).map(el=>({tag:el.tagName,cls:el.className,text:el.textContent.slice(0,60),right:el.getBoundingClientRect().right}))),[],'Expanded text does not cause horizontal overflow');
      await page.evaluate(()=>{document.documentElement.style.fontSize='';document.querySelector('.account-usage').style.fontSize=''});
    }
    admin=true;dashboardAccess='available';await page.getByRole('button',{name:'Check dashboard access'}).click();
    await expect(page.getByText(/Your owner email needs verification/)).toHaveCount(0);
    const beforeOwner=events.length;
    await page.reload();await expect(page.getByText('Private usage dashboard',{exact:true})).toBeVisible();
    await page.locator('.usage-dashboard > summary').click();
    await page.getByRole('button',{name:'Refresh usage report'}).click();
    await expect(page.getByText('Active accounts · 7 days',{exact:true})).toBeVisible();
    await expect(page.getByText(/UTC dates, rolling 90-day retention/)).toBeHidden();
    await page.getByLabel('More info about this usage report',{exact:true}).click();
    await expect(page.getByText(/UTC dates, rolling 90-day retention/)).toBeVisible();
    await page.clock.fastForward(60000);assert.equal(events.length,beforeOwner,'Owner activity is excluded');
    await page.goto('https://usage.test/guest');await page.clock.fastForward(60000);assert.equal(events.length,beforeOwner,'Guests are excluded');
    admin=false;unavailable=true;await page.goto('https://usage.test/');
    await expect(page.getByText('Connect to the internet to manage this preference.')).toBeVisible();
    await page.clock.fastForward(60000);assert.equal(events.length,beforeOwner,'Unavailable preferences do not start telemetry');
    assert.deepEqual(errors,[]);await context.close();
  }
  console.log('Beta usage UI passed: automatic opens/activity, no consent write, notice, dismissal, opt-out/reload, re-enable, idle suppression, owner/guest/error exclusion, payload minimization, collapsible explanations, separated owner actions, enlarged-text wrapping, report loading, and four responsive accessibility audits.');
}finally{await browser.close()}
