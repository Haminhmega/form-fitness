import type {Env} from './contracts';
import {json,sameOrigin} from './contracts';
import {hash} from './google-auth';
import {rateLimit} from './rate-limit';

const SESSION='__Host-form-session';
const SESSION_SECONDS=7*24*60*60;
const ITERATIONS=310_000;
const encoder=new TextEncoder();
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const base64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const random=(size=32)=>base64(crypto.getRandomValues(new Uint8Array(size)));
const sessionCookie=(value:string)=>`${SESSION}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}`;
const normalizeEmail=(value:unknown)=>typeof value==='string'?value.trim().toLowerCase():'';
const validPassword=(value:unknown):value is string=>typeof value==='string'&&value.length>=10&&value.length<=128;
async function readBody(request:Request){
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw Error('content');
  const declared=Number(request.headers.get('Content-Length')||0);if(declared>16_384)throw Error('size');
  const text=await request.text();if(text.length>16_384)throw Error('size');return JSON.parse(text);
}
async function derive(password:string,salt:string,iterations=ITERATIONS){
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  return base64(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:encoder.encode(salt),iterations},key,256)));
}
function equal(a:string,b:string){if(a.length!==b.length)return false;let different=0;for(let i=0;i<a.length;i++)different|=a.charCodeAt(i)^b.charCodeAt(i);return different===0}
async function createSession(env:Env,userId:string){
  const token=random();await env.DB.prepare('DELETE FROM form_sessions WHERE expires_at<?').bind(Date.now()).run();
  await env.DB.prepare('INSERT INTO form_sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await hash(token),userId,Date.now()+SESSION_SECONDS*1000).run();
  return token;
}
export function passwordAuth(){return async function(request:Request,env:Env):Promise<Response|null>{
  const url=new URL(request.url);if(url.pathname!=='/api/auth/register'&&url.pathname!=='/api/auth/login')return null;
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  if(!sameOrigin(request))return json({error:'This request must come from Form.'},403);
  let body:any;try{body=await readBody(request)}catch{return json({error:'Enter a valid email and password.'},400)}
  const email=normalizeEmail(body?.email),password=body?.password;
  if(!emailPattern.test(email)||email.length>320||!validPassword(password))return json({error:'Use a valid email and a password with at least 10 characters.'},400);
  const emailLimited=await rateLimit(env,'password-email:'+email,8,60);if(emailLimited)return emailLimited;
  if(url.pathname==='/api/auth/register'){
    const name=typeof body?.name==='string'?body.name.trim():'';
    if(!name||name.length>60)return json({error:'Enter your name (60 characters or fewer).'},400);
    const registrationLimited=await rateLimit(env,'register-email:'+email,4,3600);if(registrationLimited)return registrationLimited;
    const salt=random(24),passwordHash=await derive(password,salt),userId='password:'+crypto.randomUUID();
    const inserted=await env.DB.prepare('INSERT INTO form_password_identities (user_id,email,name,password_hash,salt,iterations,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(email) DO NOTHING').bind(userId,email,name,passwordHash,salt,ITERATIONS,new Date().toISOString()).run();
    if(!inserted.meta.changes)return json({error:'An account already exists for this email. Log in instead.'},409);
    let token:string;
    try{token=await createSession(env,userId)}catch(error){await env.DB.prepare('DELETE FROM form_password_identities WHERE user_id=?').bind(userId).run().catch(()=>{});throw error}
    return json({registered:true,user:{id:userId,email,name,provider:'password',googleLinked:false}},201,{'Set-Cookie':sessionCookie(token)});
  }
  const row=await env.DB.prepare('SELECT user_id,email,name,password_hash,salt,iterations FROM form_password_identities WHERE email=?').bind(email).first();
  const storedIterations=Number(row?.iterations);
  const iterations=Number.isInteger(storedIterations)&&storedIterations>=100_000&&storedIterations<=1_000_000?storedIterations:ITERATIONS;
  const candidate=await derive(password,row?.salt||random(24),iterations);
  if(!row||!equal(candidate,row.password_hash))return json({error:'Email or password is incorrect.'},401);
  const token=await createSession(env,row.user_id);
  return json({signedIn:true,user:{id:row.user_id,email:row.email,name:row.name,provider:'password',googleLinked:false}},200,{'Set-Cookie':sessionCookie(token)});
}}
