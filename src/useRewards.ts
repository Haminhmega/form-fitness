import {useCallback,useEffect,useRef,useState} from 'react';
import type {RewardItem,RewardSnapshot} from '../shared/rewards';

type RewardAccount={
  user:{id:string}|null;
  document:unknown;
  revision:number;
  dirty:boolean;
  requiresSignIn:boolean;
  status:string;
  conflict:unknown;
};
type Purchase={item:RewardItem;requestId:string};
type StoredState={owner:string|null;snapshot:RewardSnapshot|null;loading:boolean;error:string;notice:string;purchase:Purchase|null;requiresSignIn:boolean};
export type RewardsController={
  snapshot:RewardSnapshot|null;
  status:'guest'|'loading'|'ready'|'pending'|'offline'|'error';
  message:string;
  notice:string;
  busy:boolean;
  canPurchase:boolean;
  pendingPurchase:RewardItem|null;
  requiresSignIn:boolean;
  needsProfile:boolean;
  refresh:()=>void;
  purchase:(item:RewardItem)=>Promise<void>;
};

const purchaseKey=(owner:string)=>`form-user:${owner}:reward-purchase-v1`;
function readPurchase(owner:string):Purchase|null{
  try{
    const value=JSON.parse(localStorage.getItem(purchaseKey(owner))||'null');
    return value&&['freeze','boost'].includes(value.item)&&typeof value.requestId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.requestId)?value:null;
  }catch{return null}
}
function rememberPurchase(owner:string,value:Purchase|null){
  try{if(value)localStorage.setItem(purchaseKey(owner),JSON.stringify(value));else localStorage.removeItem(purchaseKey(owner))}catch{/* The active page still retains the request identifier. */}
}
function browserTimeZone(){try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'}catch{return 'UTC'}}

export function useRewards(account:RewardAccount):RewardsController{
  const owner=account.user?.id||null;
  const [state,setState]=useState<StoredState>({owner:null,snapshot:null,loading:false,error:'',notice:'',purchase:null,requiresSignIn:false});
  const [online,setOnline]=useState(()=>navigator.onLine);
  const [refreshIndex,setRefreshIndex]=useState(0);
  const current=useRef(account);current.current=account;
  const currentState=useRef(state);currentState.current=state;
  const generation=useRef(0);
  const running=useRef<AbortController|null>(null);
  const queued=useRef(false);
  const pending=useRef<Purchase|null>(null);
  const update=useCallback((change:Partial<StoredState>)=>{
    const next={...currentState.current,...change};currentState.current=next;setState(next);
  },[]);
  const canSync=useCallback(()=>{
    const value=current.current;
    return Boolean(value.user&&value.document&&!value.dirty&&!value.requiresSignIn&&!value.conflict&&value.status==='ready'&&navigator.onLine);
  },[]);

  const run=useCallback(async(purchase?:Purchase)=>{
    if(!canSync())return;
    if(running.current){if(!purchase)queued.current=true;return}
    const accountId=current.current.user!.id;
    const epoch=generation.current;
    const controller=new AbortController();running.current=controller;
    const timeout=setTimeout(()=>controller.abort(),15000);
    update({loading:true,error:'',notice:''});
    const live=()=>generation.current===epoch&&current.current.user?.id===accountId;
    try{
      const response=await fetch('/api/rewards',{
        method:'POST',credentials:'same-origin',cache:'no-store',
        headers:{'Content-Type':'application/json','X-Form-Client':'1','X-Form-Account':accountId},
        body:JSON.stringify(purchase?{action:'purchase',...purchase}:{action:'sync',timeZone:browserTimeZone()}),
        signal:controller.signal,
      });
      const data=await response.json().catch(()=>({error:'Rewards could not be reached. Please retry.'}));
      if(!live())return;
      if(!response.ok||!response.headers.get('content-type')?.includes('application/json')){
        // Definitive validation failures cannot have completed a purchase.
        if(purchase&&([400,422].includes(response.status)||['INVENTORY_FULL','BOOST_ACTIVE','INSUFFICIENT_CREDITS','REQUEST_REUSED'].includes(data.code))){
          pending.current=null;rememberPurchase(accountId,null);update({purchase:null});
        }
        if(response.status===401||response.status===403)update({requiresSignIn:true});
        throw Error(data.error||'Rewards could not be updated. Please retry.');
      }
      const snapshot=data.rewards as RewardSnapshot|null;
      if(!snapshot||snapshot.version!==1||!Number.isFinite(snapshot.balance)||!snapshot.currentWeek)throw Error('Rewards could not be read. Please retry.');
      if(purchase){pending.current=null;rememberPurchase(accountId,null)}
      update({owner:accountId,snapshot,error:'',requiresSignIn:false,purchase:pending.current,notice:purchase?(purchase.item==='freeze'?'Streak freeze added. It will protect one missed week automatically.':'Point boost ready for your next earning day.'):''});
    }catch(error){
      if(live())update({error:purchase&&pending.current?'Your purchase is not confirmed. Retry it below; the same request will not charge twice.':error instanceof Error&&error.name!=='AbortError'?error.message:'Rewards did not respond. Please retry.',purchase:pending.current});
    }finally{
      clearTimeout(timeout);
      if(live()){
        running.current=null;update({loading:false});
        if(queued.current){queued.current=false;setRefreshIndex(value=>value+1)}
      }
    }
  },[canSync,update]);

  useEffect(()=>{
    generation.current++;running.current?.abort();running.current=null;queued.current=false;
    pending.current=owner?readPurchase(owner):null;
    update({owner,snapshot:null,loading:false,error:'',notice:'',purchase:pending.current,requiresSignIn:false});
    return()=>{generation.current++;running.current?.abort();running.current=null};
  },[owner,update]);
  useEffect(()=>{
    if(canSync())void run();
  },[owner,account.revision,account.dirty,account.requiresSignIn,account.status,account.conflict,!!account.document,online,refreshIndex,canSync,run]);
  useEffect(()=>{
    const reconnect=()=>{setOnline(navigator.onLine);if(navigator.onLine)setRefreshIndex(value=>value+1)};
    const visible=()=>{if(document.visibilityState==='visible')setRefreshIndex(value=>value+1)};
    window.addEventListener('online',reconnect);window.addEventListener('offline',reconnect);document.addEventListener('visibilitychange',visible);
    return()=>{window.removeEventListener('online',reconnect);window.removeEventListener('offline',reconnect);document.removeEventListener('visibilitychange',visible)};
  },[]);
  const purchase=useCallback(async(item:RewardItem)=>{
    if(!canSync()||running.current)return;
    const accountId=current.current.user!.id;
    if(pending.current&&pending.current.item!==item){update({error:'Retry your unconfirmed purchase before choosing another potion.'});return}
    const request=pending.current||{item,requestId:crypto.randomUUID()};
    pending.current=request;rememberPurchase(accountId,request);update({purchase:request});
    await run(request);
  },[canSync,run,update]);

  const owned=state.owner===owner;
  const snapshot=owned?state.snapshot:null;
  const requiresSignIn=account.requiresSignIn||(owned&&state.requiresSignIn);
  const status:RewardsController['status']=!owner||!account.document?'guest':!online?'offline':account.requiresSignIn||account.conflict||account.status==='error'?'error':account.dirty||account.status==='saving'||account.status==='offline'?'pending':owned&&state.error?'error':!snapshot?'loading':'ready';
  const message=status==='guest'?'Sign in to earn points and keep your credits across devices.':!online?snapshot?'Your last synced points are shown. New workouts will count after they sync.':'Reconnect to see your rewards. New workouts will count after they sync.':requiresSignIn?state.purchase?'Sign in to the same account to confirm your purchase. Your request is saved.':'Sign in to the same account to update your rewards.':account.conflict?'Resolve the account sync conflict in Profile before updating rewards.':account.dirty||account.status==='saving'||account.status==='offline'?'Waiting for your workout and preferences to sync.':owned&&state.error?state.error:account.status==='error'?'Check your account connection in Profile to update rewards.':status==='loading'?'Opening your rewards…':'';
  return {snapshot,status,message,notice:owned?state.notice:'',busy:owned&&state.loading,canPurchase:canSync()&&!!snapshot&&!state.loading&&!state.error&&!requiresSignIn,pendingPurchase:owned?state.purchase?.item||null:null,requiresSignIn,needsProfile:!!owner&&!account.document,refresh:()=>setRefreshIndex(value=>value+1),purchase};
}
