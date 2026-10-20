import {z} from 'zod';
import {documentSchema} from '../shared/account';
import {enrollRewards,isRewardTimeZone,purchaseReward,RewardPurchaseError,rewardLedgerSchema,rewardsSnapshot,syncRewards,type RewardLedger} from '../shared/rewards';
import {json,sameOrigin,type Env} from './contracts';
import {clearSessionCookie,hasSessionCookie,identityResult} from './google-auth';
import {rateLimit} from './rate-limit';

const actionSchema=z.discriminatedUnion('action',[
  z.object({action:z.literal('sync'),timeZone:z.string().max(100).refine(isRewardTimeZone)}).strict(),
  z.object({action:z.literal('purchase'),item:z.enum(['freeze','boost']),requestId:z.string().uuid()}).strict(),
]);
async function smallBody(request:Request):Promise<unknown>{
  if(!request.body)throw Error('body');
  const reader=request.body.getReader(),decoder=new TextDecoder();let text='',size=0;
  try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>1024){await reader.cancel();throw Error('size')}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}
  finally{reader.releaseLock();}
  return JSON.parse(text);
}
export async function reconcileSavedRewards(env:Env,userId:string,now=new Date()):Promise<void>{
  for(let attempt=0;attempt<6;attempt++){
    const row=await env.DB.prepare('SELECT document,revision FROM form_rewards WHERE user_id=?').bind(userId).first();
    if(!row)return;
    const account=await env.DB.prepare("SELECT document,revision FROM form_accounts WHERE user_id=? AND document!='null'").bind(userId).first();
    if(!account)return;
    const ledger=syncRewards(rewardLedgerSchema.parse(JSON.parse(row.document)),documentSchema.parse(JSON.parse(account.document)),now);
    const serialized=JSON.stringify(ledger);if(serialized===row.document)return;
    const saved=await env.DB.prepare("UPDATE form_rewards SET document=?,revision=revision+1,updated_at=? WHERE user_id=? AND revision=? AND EXISTS (SELECT 1 FROM form_accounts WHERE user_id=? AND revision=? AND document!='null') RETURNING revision")
      .bind(serialized,now.toISOString(),userId,row.revision,userId,account.revision).first();
    if(saved)return;
  }
  throw Error('Rewards reconciliation conflict');
}
export async function handleRewards(request:Request,env:Env,now=new Date()):Promise<Response>{
  if(!env.DB)return json({error:'Rewards are temporarily unavailable.'},503);
  const ipLimited=await rateLimit(env,'rewards-ip:'+(request.headers.get('CF-Connecting-IP')||'local'),180);if(ipLimited)return ipLimited;
  const authenticated=await identityResult(request,env),user=authenticated.user;
  if(!user)return json({error:'Sign in to collect credits and use the shop.'},401,hasSessionCookie(request)?{'Set-Cookie':clearSessionCookie()}:{});
  if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed'},405);
  if(request.method==='POST'&&!sameOrigin(request))return json({error:'This request must come from Form.'},403);
  if(request.headers.get('X-Form-Account')!==user.id)return json({error:'The signed-in account changed. Sign in to the original account.',code:'ACCOUNT_CHANGED'},403);
  const limited=await rateLimit(env,'rewards-user:'+user.id,120);if(limited)return limited;
  const headers:HeadersInit=authenticated.clearSession?{'Set-Cookie':clearSessionCookie()}:{};
  if(request.method==='GET'){
    const account=await env.DB.prepare("SELECT revision FROM form_accounts WHERE user_id=? AND document!='null'").bind(user.id).first();
    if(!account)return json({error:'Finish setting up your profile to start earning rewards.',code:'PROFILE_REQUIRED'},409,headers);
    const row=await env.DB.prepare('SELECT document FROM form_rewards WHERE user_id=?').bind(user.id).first();
    const ledger=row?rewardLedgerSchema.parse(JSON.parse(row.document)):null;
    return json({rewards:ledger?rewardsSnapshot(ledger,now):null},200,headers);
  }
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Expected JSON'},415);
  let body:unknown;try{body=await smallBody(request);}catch{return json({error:'The rewards request is invalid or too large.'},400);}
  const parsed=actionSchema.safeParse(body);if(!parsed.success)return json({error:'Check the rewards request and try again.'},400);
  const action=parsed.data;
  for(let attempt=0;attempt<6;attempt++){
    const account=await env.DB.prepare("SELECT document,revision FROM form_accounts WHERE user_id=? AND document!='null'").bind(user.id).first();
    if(!account)return json({error:'Finish setting up your profile to start earning rewards.',code:'PROFILE_REQUIRED'},409,headers);
    const document=documentSchema.parse(JSON.parse(account.document));
    const row=await env.DB.prepare('SELECT document,revision FROM form_rewards WHERE user_id=?').bind(user.id).first();
    let ledger:RewardLedger;
    if(row){ledger=syncRewards(rewardLedgerSchema.parse(JSON.parse(row.document)),document,now);}
    else if(action.action==='sync'){ledger=enrollRewards(document,action.timeZone,now);}
    else return json({error:'Open your rewards first, then choose an item.',code:'ENROLL_REQUIRED'},409,headers);
    if(action.action==='purchase'){
      try{ledger=purchaseReward(ledger,action.item,action.requestId,now);}
      catch(error){if(error instanceof RewardPurchaseError)return json({error:error.message,code:error.code},409,headers);throw error;}
    }
    const serialized=JSON.stringify(ledger);
    // Check the account revision within the write, so deletion and concurrent
    // account edits cannot leave a reward wallet based on a stale document.
    const saved=row
      ?await env.DB.prepare("UPDATE form_rewards SET document=?,revision=revision+1,updated_at=? WHERE user_id=? AND revision=? AND EXISTS (SELECT 1 FROM form_accounts WHERE user_id=? AND revision=? AND document!='null') RETURNING revision")
        .bind(serialized,now.toISOString(),user.id,row.revision,user.id,account.revision).first()
      :await env.DB.prepare("INSERT INTO form_rewards (user_id,document,revision,updated_at) SELECT ?,?,1,? WHERE EXISTS (SELECT 1 FROM form_accounts WHERE user_id=? AND revision=? AND document!='null') ON CONFLICT(user_id) DO NOTHING RETURNING revision")
        .bind(user.id,serialized,now.toISOString(),user.id,account.revision).first();
    if(saved)return json({rewards:rewardsSnapshot(ledger,now)},200,headers);
  }
  return json({error:'Your rewards changed on another device. Retry to refresh them.',code:'REWARDS_CONFLICT'},409,headers);
}
