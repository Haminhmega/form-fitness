import {saveSchema} from '../shared/account';
import {json,sameOrigin,type Env} from './contracts';
import {identityResult,googleAuth,clearSessionCookie,authErrorRedirect,hasSessionCookie,hasPlatformSession} from './google-auth';
import {rateLimit} from './rate-limit';
import {passwordAuth} from './password-auth';
const handleAuth=googleAuth();
const handlePasswordAuth=passwordAuth();
async function readJson(request:Request){
  if(!request.body)throw Error('body');
  const reader=request.body.getReader();const chunks:Uint8Array[]=[];let length=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>2_000_000){await reader.cancel();throw Error('size')}chunks.push(value)}}finally{reader.releaseLock()}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  return JSON.parse(new TextDecoder().decode(bytes));
}
export default {async fetch(request:Request,env:Env):Promise<Response>{
  const url=new URL(request.url);
  try{
  if(url.pathname.startsWith('/auth/')||url.pathname.startsWith('/api/auth/')){
    const browserAuth=url.pathname==='/auth/google'||url.pathname==='/auth/google/callback';
    if(!env.DB)return browserAuth?authErrorRedirect('unavailable'):json({error:'Sign-in is temporarily unavailable.'},503);
    const passwordAuth=url.pathname==='/api/auth/login'||url.pathname==='/api/auth/register';
    if(browserAuth||passwordAuth||url.pathname==='/api/auth/signout'){
      const limited=await rateLimit(env,'auth-ip:'+(request.headers.get('CF-Connecting-IP')||'local'),30);
      if(limited)return browserAuth?authErrorRedirect('rate_limited'):limited;
    }
    return await handlePasswordAuth(request,env)||await handleAuth(request,env)||json({error:'Not found'},404);
  }
  if(!url.pathname.startsWith('/api/')){
    const asset=env.ASSETS?await env.ASSETS.fetch(request):new Response('Not found',{status:404});
    const response=new Response(asset.body,asset);response.headers.set('Referrer-Policy','no-referrer');response.headers.set('X-Content-Type-Options','nosniff');response.headers.set('Content-Security-Policy',"default-src 'self' blob: data:; script-src 'self' blob: 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob: data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");return response;
  }
  if(url.pathname!=='/api/account')return json({error:'Not found'},404);
  if(!env.DB)return json({error:'Account storage is temporarily unavailable. Please retry.'},503);
  const ipLimited=await rateLimit(env,'account-ip:'+(request.headers.get('CF-Connecting-IP')||'local'),180);if(ipLimited)return ipLimited;
  const authenticated=await identityResult(request,env),user=authenticated.user;
  if(!user)return json({error:'Sign in to access your Form account.'},401,hasSessionCookie(request)?{'Set-Cookie':clearSessionCookie()}:{ });
  if(!['GET','PUT','DELETE'].includes(request.method))return json({error:'Method not allowed'},405);
  if(request.method!=='GET'&&!sameOrigin(request))return json({error:'This request must come from Form.'},403);
  if(request.method!=='GET'&&request.headers.get('X-Form-Account')!==user.id)return json({error:'The signed-in account changed. Sign in to the original account before syncing.',code:'ACCOUNT_CHANGED'},403);
  const limited=await rateLimit(env,'account-user:'+user.id,120);if(limited)return limited;
    if(request.method==='GET'){
      const row=await env.DB.prepare('SELECT document,revision,updated_at FROM form_accounts WHERE user_id = ?').bind(user.id).first();
      return json({user,record:row&&row.document!=='null'?{document:JSON.parse(row.document),revision:row.revision,updatedAt:row.updated_at}:null},200,authenticated.clearSession?{'Set-Cookie':clearSessionCookie()}:{ });
    }
    if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Expected JSON'},415);
    let body;try{body=await readJson(request)}catch{return json({error:'The request is invalid or too large.'},400)}
    if(request.method==='DELETE'){
      if(body?.confirm!=='DELETE MY FORM ACCOUNT')return json({error:'Confirm account deletion.'},400);
      // Retain only the owner key/revision, with all profile data removed. A
      // stale offline device must not overwrite a subsequently recreated account.
      await env.DB.prepare("UPDATE form_accounts SET document = 'null', revision = revision + 1, updated_at = ? WHERE user_id = ?").bind(new Date().toISOString(),user.id).run();
      await env.DB.prepare('DELETE FROM form_sessions WHERE user_id=?').bind(user.id).run();
      await env.DB.prepare('DELETE FROM form_oauth_states WHERE link_user_id=?').bind(user.id).run();
      await env.DB.prepare('DELETE FROM form_google_identities WHERE user_id=?').bind(user.id).run();
      await env.DB.prepare('DELETE FROM form_password_identities WHERE user_id=?').bind(user.id).run();
      return json({deleted:true,hasPlatformSession:hasPlatformSession(request)},200,{'Set-Cookie':clearSessionCookie()});
    }
    const parsed=saveSchema.safeParse(body);
    if(!parsed.success)return json({error:'Check your details and try again.',fields:parsed.error.issues.map(i=>({path:i.path.join('.'),message:i.message})).slice(0,12)},400);
    const {revision,document}=parsed.data;
    // Sample history cannot become a real user's synced workout record.
    document.training.history=document.training.history.filter(item=>!item.sample);
    const updatedAt=new Date().toISOString();
    const saved=revision===0
      ?await env.DB.prepare("INSERT INTO form_accounts (user_id,document,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(user_id) DO UPDATE SET document=excluded.document,revision=form_accounts.revision+1,updated_at=excluded.updated_at WHERE form_accounts.document='null' RETURNING document,revision,updated_at").bind(user.id,JSON.stringify(document),updatedAt).first()
      :await env.DB.prepare("UPDATE form_accounts SET document = ?, revision = revision + 1, updated_at = ? WHERE user_id = ? AND revision = ? AND document != 'null' RETURNING document,revision,updated_at").bind(JSON.stringify(document),updatedAt,user.id,revision).first();
    if(!saved)return json({error:'Another device saved changes. Refresh before saving again.'},409);
    return json({record:{document:JSON.parse(saved.document),revision:saved.revision,updatedAt:saved.updated_at}});
  }catch{return json({error:'Your account could not be loaded or saved. Please retry.'},503)}
}};
