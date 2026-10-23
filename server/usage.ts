import {json,sameOrigin,type Env} from './contracts';
import {identity,hash} from './google-auth';
import {authBody} from './email-codes';
import {rateLimit} from './rate-limit';
import type {AccountUser} from '../shared/account';
export const usageSubject=(id:string)=>hash('form-usage-v1:'+id);
async function isAdmin(env:Env,user:AccountUser){
  if(!env.ANALYTICS_ADMIN_EMAIL||user.email.toLowerCase()!==env.ANALYTICS_ADMIN_EMAIL.toLowerCase())return false;
  if(user.provider!=='password')return true;
  return !!await env.DB.prepare('SELECT 1 AS verified FROM form_password_identities WHERE user_id=? AND email_verified_at IS NOT NULL').bind(user.id).first();
}
export async function usage(request:Request,env:Env):Promise<Response|null>{
  const path=new URL(request.url).pathname;if(!path.startsWith('/api/usage/'))return null;
  if(!env.DB)return json({error:'Usage settings are unavailable.'},503);
  const user=await identity(request,env);if(!user)return json({error:'Sign in first.'},401);
  const subject=await usageSubject(user.id),now=Date.now();
  if(path==='/api/usage/report'){
    if(request.method!=='GET')return json({error:'Method not allowed'},405);
    if(!await isAdmin(env,user))return json({error:'This report is private.'},403);
    const limited=await rateLimit(env,'usage-report:'+user.id,10);if(limited)return limited;
    const start=now-90*86400000;
    await env.DB.prepare('DELETE FROM form_usage_events WHERE at<?').bind(start).run();
    const rows=await env.DB.prepare(`WITH ordered AS (
      SELECT subject,kind,at,LAG(at) OVER(PARTITION BY subject ORDER BY at,id) AS previous FROM form_usage_events WHERE at>=?
    ), daily AS (
      SELECT strftime('%Y-%m-%d',at/1000,'unixepoch') AS day,COUNT(DISTINCT subject) AS users,
      SUM(CASE WHEN kind='open' THEN 1 ELSE 0 END) AS opens,
      SUM(CASE WHEN previous IS NULL OR at-previous>=1800000 THEN 1 ELSE 0 END) AS sessions
      FROM ordered GROUP BY day
    ) SELECT COALESCE(json_group_array(json_object('day',day,'users',users,'opens',opens,'sessions',sessions)),'[]') AS data FROM daily ORDER BY day`).bind(start).first();
    const months=await env.DB.prepare(`WITH days AS (SELECT DISTINCT subject,strftime('%Y-%m',at/1000,'unixepoch') AS month,strftime('%Y-%m-%d',at/1000,'unixepoch') AS day FROM form_usage_events WHERE at>=?), people AS (SELECT month,subject,COUNT(*) AS days FROM days GROUP BY month,subject), monthly AS (SELECT month,COUNT(*) AS users,SUM(CASE WHEN days>1 THEN 1 ELSE 0 END) AS repeat_users FROM people GROUP BY month) SELECT COALESCE(json_group_array(json_object('month',month,'users',users,'returning',repeat_users)),'[]') AS data FROM monthly`).bind(start).first();
    const counts=await env.DB.prepare('SELECT COUNT(DISTINCT CASE WHEN at>=? THEN subject END) AS weekly,COUNT(DISTINCT CASE WHEN at>=? THEN subject END) AS monthly,MIN(at) AS first_event FROM form_usage_events WHERE at>=?').bind(now-7*86400000,now-30*86400000,start).first();
    return json({generatedAt:new Date(now).toISOString(),windowStart:new Date(start).toISOString(),days:JSON.parse(rows.data).sort((a:{day:string},b:{day:string})=>a.day.localeCompare(b.day)),months:JSON.parse(months.data).sort((a:{month:string},b:{month:string})=>a.month.localeCompare(b.month)),weekly:counts.weekly,monthly:counts.monthly,firstEvent:counts.first_event});
  }
  if(path==='/api/usage/consent'&&request.method==='GET'){
    const row=await env.DB.prepare('SELECT enabled FROM form_analytics_consent WHERE user_id=?').bind(user.id).first();
    return json({enabled:row?.enabled===1,admin:await isAdmin(env,user)});
  }
  if(!['/api/usage/consent','/api/usage/event'].includes(path))return json({error:'Not found'},404);
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  if(!sameOrigin(request)||request.headers.get('X-Form-Account')!==user.id)return json({error:'Your account changed. Refresh and retry.'},403);
  const limited=await rateLimit(env,'usage:'+user.id,240,3600);if(limited)return limited;
  let body:any;try{body=await authBody(request)}catch{return json({error:'Invalid request.'},400)}
  if(path==='/api/usage/consent'){
    if(typeof body?.enabled!=='boolean'||Object.keys(body).length!==1)return json({error:'Choose a usage preference.'},400);
    await env.DB.prepare('INSERT INTO form_analytics_consent(user_id,enabled,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET enabled=excluded.enabled,updated_at=excluded.updated_at').bind(user.id,body.enabled?1:0,now).run();
    if(!body.enabled)await env.DB.prepare('DELETE FROM form_usage_events WHERE subject=?').bind(subject).run();
    return json({enabled:body.enabled,admin:await isAdmin(env,user)});
  }
  if(!body||Object.keys(body).some(k=>!['id','kind'].includes(k))||!['open','active'].includes(body.kind)||typeof body.id!=='string'||!/^[0-9a-f-]{36}$/i.test(body.id))return json({error:'Invalid event.'},400);
  // Only consented account activity enters this dataset; never accept client timestamps.
  if(user.email.toLowerCase()!==env.ANALYTICS_ADMIN_EMAIL?.toLowerCase()){
    await env.DB.prepare('INSERT INTO form_usage_events(id,subject,kind,at) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM form_analytics_consent WHERE user_id=? AND enabled=1) ON CONFLICT DO NOTHING').bind(await hash(subject+':'+body.id),subject,body.kind,now,user.id).run();
  }
  await env.DB.prepare('DELETE FROM form_usage_events WHERE at<?').bind(now-90*86400000).run();
  return json({accepted:true});
}
