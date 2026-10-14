import type {Env} from './contracts';
import {json} from './contracts';
import {hash} from './google-auth';

export async function rateLimit(env:Env,subject:string,limit:number,windowSeconds=60){
  const now=Date.now(),window=Math.floor(now/(windowSeconds*1000));
  const bucket=await hash(subject+':'+window);
  // Fixed windows and an atomic increment work across concurrent Worker instances.
  const row=await env.DB.prepare('INSERT INTO form_rate_limits (bucket,hits,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits=hits+1 RETURNING hits').bind(bucket,(window+1)*windowSeconds*1000).first();
  if(row.hits===1)await env.DB.prepare('DELETE FROM form_rate_limits WHERE expires_at<?').bind(now).run();
  return row.hits>limit?json({error:'Too many requests. Please wait a minute and retry.'},429,{'Retry-After':String(windowSeconds)}):null;
}
