import {useEffect,useState,type FormEvent} from 'react';
import type {AccountUser} from '../shared/account';
import {authRequest} from './EmailSignIn';
export default function AccountEmail({user,disabled}:{user:AccountUser;disabled:boolean}){
  const [details,setDetails]=useState<{email:string;hasPassword:boolean;emailCodes:boolean}|null>(null),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[challenge,setChallenge]=useState(''),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[reauth,setReauth]=useState(false),[done,setDone]=useState(false);
  useEffect(()=>{let cancelled=false;fetch('/api/auth/account-email',{cache:'no-store',credentials:'same-origin'}).then(async r=>{if(!r.ok)throw Error('Reconnect to manage your email.');return r.json()}).then(data=>{if(!cancelled){setDetails(data);setEmail(data.hasPassword?'':data.email)}}).catch(e=>{if(!cancelled)setError(e.message)});return()=>{cancelled=true}},[user.id]);
  async function submit(event:FormEvent){event.preventDefault();setBusy(true);setError('');try{
    if(!details?.hasPassword&&challenge&&password!==confirm)throw Error('Passwords do not match.');
    const data=await authRequest('account-email',{action:challenge?'confirm':'request',email,password,code,challengeId:challenge},user.id);
    if(data.updated){setPassword('');setConfirm('');setCode('');setDone(true);setMessage(data.message)}else{setChallenge(data.challengeId);setCode('');setMessage(data.message)}
  }catch(e){setError((e as Error).message);setReauth((e as {reauth?:boolean}).reauth===true)}finally{setBusy(false)}}
  return <details className="account-email"><summary>Email & password</summary><p className="settings-note">Current email: {details?.email||user.email}</p>{done?<><p role="status">{message}</p><a className="btn primary" href="/?auth=login">Log in again</a></>:<form className="account-auth-form" onSubmit={submit}>
    {!details?.hasPassword&&<p className="settings-note">First confirm your current email and add a Form password. You can then change your email. Your linked Google account stays linked.</p>}
    <label className="field">{details?.hasPassword?'New email':'Email to confirm'}<input type="email" autoComplete="email" maxLength={320} required disabled={disabled||busy||!!challenge||!details?.hasPassword} value={email} onChange={e=>setEmail(e.target.value)}/></label>
    {(details?.hasPassword||challenge)&&<label className="field">{details?.hasPassword?'Current password':'Create a Form password'}<input type="password" autoComplete={details?.hasPassword?'current-password':'new-password'} minLength={10} maxLength={128} required disabled={disabled||busy} value={password} onChange={e=>setPassword(e.target.value)}/></label>}
    {!details?.hasPassword&&challenge&&<label className="field">Confirm password<input type="password" autoComplete="new-password" minLength={10} maxLength={128} required disabled={disabled||busy} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>}
    {challenge&&<label className="field">Email confirmation code<input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required disabled={disabled||busy} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/></label>}
    <button className="btn secondary" disabled={disabled||busy||!details?.emailCodes}>{busy?'Please wait…':challenge?'Confirm email':'Send confirmation code'}</button>
    {challenge&&<button type="button" className="btn ghost" disabled={busy} onClick={()=>{setChallenge('');setCode('');setMessage('')}}>Start again / resend</button>}
    {details&&!details.emailCodes&&<p role="status">Email setup is in progress. Please try again later.</p>}
    {disabled&&<p className="settings-note">Finish your workout and sync your changes before updating sign-in details.</p>}
    {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}{reauth&&<a className="btn secondary" href="/auth/google">Confirm with Google</a>}
  </form>}</details>;
}
