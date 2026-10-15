import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {build} from 'esbuild';
import {chromium,expect} from '@playwright/test';

// Exercise the real provider, login form and profile panel in an isolated browser.
// All account responses are fixtures; no live accounts or production endpoints.
const bundle=await build({stdin:{contents:`
  import {createRoot} from 'react-dom/client';
  import {AccountProvider,AccountPanel,useAccount} from './src/Account';
  import {initialPreferences} from './src/data';
  function Probe(){const a=useAccount();return <>
    <output data-testid="account">{a.user?.id||'guest'}</output>
    <output data-testid="state">{a.status}:{String(a.dirty)}:{String(a.requiresSignIn)}</output>
    <button onClick={()=>a.refresh()}>Refresh fixture</button>
    <button onClick={()=>a.editTraining('preferences',{...a.document.training.preferences,goal:'Build strength'})}>Edit device goal</button>
    <AccountPanel preferences={a.document?.training.preferences||initialPreferences}/>
  </>}
  createRoot(document.getElementById('root')).render(<AccountProvider><Probe/></AccountProvider>);
`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,format:'iife',platform:'browser',jsx:'automatic',write:false,loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"test"'}});
const server=createServer((request,response)=>{
  response.setHeader('Content-Type',request.url==='/test.js'?'text/javascript':'text/html');
  response.end(request.url==='/test.js'?bundle.outputFiles[0].text:request.url==='/blank'?'<!doctype html>':'<!doctype html><html><body><div id="root"></div><script src="/test.js"></script></body></html>');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
const prefs={units:'kg',notifications:false,cloud:false,contribute:false,retention:'30 days',goal:'Build muscle',experience:'Getting started',equipment:['Dumbbells'],days:['Mon'],onboarded:true,firstTime:true};
const makeUser=id=>({id,email:`${id}@example.test`,name:`Account ${id}`,provider:'password',googleLinked:false});
const makeDoc=id=>({profile:{name:`Account ${id}`,age:null,heightCm:null,weightKg:null,targetWeightKg:null,activity:'Lightly active'},training:{preferences:prefs,routines:[],exercises:[],history:[]}});
const makeRecord=id=>({document:makeDoc(id),revision:4,updatedAt:'2026-10-15T12:00:00Z'});
const cachedA={user:makeUser('a'),document:makeDoc('a'),revision:4,dirty:true};

async function scenario({cache=cachedA,user=null,record=null,loginAs='a',seed={}}={}){
  const context=await browser.newContext();const page=await context.newPage();
  const writes=[];let identity=user,remote=record;
  await page.route('**/api/**',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname;
    let status=200,body;
    if(path==='/api/auth/options')body={password:true,google:false};
    else if(path==='/api/auth/login'){identity=makeUser(loginAs);remote=makeRecord(loginAs);body={signedIn:true,user:identity}}
    else if(path==='/api/auth/signout'){identity=null;remote=null;body={signedOut:true,hasPlatformSession:false}}
    else if(path==='/api/account'){
      if(!identity){status=401;body={error:'Sign in to access your Form account.'}}
      else if(request.method()==='PUT'){const update=request.postDataJSON();writes.push({account:request.headers()['x-form-account'],...update});remote={document:update.document,revision:update.revision+1,updatedAt:'2026-10-15T13:00:00Z'};body={record:remote}}
      else body={user:identity,record:remote};
    }else {status=404;body={error:'Unknown fixture'}}
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto(origin+'/blank');
  await page.evaluate(({cache,seed})=>{
    if(cache){localStorage.setItem('form-last-account',cache.user.id);localStorage.setItem('form-account-v1:'+cache.user.id,JSON.stringify(cache))}
    Object.entries(seed).forEach(([key,value])=>localStorage.setItem(key,value));
  },{cache,seed});
  await page.goto(origin);
  return {context,page,writes,setRemote:(nextUser,nextRecord)=>{identity=nextUser;remote=nextRecord}};
}
async function login(page){
  await page.getByRole('link',{name:'Sign in again',exact:true}).click();
  await expect(page.getByRole('button',{name:'Log in to Form',exact:true})).toBeVisible();
  await page.getByLabel('Email',{exact:true}).fill('tester@example.test');
  await page.getByLabel('Password',{exact:true}).fill('test password long enough');
  await page.getByRole('button',{name:'Log in to Form',exact:true}).click();
}
try{
  const same=await scenario();
  await expect(same.page.getByTestId('account')).toHaveText('a');
  await expect(same.page.getByTestId('state')).toHaveText('error:true:true');
  await same.page.getByRole('button',{name:'Edit device goal',exact:true}).click();
  await expect(same.page.getByTestId('state')).toHaveText('error:true:true');
  assert.equal(same.writes.length,0);
  await login(same.page);
  await expect(same.page.getByTestId('state')).toHaveText('ready:false:false');
  assert.equal(same.writes.length,1);
  assert.equal(same.writes[0].account,'a');
  assert.equal(same.writes[0].document.training.preferences.goal,'Build strength');
  await same.context.close();

  const switched=await scenario({loginAs:'b'});
  await expect(switched.page.getByTestId('state')).toHaveText('error:true:true');
  await login(switched.page);
  await expect(switched.page.getByTestId('account')).toHaveText('b');
  await expect(switched.page.getByTestId('state')).toHaveText('ready:false:false');
  assert.equal(switched.writes.length,0,'Signing into B must never send account A’s pending changes.');
  assert.equal(await switched.page.evaluate(()=>JSON.parse(localStorage.getItem('form-account-v1:a')).dirty),true);
  await switched.context.close();

  const skipped=await scenario({cache:null,user:makeUser('a')});
  await skipped.page.getByRole('button',{name:'Skip for now',exact:true}).click();
  await expect(skipped.page.getByTestId('account')).toHaveText('a');
  await skipped.page.getByRole('button',{name:'Refresh fixture',exact:true}).click();
  await expect(skipped.page.getByTestId('account')).toHaveText('a');
  await skipped.page.reload();
  await expect(skipped.page.getByTestId('account')).toHaveText('a');
  skipped.setRemote(makeUser('b'),null);
  await skipped.page.getByRole('button',{name:'Refresh fixture',exact:true}).click();
  await expect(skipped.page.getByRole('button',{name:'Skip for now',exact:true})).toBeVisible();
  await skipped.context.close();

  const signout=await scenario({cache:{...cachedA,dirty:false},user:makeUser('a'),record:makeRecord('a'),seed:{'form-workout-recovery-v1':JSON.stringify({sessionId:'session-a',restUntil:123,warmupUntil:456}),'form-workout-recovery-v1:a:session-a':'private recovery','form-workout-recovery-v1:b:session-b':'other timer','form-user:a:form-session-v1':JSON.stringify({id:'session-a'}),'form-account-v1:b':'other account copy'}});
  await expect(signout.page.getByTestId('state')).toHaveText('ready:false:false');
  await signout.page.evaluate(()=>{sessionStorage.setItem('form-rest','123');sessionStorage.setItem('form-warmup','456')});
  await signout.page.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(signout.page.getByRole('button',{name:'Log in to Form',exact:true})).toBeVisible();
  const device=await signout.page.evaluate(()=>({cache:localStorage.getItem('form-account-v1:a'),session:localStorage.getItem('form-user:a:form-session-v1'),recovery:localStorage.getItem('form-workout-recovery-v1'),owned:localStorage.getItem('form-workout-recovery-v1:a:session-a'),otherTimer:localStorage.getItem('form-workout-recovery-v1:b:session-b'),other:localStorage.getItem('form-account-v1:b'),rest:sessionStorage.getItem('form-rest'),warmup:sessionStorage.getItem('form-warmup')}));
  assert.deepEqual(device,{cache:null,session:null,recovery:null,owned:null,otherTimer:'other timer',other:'other account copy',rest:null,warmup:null});
  await signout.context.close();
  console.log('Account browser checks passed: expired-session recovery, same-owner sync, different-account isolation, skipped setup persistence, and sign-out cleanup.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
