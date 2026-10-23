import {json,sameOrigin,type Env} from './contracts';
import {identity,hash,clearSessionCookie} from './google-auth';
import {authBody,consumeCode,issueCode,emailReady} from './email-codes';
import {derivePasswordHash,PASSWORD_ITERATIONS} from './password-hash';
import {rateLimit} from './rate-limit';

function equal(a:string,b:string){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
export async function accountEmail(request:Request,env:Env):Promise<Response|null>{
  if(new URL(request.url).pathname!=='/api/auth/account-email')return null;
  const user=await identity(request,env);if(!user)return json({error:'Sign in to manage your email.'},401);
  const row=await env.DB.prepare('SELECT * FROM form_password_identities WHERE user_id=?').bind(user.id).first();
  if(request.method==='GET')return json({email:row?.email||user.email,hasPassword:!!row,emailCodes:emailReady(env),google:user.provider==='google'});
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  if(!sameOrigin(request)||request.headers.get('X-Form-Account')!==user.id)return json({error:'Your account changed. Refresh and try again.'},403);
  if(!emailReady(env))return json({error:'Email verification is not available yet.'},503);
  const limited=await rateLimit(env,'email-change:'+user.id,8,600);if(limited)return limited;
  let body:any;try{body=await authBody(request)}catch{return json({error:'Check your details.'},400)}
  if(!['request','confirm'].includes(body?.action))return json({error:'Invalid request.'},400);
  const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
  if(email.length>320||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({error:'Enter a valid email.'},400);
  if(row){
    if(typeof body.password!=='string'||body.password.length>128||!equal(await derivePasswordHash(body.password,row.salt,row.iterations),row.password_hash))return json({error:'Your current password is incorrect.'},401);
    if(email===row.email)return json({error:'Enter a different email address.'},400);
  }else{
    // Adding password sign-in verifies the existing provider address first.
    if(email!==user.email.toLowerCase())return json({error:'First verify your current email and add a Form password. You can then change your email.'},400);
    if(user.provider==='google'){
      const token=(request.headers.get('Cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('__Host-form-session='))?.split('=')[1]||'';
      const fresh=await env.DB.prepare('SELECT 1 AS fresh FROM form_sessions WHERE token_hash=? AND user_id=? AND expires_at>?').bind(await hash(token),user.id,Date.now()+7*86400000-300000).first();
      if(!fresh)return json({error:'Sign in with Google again, then return here within five minutes.',reauth:true},401);
    }
    if(body.action==='confirm'&&(typeof body.password!=='string'||body.password.length<10||body.password.length>128))return json({error:'Choose a Form password with 10–128 characters.'},400);
  }
  const purpose=row?`change:${user.id}:${row.credential_version}`:`add:${user.id}`;
  if(body.action==='request')return issueCode(request,env,email,purpose);
  if(!await consumeCode(env,body,purpose))return json({error:'This code is invalid or expired. Request a new code.'},400);
  const now=new Date().toISOString();
  if(row){
    const changed=await env.DB.prepare('UPDATE form_password_identities SET email=?,email_verified_at=?,credential_version=credential_version+1 WHERE user_id=? AND credential_version=? AND password_hash=? AND NOT EXISTS(SELECT 1 FROM form_password_identities WHERE email=?) RETURNING user_id').bind(email,now,user.id,row.credential_version,row.password_hash,email).first();
    if(!changed)return json({error:'This email cannot be used, or your credentials changed. Request a new code and retry.'},409);
  }else{
    const salt=crypto.randomUUID(),passwordHash=await derivePasswordHash(body.password,salt);
    const added=await env.DB.prepare('INSERT INTO form_password_identities(user_id,email,name,password_hash,salt,iterations,created_at,email_verified_at,credential_version) VALUES(?,?,?,?,?,?,?,?,1) ON CONFLICT DO NOTHING').bind(user.id,email,user.name||'Form member',passwordHash,salt,PASSWORD_ITERATIONS,now,now).run();
    if(!added.meta.changes)return json({error:'This email already has a Form password account. Accounts are not merged automatically.'},409);
  }
  await env.DB.prepare('DELETE FROM form_sessions WHERE user_id=?').bind(user.id).run();
  await env.DB.prepare('DELETE FROM form_email_codes WHERE email=? OR purpose=?').bind(row?.email||email,purpose).run();
  return json({updated:true,message:'Email confirmed. Log in with your email and Form password. Other Form sessions have been signed out.'},200,{'Set-Cookie':clearSessionCookie()});
}
