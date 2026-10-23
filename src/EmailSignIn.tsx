import {useState,type FormEvent} from 'react';
export async function authRequest(path:string,body:unknown,accountId?:string){
  const r=await fetch('/api/auth/'+path,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-Form-Client':'1',...(accountId?{'X-Form-Account':accountId}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  const data=await r.json().catch(()=>({error:'Account service is unavailable.'}));if(!r.ok)throw Object.assign(Error(data.error||'Please retry later.'),{reauth:data.reauth});return data;
}
export default function EmailSignIn(){
  const [mode,setMode]=useState<'login'|'register'|'reset'>('login'),[name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[challenge,setChallenge]=useState(''),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  function choose(next:typeof mode){setMode(next);setPassword('');setConfirm('');setCode('');setChallenge('');setError('');setMessage('')}
  async function requestCode(){const data=await authRequest('request-code',{email,purpose:mode});setChallenge(data.challengeId);setCode('');setMessage(data.message)}
  async function submit(event:FormEvent){event.preventDefault();setError('');setBusy(true);try{
    if(mode==='login'){await authRequest('login',{email,password});setPassword('');window.location.assign('/');return}
    if((mode==='register'||challenge)&&password!==confirm)throw Error('Passwords do not match.');
    if(!challenge){await requestCode();return}
    await authRequest(mode==='reset'?'reset-password':'register',{email,password,name,challengeId:challenge,code});
    if(mode==='register'){setPassword('');setConfirm('');window.location.assign('/');return}
    choose('login');setMessage('Password updated. Log in with your new password.');
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  return <><div className="account-auth-tabs" aria-label="Account action"><button type="button" disabled={busy} aria-pressed={mode==='login'} onClick={()=>choose('login')}>Log in</button><button type="button" disabled={busy} aria-pressed={mode==='register'} onClick={()=>choose('register')}>Create account</button></div><form className="account-auth-form" onSubmit={submit}>
    {mode==='reset'&&<h3>Reset your password</h3>}
    {mode==='register'&&<label className="field">Your name<input autoComplete="name" required maxLength={60} value={name} onChange={e=>setName(e.target.value)} disabled={busy}/></label>}
    <label className="field">Email<input type="email" autoComplete="email" required maxLength={320} value={email} disabled={busy||!!challenge} onChange={e=>setEmail(e.target.value)}/></label>
    {(mode!=='reset'||challenge)&&<><label className="field">{mode==='reset'?'New password':'Password'}<input type="password" autoComplete={mode==='login'?'current-password':'new-password'} required minLength={10} maxLength={128} value={password} disabled={busy} onChange={e=>setPassword(e.target.value)}/></label>{mode!=='login'&&<label className="field">Confirm password<input type="password" autoComplete="new-password" required minLength={10} maxLength={128} value={confirm} disabled={busy} onChange={e=>setConfirm(e.target.value)}/></label>}</>}
    {challenge&&<><label className="field">Email confirmation code<input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} disabled={busy} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/></label><p className="settings-note">Expires after 10 minutes. Check your spam folder too.</p><button type="button" className="btn ghost" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await requestCode()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}}>Resend code</button><button type="button" className="btn ghost" disabled={busy} onClick={()=>{setChallenge('');setCode('');setMessage('')}}>Change email</button></>}
    <button className="btn primary" disabled={busy}>{busy?'Please wait…':mode==='login'?'Log in to Form':!challenge?'Send confirmation code':mode==='reset'?'Update password':'Confirm & create account'}</button>
    {message&&<p role="status">{message}</p>}{error&&<p className="notice" role="alert">{error}</p>}
    {mode==='login'&&<button type="button" className="btn ghost" disabled={busy} onClick={()=>choose('reset')}>Forgot password?</button>}
    {mode==='reset'&&<button type="button" className="btn ghost" disabled={busy} onClick={()=>choose('login')}>Back to login</button>}
  </form></>;
}
