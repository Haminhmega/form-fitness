import {chromium} from '@playwright/test';
const browser=await chromium.launch({headless:true,channel:"msedge"});
const page=await browser.newPage({viewport:{width:390,height:844}});
await page.goto('http://127.0.0.1:5191/');
await page.getByRole('button',{name:'Explore the local demo'}).click();
await page.getByRole('button',{name:'Skip onboarding'}).click();
await page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('button',{name:'Train',exact:true}).click();
await page.getByRole('tab',{name:'Exercise library',exact:true}).click();
await page.getByRole('searchbox',{name:'Search exercises'}).fill('Dumbbell shoulder press');
await page.getByRole('button',{name:'View Dumbbell shoulder press details',exact:true}).click();
await page.getByLabel('Dumbbell shoulder press details',{exact:true}).scrollIntoViewIfNeeded();
await page.screenshot({path:'../anatomy-mobile.png',fullPage:false});
if(await page.locator('body').evaluate(el=>el.scrollWidth>window.innerWidth))throw new Error('Horizontal overflow');
await page.getByRole('button',{name:'Lateral deltoid · side shoulder',exact:true}).click();
if(await page.getByRole('button',{name:'Lateral deltoid · side shoulder',exact:true}).getAttribute('aria-pressed')!=='true')throw new Error('Selection failed');
console.log('Mobile anatomy rendered without overflow; muscle selection passed.');
await browser.close();

