import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch({headless:true,channel:'msedge'});
const page=await browser.newPage({viewport:{width:390,height:844}});
await page.goto(process.env.FORM_PREVIEW_URL||'http://127.0.0.1:5192/');
await page.getByRole('button',{name:'Explore the local demo'}).click();
await page.getByRole('button',{name:'Skip onboarding'}).click();
for(const tab of ['Today','Progress','Profile']){
 await page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('button',{name:tab,exact:true}).click();
 await expect(page.getByText('Connected devices',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:/Connect your devices|Manage sources/})).toHaveCount(0);
}
await page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('button',{name:'Today',exact:true}).click();
await page.getByRole('button',{name:/Check my form/}).click();
const selector=page.getByRole('combobox',{name:'Movement experience'});
await expect(selector).toBeVisible();
await selector.selectOption('row');
await expect(page.getByText('Bench-supported single-arm dumbbell row',{exact:true})).toBeVisible();
await expect(page.getByRole('img',{name:/Bench-supported single-arm dumbbell row/})).toBeVisible();
await page.getByRole('button',{name:'2 · Pull elbow toward your hip',exact:true}).click();
await expect(page.getByRole('button',{name:'2 · Pull elbow toward your hip',exact:true})).toHaveAttribute('aria-pressed','true');
await page.getByRole('button',{name:'Play movement',exact:true}).click();
await expect(page.getByRole('button',{name:'Pause demonstration',exact:true})).toBeVisible();
await page.getByRole('button',{name:'Pause demonstration',exact:true}).click();
await page.locator('.exercise-demo').screenshot({path:'../row-specific-demo.png'});
await selector.selectOption('plank');
await expect(page.getByText(/continuous hold time and visible body position/)).toBeVisible();
await expect(page.getByRole('img',{name:/Forearm plank/})).toBeVisible();
if(await page.locator('body').evaluate(el=>el.scrollWidth>window.innerWidth))throw new Error('Mobile overflow');
await page.setViewportSize({width:1440,height:1000});
await selector.selectOption('press');
await expect(page.getByRole('img',{name:/Seated dumbbell shoulder press/})).toBeVisible();
await page.getByRole('button',{name:'2 · Press overhead',exact:true}).click();
await page.locator('.exercise-demo').screenshot({path:'../press-specific-demo.png'});
console.log('Mobile and desktop: device UI removed, movement chooser, row equipment/poses, animation controls, plank hold mode and overhead press passed.');
await browser.close();

