import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
const output='D:/projects/projects/form-lens-evidence';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CI?{}:{channel:'msedge'})});
try{
  for(const width of [320,390,430]){
    const context=await browser.newContext({viewport:{width,height:844},hasTouch:true});
    await context.addInitScript(()=>{localStorage.setItem('form-haptics-v1','on');window.navigationPulses=[];Object.defineProperty(navigator,'vibrate',{value:p=>{window.navigationPulses.push(p);return true}})});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/api/**',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
    await page.goto(process.env.FORM_TEST_URL||'http://127.0.0.1:5192/');
    await page.getByRole('button',{name:'Explore the local demo',exact:true}).click();
    await page.getByRole('button',{name:'Close training preferences'}).click();
    const nav=page.getByRole('navigation',{name:'Mobile navigation'}),today=nav.getByRole('button',{name:'Today',exact:true}),profile=nav.getByRole('button',{name:'Profile',exact:true}),train=nav.getByRole('button',{name:'Train',exact:true});
    assert.equal(await nav.getByRole('button').count(),4,'Optical copies never become controls');
    const center=async locator=>{const r=await locator.boundingBox();return{x:r.x+r.width/2,y:r.y+r.height/2}};
    const a=await center(today),b=await center(profile);
    await page.evaluate(()=>window.scrollTo(0,0));
    const initialScroll=await page.evaluate(()=>scrollY);
    const initialHistory=await page.evaluate(()=>{window.navigationPulses=[];return history.length});
    await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:16});
    await expect(today).toHaveAttribute('aria-current','page');
    await expect(nav).toHaveAttribute('data-pressed','true');
    assert.equal(await page.evaluate(()=>scrollY),initialScroll,'Dragging the fixed bar does not scroll the page');
    assert.equal(await page.evaluate(()=>history.length),initialHistory,'Drag preview leaves the route alone');
    await page.screenshot({path:`${output}/${width}-drag.png`});
    await page.mouse.up();await expect(profile).toHaveAttribute('aria-current','page');
    await expect(nav).toHaveAttribute('data-pressed','false');
    assert.equal(await page.evaluate(()=>history.length),initialHistory+1,'Release commits one route');
    assert.deepEqual(await page.evaluate(()=>window.navigationPulses),[8],'One haptic on commit, none during preview');
    await expect.poll(()=>nav.evaluate(el=>{const lens=el.querySelector('.nav-lens').getBoundingClientRect(),button=el.querySelector('[aria-current=page]').getBoundingClientRect();return Math.abs(lens.left-button.left)+Math.abs(lens.width-button.width)})).toBeLessThan(2);
    await page.screenshot({path:`${output}/${width}-settled.png`});
    // Release outside and Escape both preserve the selected route.
    const c=await center(train);
    await page.mouse.move(b.x,b.y);await page.mouse.down();await page.mouse.move(c.x,c.y-100,{steps:10});await page.mouse.up();
    await expect(profile).toHaveAttribute('aria-current','page');
    await page.mouse.move(b.x,b.y);await page.mouse.down();await page.mouse.move(c.x,c.y,{steps:8});await page.keyboard.press('Escape');await page.mouse.up();
    await expect(profile).toHaveAttribute('aria-current','page');
    await page.mouse.move(b.x,b.y);await page.mouse.down();await page.mouse.move(c.x,c.y,{steps:8});
    await nav.dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();
    await expect(profile).toHaveAttribute('aria-current','page');
    await train.focus();await page.keyboard.press('Enter');await expect(train).toHaveAttribute('aria-current','page');
    await today.focus();await page.keyboard.press('Space');await expect(today).toHaveAttribute('aria-current','page');
    await page.touchscreen.tap(c.x,c.y);await expect(train).toHaveAttribute('aria-current','page');
    await today.click();await profile.click();await train.click();await expect(train).toHaveAttribute('aria-current','page');
    await page.goBack();await expect(profile).toHaveAttribute('aria-current','page');
    await expect.poll(()=>nav.evaluate(el=>Math.abs(el.querySelector('.nav-lens').getBoundingClientRect().left-el.querySelector('[aria-current=page]').getBoundingClientRect().left))).toBeLessThan(2);
    await page.emulateMedia({reducedMotion:'reduce'});await today.click();
    assert.equal(await nav.locator('.nav-optic-cell > span').first().evaluate(el=>getComputedStyle(el).transform),'none');
    await page.emulateMedia({contrast:'more'});await expect(nav.locator('.nav-lens')).toBeHidden();
    await page.emulateMedia({contrast:'no-preference',reducedMotion:'no-preference'});
    await page.setViewportSize({width:width+10,height:760});
    await expect.poll(()=>nav.evaluate(el=>Math.abs(el.querySelector('.nav-lens').getBoundingClientRect().width-el.querySelector('[aria-current=page]').getBoundingClientRect().width))).toBeLessThan(2);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(errors,[]);await context.close();
  }
  console.log('Mobile lens passed at 320/390/430px: drag preview, single release commit, outside/Escape cancellation, keyboard, touch taps, rapid navigation, browser back, geometry after resize, reduced motion and high contrast. No physical Safari or frame-rate claim.');
}finally{await browser.close()}
