import {createRemoteJWKSet,jwtVerify,type JWTVerifyGetKey} from 'jose';
import type {Env} from './contracts';
import {json,sameOrigin} from './contracts';
import type {AccountUser} from '../shared/account';

const SESSION='__Host-form-session', STATE='__Host-form-oauth';
const SESSION_SECONDS=7*24*60*60;
const tokenPattern=/^[A-Za-z0-9_-]{43}$/;
const keys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const base64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const random=()=>base64(crypto.getRandomValues(new Uint8Array(32)));
export async function hash(value:string){return base64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))))}
function cookie(request:Request,name:string){const values=(request.headers.get('Cookie')||'').split(';').map(v=>v.trim()).filter(v=>v.startsWith(name+'='));return values.length===1?values[0].slice(name.length+1):values.length?'':null}
const setCookie=(name:string,value:string,seconds:number)=>`${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${seconds}`;
export const clearSessionCookie=()=>setCookie(SESSION,'',0);
function redirect(location:string,cookies:string[]=[]){const headers=new Headers({'Location':location,'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});cookies.forEach(value=>headers.append('Set-Cookie',value));return new Response(null,{status:303,headers})}
export const authErrorRedirect=(reason:string)=>redirect('/?auth_error='+encodeURIComponent(reason));
export const hasSessionCookie=(request:Request)=>cookie(request,SESSION)!==null;
export function googleReady(env:Env){try{return !!env.GOOGLE_CLIENT_ID?.endsWith('.apps.googleusercontent.com')&&!!env.GOOGLE_CLIENT_SECRET&&!!env.AUTH_ORIGIN&&new URL(env.AUTH_ORIGIN).origin===env.AUTH_ORIGIN&&env.AUTH_ORIGIN.startsWith('https://')}catch{return false}}
function platformIdentity(request:Request):Omit<AccountUser,'googleLinked'>|null{
  const id=request.headers.get('oai-authenticated-user-id'),email=request.headers.get('oai-authenticated-user-email');
  if(!id||!email||id.length>512||email.length>320)return null;
  let name='';if(request.headers.get('oai-authenticated-user-full-name-encoding')==='percent-encoded-utf-8')try{name=decodeURIComponent(request.headers.get('oai-authenticated-user-full-name')||'')}catch{}
  return {id,email,name:name.slice(0,100),provider:'chatgpt'};
}
export type IdentityResult={user:AccountUser|null;clearSession:boolean};
export async function identityResult(request:Request,env:Env):Promise<IdentityResult>{
  const raw=cookie(request,SESSION);
  if(raw!==null){
    if(tokenPattern.test(raw)){
      const row=await env.DB.prepare('SELECT s.user_id,g.email,g.name FROM form_sessions s JOIN form_google_identities g ON g.user_id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(await hash(raw),Date.now()).first();
      if(row)return {user:{id:row.user_id,email:row.email,name:row.name,provider:'google',googleLinked:true},clearSession:false};
    }
    const platform=platformIdentity(request);
    if(platform){
      const linked=await env.DB.prepare('SELECT 1 AS linked FROM form_google_identities WHERE user_id=?').bind(platform.id).first();
      return {user:{...platform,googleLinked:!!linked},clearSession:true};
    }
    return {user:null,clearSession:true};
  }
  const platform=platformIdentity(request);
  if(!platform)return {user:null,clearSession:false};
  const linked=await env.DB.prepare('SELECT 1 AS linked FROM form_google_identities WHERE user_id=?').bind(platform.id).first();
  return {user:{...platform,googleLinked:!!linked},clearSession:false};
}
export async function identity(request:Request,env:Env){return (await identityResult(request,env)).user}
export async function verifyGoogleToken(token:string,clientId:string,nonceHash:string,key:JWTVerifyGetKey|CryptoKey=keys){
  const {payload}=await jwtVerify(token,key as JWTVerifyGetKey,{issuer:['https://accounts.google.com','accounts.google.com'],audience:clientId,algorithms:['RS256'],requiredClaims:['exp','iat','sub','nonce','email','email_verified'],maxTokenAge:'10 minutes',clockTolerance:5});
  if(typeof payload.sub!=='string'||!payload.sub||payload.sub.length>255||typeof payload.email!=='string'||!payload.email||payload.email.length>320||payload.email_verified!==true||typeof payload.nonce!=='string'||await hash(payload.nonce)!==nonceHash||payload.azp!==undefined&&payload.azp!==clientId)throw Error('Invalid identity');
  return {sub:payload.sub,email:payload.email,name:typeof payload.name==='string'?payload.name.slice(0,100):''};
}
type Dependencies={exchange?:typeof fetch;verify?:typeof verifyGoogleToken};
export function googleAuth(dependencies:Dependencies={}){
  const exchange=dependencies.exchange||fetch,verify=dependencies.verify||verifyGoogleToken;
  return async function(request:Request,env:Env):Promise<Response|null>{
    const url=new URL(request.url);
    if(url.pathname==='/api/auth/options')return json({google:googleReady(env),chatgpt:true});
    if(url.pathname==='/api/auth/signout'){
      if(request.method!=='POST')return json({error:'Method not allowed'},405);
      if(!sameOrigin(request))return json({error:'This request must come from Form.'},403);
      const raw=cookie(request,SESSION);
      if(raw&&tokenPattern.test(raw))await env.DB.prepare('DELETE FROM form_sessions WHERE token_hash=?').bind(await hash(raw)).run();
      return json({signedOut:true},200,{'Set-Cookie':clearSessionCookie()});
    }
    if(url.pathname!=='/auth/google'&&url.pathname!=='/auth/google/callback')return null;
    if(request.method!=='GET')return json({error:'Method not allowed'},405);
    if(!googleReady(env)||url.origin!==env.AUTH_ORIGIN)return authErrorRedirect('unavailable');
    const callback=env.AUTH_ORIGIN+'/auth/google/callback';
    if(url.pathname==='/auth/google'){
      // A link operation is initiated only from the signed-in Profile screen.
      const link=url.searchParams.get('mode')==='link';
      if(link&&request.headers.get('Sec-Fetch-Site')!=='same-origin')return authErrorRedirect('start_from_profile');
      const user=link?await identity(request,env):null;
      if(link&&!user)return redirect('/?auth_error=sign_in_first');
      const state=random(),nonce=random(),verifier=random();
      await env.DB.prepare('DELETE FROM form_oauth_states WHERE expires_at<?').bind(Date.now()).run();
      await env.DB.prepare('DELETE FROM form_sessions WHERE expires_at<?').bind(Date.now()).run();
      await env.DB.prepare('INSERT INTO form_oauth_states (state_hash,nonce_hash,verifier,link_user_id,expires_at) VALUES (?,?,?,?,?)').bind(await hash(state),await hash(nonce),verifier,user?.id||null,Date.now()+600000).run();
      const target=new URL('https://accounts.google.com/o/oauth2/v2/auth');
      target.search=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID!,redirect_uri:callback,response_type:'code',scope:'openid email profile',state,nonce,code_challenge:await hash(verifier),code_challenge_method:'S256',prompt:'select_account'}).toString();
      return redirect(target.href,[setCookie(STATE,state,600)]);
    }
    const fail=(reason:string)=>redirect('/?auth_error='+reason,[setCookie(STATE,'',0)]);
    const state=url.searchParams.get('state'),browserState=cookie(request,STATE);
    if(!state||!tokenPattern.test(state)||state!==browserState)return fail('invalid_state');
    // Consume once, atomically. Failed callbacks cannot be replayed.
    const attempt=await env.DB.prepare('DELETE FROM form_oauth_states WHERE state_hash=? AND expires_at>? RETURNING nonce_hash,verifier,link_user_id').bind(await hash(state),Date.now()).first();
    if(!attempt)return fail('expired');
    if(url.searchParams.has('error'))return fail('cancelled');
    const code=url.searchParams.get('code');if(!code||code.length>4096)return fail('invalid_response');
    if(attempt.link_user_id&&(await identity(request,env))?.id!==attempt.link_user_id)return fail('account_changed');
    try{
      const response=await exchange('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID!,client_secret:env.GOOGLE_CLIENT_SECRET!,code,code_verifier:attempt.verifier,grant_type:'authorization_code',redirect_uri:callback}),signal:AbortSignal.timeout(10000)});
      if(!response.ok)return fail('provider_unavailable');
      const data=await response.json() as {id_token?:string};
      if(!data.id_token||data.id_token.length>20000)return fail('invalid_response');
      const google=await verify(data.id_token,env.GOOGLE_CLIENT_ID!,attempt.nonce_hash);
      const generated='google:'+google.sub,wanted=attempt.link_user_id||generated;
      let linked=await env.DB.prepare('SELECT user_id FROM form_google_identities WHERE google_sub=?').bind(google.sub).first();
      if(attempt.link_user_id){
        const current=await env.DB.prepare('SELECT google_sub FROM form_google_identities WHERE user_id=?').bind(wanted).first();
        if(current&&current.google_sub!==google.sub)return fail('account_has_google');
        if(linked&&linked.user_id!==wanted){
          const account=linked.user_id===generated?await env.DB.prepare("SELECT 1 AS active FROM form_accounts WHERE user_id=? AND document!='null'").bind(generated).first():null;
          if(linked.user_id!==generated||account)return fail('already_linked');
          const claimed=await env.DB.prepare('UPDATE form_google_identities SET user_id=? WHERE google_sub=? AND user_id=? AND NOT EXISTS (SELECT 1 FROM form_google_identities WHERE user_id=?) RETURNING user_id').bind(wanted,google.sub,generated,wanted).first();
          if(!claimed)return fail('account_has_google');
          await env.DB.prepare('DELETE FROM form_sessions WHERE user_id=?').bind(generated).run();
          linked=claimed;
        }else if(!linked){
          await env.DB.prepare('INSERT INTO form_google_identities (google_sub,user_id,email,name) VALUES (?,?,?,?) ON CONFLICT DO NOTHING').bind(google.sub,wanted,google.email,google.name).run();
          linked=await env.DB.prepare('SELECT user_id FROM form_google_identities WHERE google_sub=?').bind(google.sub).first();
        }
      }else if(!linked){
        await env.DB.prepare('INSERT INTO form_google_identities (google_sub,user_id,email,name) VALUES (?,?,?,?) ON CONFLICT DO NOTHING').bind(google.sub,wanted,google.email,google.name).run();
        linked=await env.DB.prepare('SELECT user_id FROM form_google_identities WHERE google_sub=?').bind(google.sub).first();
      }
      if(!linked||linked.user_id!==wanted)return fail('already_linked');
      await env.DB.prepare('UPDATE form_google_identities SET email=?,name=? WHERE google_sub=?').bind(google.email,google.name,google.sub).run();
      // Rotation: an existing session is revoked before issuing a fresh token.
      const previous=cookie(request,SESSION);if(previous&&tokenPattern.test(previous))await env.DB.prepare('DELETE FROM form_sessions WHERE token_hash=?').bind(await hash(previous)).run();
      const session=random();await env.DB.prepare('INSERT INTO form_sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await hash(session),linked.user_id,Date.now()+SESSION_SECONDS*1000).run();
      return redirect('/?auth_success=google',[setCookie(STATE,'',0),setCookie(SESSION,session,SESSION_SECONDS)]);
    }catch{return fail('verification_failed')}
  };
}
