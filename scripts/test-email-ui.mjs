import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium,expect} from '@playwright/test';
const bundle=await build({stdin:{contents:`import {createRoot} from 'react-dom/client';import EmailSignIn from './src/EmailSignIn';import AccountEmail from './src/AccountEmail';import {UsageSettings} from './src/Usage';import './src/styles.css';import './src/account.css';const user={id:'fixture',email:'old@example.test',provider:'password',name:'Tester',googleLinked:false};createRoot(document.getElementById('root')).render(<main style={{maxWidth:500,padding:20}}>{location.pathname==='/profile'?<><AccountEmail user={user} disabled={false}/><UsageSettings user={user}/></>:<EmailSignIn/>}</main>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,format:'iife',platform:'browser',jsx:'automatic',write:false,outdir:'fixture'});
const js=bundle.outputFiles.find(f=>f.path.endsWith('.js')).text,css=bundle.outputFiles.find(f=>f.path.endsWith('.css')).text;
const browser=await chromium.launch({headless:true,...(process.env.CI?{}:{channel:'msedge'})});
try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),requests=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
    const r=route.request(),p=new URL(r.url()).pathname;let body;
    if(p.startsWith('/api/')){
      requests.push({path:p,body:r.postDataJSON()});
      if(p==='/api/auth/request-code')body={challengeId:'fixture-code',message:'Check your email for a six-digit code.'};
      else if(p==='/api/auth/reset-password')body={reset:true};
      else if(p==='/api/auth/account-email')body=r.method()==='GET'?{email:'old@example.test',hasPassword:true,emailCodes:true}:r.postDataJSON().action==='request'?{challengeId:'change-code',message:'Check your email.'}:{updated:true,message:'Email confirmed. Log in again.'};
      else if(p==='/api/usage/consent')body={enabled:r.method()==='POST'?r.postDataJSON().enabled:false,admin:false};
      else body={registered:true};
      return route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
    }
    return route.fulfill({contentType:p==='/test.js'?'text/javascript':p==='/test.css'?'text/css':'text/html',body:p==='/test.js'?js:p==='/test.css'?css:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/test.css"></head><body><div id="root"></div><script src="/test.js"></script></body></html>'});
  });
  await page.goto('https://email.test/');await page.getByRole('button',{name:'Create account',exact:true}).click();
  await page.getByLabel('Your name',{exact:true}).fill('Tester');await page.getByLabel('Email',{exact:true}).fill('new@example.test');await page.getByLabel('Password',{exact:true}).fill('password fixture');await page.getByLabel('Confirm password',{exact:true}).fill('password fixture');await page.getByRole('button',{name:'Send confirmation code',exact:true}).click();
  await expect(page.getByLabel('Email confirmation code')).toBeVisible();assert.equal(requests.filter(r=>r.path.endsWith('/register')).length,0);
  await page.getByLabel('Email confirmation code').fill('123456');await page.getByRole('button',{name:'Confirm & create account'}).click();await expect.poll(()=>requests.filter(r=>r.path.endsWith('/register')).length).toBe(1);
  assert.equal(requests.find(r=>r.path.endsWith('/register')).body.challengeId,'fixture-code');
  await page.goto('https://email.test/');await page.getByRole('button',{name:'Forgot password?'}).click();await page.getByLabel('Email',{exact:true}).fill('new@example.test');await page.getByRole('button',{name:'Send confirmation code'}).click();await page.getByLabel('New password',{exact:true}).fill('another password fixture');await page.getByLabel('Confirm password',{exact:true}).fill('another password fixture');await page.getByLabel('Email confirmation code').fill('654321');await page.getByRole('button',{name:'Update password',exact:true}).click();await expect(page.getByText('Password updated. Log in with your new password.')).toBeVisible();
  await page.goto('https://email.test/profile');await page.getByText('Email & password',{exact:true}).click();await page.getByLabel('New email').fill('changed@example.test');await page.getByLabel('Current password').fill('password fixture');await page.getByRole('button',{name:'Send confirmation code'}).click();await page.getByLabel('Email confirmation code').fill('123456');await page.getByRole('button',{name:'Confirm email',exact:true}).click();await expect(page.getByRole('link',{name:'Log in again'})).toBeVisible();
  const update=requests.filter(r=>r.path.endsWith('account-email')&&r.body?.action==='confirm')[0];assert.equal(update.body.password,'password fixture');assert.equal(update.body.email,'changed@example.test');
  await expect(page.getByLabel('Share basic usage activity')).not.toBeChecked();await page.getByLabel('Share basic usage activity').click();await expect.poll(()=>requests.some(r=>r.path.endsWith('/consent')&&r.body?.enabled===true)).toBe(true);
  await expect(page.getByLabel('Share basic usage activity')).toBeChecked();
  assert.equal(await page.evaluate(()=>Object.values(localStorage).some(v=>/password fixture|123456/.test(v))),false);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  console.log('Mobile account UI passed: register code step, reset completion, password-protected email update, opt-in control, no credential storage and no horizontal overflow.');
}finally{await browser.close()}
