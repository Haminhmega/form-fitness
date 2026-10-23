import {json,sameOrigin,type Env} from './contracts';
import {rateLimit} from './rate-limit';
import {derivePasswordHash,PASSWORD_ITERATIONS} from './password-hash';

export const emailReady=(env:Env)=>Boolean(env.RESEND_API_KEY&&env.EMAIL_FROM&&env.AUTH_CODE_SECRET&&env.AUTH_CODE_SECRET.length>=32);
const normalize=(value:unknown)=>typeof value==='string'?value.trim().toLowerCase():'';
const invalid=()=>json({error:'This code is invalid or expired. Request a new code.'},400);
export async function authBody(request:Request){
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw Error('content');
  const reader=request.body?.getReader();if(!reader)throw Error('body');
  const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16384){await reader.cancel();throw Error('size')}chunks.push(value)}}finally{reader.releaseLock()}
  const all=new Uint8Array(size);let offset=0;for(const c of chunks){all.set(c,offset);offset+=c.length}
  return JSON.parse(new TextDecoder().decode(all));
}
async function codeHash(env:Env,id:string,email:string,purpose:string,code:string){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.AUTH_CODE_SECRET!),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(JSON.stringify([id,email,purpose,code])))),b=>b.toString(16).padStart(2,'0')).join('');
}
function newCode(){let value:number;do{value=crypto.getRandomValues(new Uint32Array(1))[0]}while(value>=4294000000);return String(value%1000000).padStart(6,'0')}
export async function consumeCode(env:Env,body:any,purpose:string){
  if(!emailReady(env)||typeof body?.challengeId!=='string'||!/^\d{6}$/.test(body?.code))return null;
  const email=normalize(body.email),now=Date.now();
  const attempt=await env.DB.prepare('UPDATE form_email_codes SET attempts=attempts+1 WHERE id=? AND email=? AND purpose=? AND expires_at>? AND attempts<5 AND consumed_at IS NULL RETURNING code_hash').bind(body.challengeId,email,purpose,now).first();
  if(!attempt)return null;
  const digest=await codeHash(env,body.challengeId,email,purpose,body.code);
  if(digest!==attempt.code_hash)return null;
  const claimed=await env.DB.prepare('UPDATE form_email_codes SET consumed_at=? WHERE id=? AND code_hash=? AND consumed_at IS NULL AND expires_at>? RETURNING email').bind(now,body.challengeId,digest,now).first();
  return claimed?.email||null;
}
export async function emailCodeAuth(request:Request,env:Env,send:typeof fetch=fetch):Promise<Response|null>{
  const path=new URL(request.url).pathname;
  if(!['/api/auth/request-code','/api/auth/reset-password'].includes(path))return null;
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  if(!sameOrigin(request))return json({error:'This request must come from Form.'},403);
  if(!emailReady(env))return json({error:'Email verification is not available yet. Please try again later.'},503);
  let body:any;try{body=await authBody(request)}catch{return json({error:'Check your details and retry.'},400)}
  const email=normalize(body?.email);
  if(email.length>320||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({error:'Enter a valid email.'},400);
  const ip=request.headers.get('CF-Connecting-IP')||'local';
  if(path==='/api/auth/reset-password'){
    if(typeof body.password!=='string'||body.password.length<10||body.password.length>128)return json({error:'Use a password with 10–128 characters.'},400);
    const limited=await rateLimit(env,'code-check:'+ip,15,60);if(limited)return limited;
    // Derive before consuming the one-time code; no password is stored in a challenge.
    const salt=crypto.randomUUID(),passwordHash=await derivePasswordHash(body.password,salt);
    if(!await consumeCode(env,body,'reset'))return invalid();
    const updated=await env.DB.prepare('UPDATE form_password_identities SET password_hash=?,salt=?,iterations=?,credential_version=credential_version+1,email_verified_at=? WHERE email=? RETURNING user_id').bind(passwordHash,salt,PASSWORD_ITERATIONS,new Date().toISOString(),email).first();
    if(!updated)return invalid();
    await env.DB.prepare('DELETE FROM form_sessions WHERE user_id=?').bind(updated.user_id).run();
    return json({reset:true,message:'Password updated. Log in with your new password.'});
  }
  const purpose=body.purpose;if(purpose!=='register'&&purpose!=='reset')return json({error:'Invalid request.'},400);
  return issueCode(request,env,email,purpose,send);
}
export async function issueCode(request:Request,env:Env,email:string,purpose:string,send:typeof fetch=fetch){
  if(!emailReady(env))return json({error:'Email verification is not available yet. Please try again later.'},503);
  const ip=request.headers.get('CF-Connecting-IP')||'local';
  for(const [key,limit,seconds] of [[`email-send:${email}`,1,60],[`email-hour:${email}`,5,3600],[`email-ip:${ip}`,10,3600],['email-daily',90,86400]] as const){const limited=await rateLimit(env,key,limit,seconds);if(limited)return limited}
  const challengeId=crypto.randomUUID(),code=newCode(),now=Date.now();
  await env.DB.prepare('DELETE FROM form_email_codes WHERE expires_at<? OR (email=? AND purpose=?)').bind(now,email,purpose).run();
  const exists=await env.DB.prepare('SELECT user_id FROM form_password_identities WHERE email=?').bind(email).first();
  if(purpose!=='reset'||exists){
    await env.DB.prepare('INSERT INTO form_email_codes(id,email,purpose,code_hash,expires_at,attempts) VALUES(?,?,?,?,?,0)').bind(challengeId,email,purpose,await codeHash(env,challengeId,email,purpose,code),now+600000).run();
    let delivered=false;
    try{
      const response=await send('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':challengeId},body:JSON.stringify({from:env.EMAIL_FROM,to:[email],subject:purpose==='reset'?'Reset your Form password':'Confirm your Form email',text:`Your Form ${purpose==='reset'?'password reset':'email confirmation'} code is ${code}.\n\nIt expires in 10 minutes and can be used once. If you did not request it, ignore this email. Never share your code.`}),signal:AbortSignal.timeout(10000)});
      delivered=response.ok;
    }catch{/* Do not log addresses, codes or provider responses. */}
    if(!delivered){await env.DB.prepare('DELETE FROM form_email_codes WHERE id=?').bind(challengeId).run();if(purpose!=='reset')return json({error:'The email could not be sent. Please retry later.'},503)}
  }
  // Reset responses do not reveal whether an address has a password account.
  return json({challengeId,expiresIn:600,message:purpose!=='reset'?'Check your email for a six-digit code.':'If this address has a password account, a reset code will arrive shortly.'});
}
