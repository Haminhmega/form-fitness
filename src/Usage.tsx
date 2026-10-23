import {useEffect,useState} from 'react';
import {X} from 'lucide-react';
import type {AccountUser} from '../shared/account';
type Consent={enabled:boolean;admin:boolean;dashboardAccess?:'available'|'verify-email'|'private'};
const changed='form-usage-preference';
async function usageRequest(path:string,user:AccountUser,body?:unknown){
  const r=await fetch('/api/usage/'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-Form-Client':'1','X-Form-Account':user.id},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  const data=await r.json();if(!r.ok)throw Error(data.error||'Usage settings are unavailable.');return data;
}
export function UsageTelemetry({user}:{user:AccountUser|null}){
  useEffect(()=>{
    if(!user)return;let enabled=false,disposed=false,hiddenAt=0,lastInteraction=Date.now(),opened=false;
    const send=(kind:'open'|'active')=>{if(enabled&&!disposed)void usageRequest('event',user,{id:crypto.randomUUID(),kind}).catch(()=>{})};
    const refresh=()=>{void usageRequest('consent',user).then((c:Consent)=>{if(disposed)return;enabled=c.enabled&&!c.admin;if(enabled&&!opened&&document.visibilityState==='visible'){opened=true;send('open')}}).catch(()=>{enabled=false})};
    const activity=()=>{lastInteraction=Date.now()};
    const visibility=()=>{if(document.visibilityState==='hidden')hiddenAt=Date.now();else{lastInteraction=Date.now();if(!opened||hiddenAt&&Date.now()-hiddenAt>=60000){opened=true;send('open')}}};
    const preference=(e:Event)=>{const detail=(e as CustomEvent).detail;if(detail?.userId===user.id){enabled=detail.enabled===true;if(enabled&&!opened){opened=true;send('open')}}};
    refresh();window.addEventListener(changed,preference);document.addEventListener('visibilitychange',visibility);window.addEventListener('pointerdown',activity);window.addEventListener('keydown',activity);window.addEventListener('scroll',activity,{passive:true});
    const timer=setInterval(()=>{if(document.visibilityState==='visible'&&Date.now()-lastInteraction<300000)send('active')},60000);
    return()=>{disposed=true;clearInterval(timer);window.removeEventListener(changed,preference);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pointerdown',activity);window.removeEventListener('keydown',activity);window.removeEventListener('scroll',activity)};
  },[user?.id]);return null;
}
type Report={generatedAt:string;windowStart:string;firstEvent:number|null;weekly:number;monthly:number;days:{day:string;users:number;opens:number;sessions:number}[];months:{month:string;users:number;returning:number}[]};
export function UsageSettings({user}:{user:AccountUser}){
  const [consent,setConsent]=useState<Consent|null>(null),[report,setReport]=useState<Report|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{let cancelled=false;usageRequest('consent',user).then(c=>{if(!cancelled)setConsent(c)}).catch(()=>{});return()=>{cancelled=true}},[user.id]);
  async function retryAccess(){setBusy(true);setError('');try{setConsent(await usageRequest('consent',user))}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  async function change(enabled:boolean){setBusy(true);setError('');try{const c=await usageRequest('consent',user,{enabled});setConsent(previous=>({...previous,...c}));window.dispatchEvent(new CustomEvent(changed,{detail:{userId:user.id,enabled:c.enabled&&!c.admin}}))}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  async function load(){setBusy(true);setError('');try{setReport(await usageRequest('report',user))}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  function download(){if(!report)return;const csv=['date_utc,participating_active_accounts,app_opens,usage_sessions',...report.days.map(d=>[d.day,d.users,d.opens,d.sessions].join(',')),'',`# Generated ${report.generatedAt}`,`# Rolling 90 days; participating signed-in accounts only; owner excluded; not all users.`,`# Session starts after 30 minutes without observed activity. Current day/month are incomplete.`,`# Collection changed to beta default-on on October 23, 2026; earlier periods are opt-in only.`].join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download='form-beta-usage.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  return <section className="account-usage"><h3>Help improve Form</h3><p className="settings-note">Basic usage reporting is on by default during the beta. An existing opt-out stays off. It records app opens and activity timestamps with Form. We use a pseudonymous account ID to understand repeat usage and prepare aggregate reports for potential investors. No videos, body stats, exercise choices or email addresses are included in these events. You can turn reporting off below. Events expire after 90 days; turning this off removes your stored events.</p><label className="account-consent"><input type="checkbox" checked={consent?.enabled||false} disabled={!consent||busy} onChange={e=>void change(e.target.checked)}/><span>Share basic usage activity</span></label>{!consent&&<p className="settings-note">Connect to the internet to manage this preference.</p>}
    {consent?.dashboardAccess==='verify-email'&&<details open><summary>Private usage dashboard</summary><p className="settings-note">Your owner email needs verification before this report can open. Older Form accounts may not have completed email confirmation. Use the email-code password reset to verify your address, then log in again.</p><a className="btn secondary" href="/?auth=login">Open sign-in to reset password</a><button className="btn secondary" disabled={busy} onClick={()=>void retryAccess()}>Check dashboard access</button></details>}
    {!consent&&<button className="btn secondary" disabled={busy} onClick={()=>void retryAccess()}>Retry usage settings</button>}
    {consent?.admin&&<details><summary>Private usage dashboard</summary><p className="settings-note">Only your verified owner account can open this report. Your activity is excluded.</p><button className="btn secondary" disabled={busy} onClick={()=>void load()}>{busy?'Loading…':'Refresh usage report'}</button>{report&&<><div className="account-stat-grid"><div><span>Active accounts · 7 days</span><strong>{report.weekly}</strong></div><div><span>Active accounts · 30 days</span><strong>{report.monthly}</strong></div></div><p className="settings-note">Participating signed-in accounts only, UTC dates, rolling 90-day retention. An open is an app load or return after at least one minute away. A usage session starts after 30 minutes without observed activity. This is not a count of all users or a measure of workout duration.</p><div className="usage-table-scroll"><table><caption>Monthly active accounts · retained data only</caption><thead><tr><th>Month</th><th>Active</th><th>Active on 2+ days</th></tr></thead><tbody>{report.months.map(m=><tr key={m.month}><td>{m.month}</td><td>{m.users}</td><td>{m.returning}</td></tr>)}</tbody></table><table><caption>Daily usage</caption><thead><tr><th>UTC date</th><th>Active</th><th>Opens</th><th>Sessions</th></tr></thead><tbody>{report.days.slice(-31).reverse().map(d=><tr key={d.day}><td>{d.day}</td><td>{d.users}</td><td>{d.opens}</td><td>{d.sessions}</td></tr>)}</tbody></table></div>{!report.days.length&&<p>No participating usage has been recorded yet.</p>}<p className="settings-note">Beta reporting now defaults on; earlier periods only include accounts that opted in. Compare equivalent collection periods. Current day/month and the earliest retained month may be incomplete. Opt-outs delete historical events, so totals can decrease. Figures are observed beta usage, not independently audited traction.</p><button className="btn secondary" onClick={download}>Download daily CSV</button></>}</details>}{error&&<p role="alert">{error}</p>}
  </section>;
}

// This notice is informational. Dismissing it never changes the reporting preference.
export function BetaUsageNotice({user,onManage}:{user:AccountUser;onManage:()=>void}){
  const key=`form-beta-usage-notice:${user.id}`;
  const [dismissed,setDismissed]=useState(()=>{try{return sessionStorage.getItem(key)==='seen'}catch{return false}});
  const [enabled,setEnabled]=useState(false);
  useEffect(()=>{
    let disposed=false,preferenceChanged=false;
    const preference=(e:Event)=>{const detail=(e as CustomEvent).detail;if(detail?.userId===user.id){preferenceChanged=true;setEnabled(detail.enabled===true)}};
    window.addEventListener(changed,preference);
    void usageRequest('consent',user).then((c:Consent)=>{if(!disposed&&!preferenceChanged)setEnabled(c.enabled&&!c.admin)}).catch(()=>{});
    return()=>{disposed=true;window.removeEventListener(changed,preference)};
  },[user.id]);
  if(dismissed||!enabled)return null;
  function dismiss(){setDismissed(true);try{sessionStorage.setItem(key,'seen')}catch{/* The notice can return if session storage is unavailable. */}}
  return <aside className="beta-usage-notice" aria-label="Beta usage reporting"><p><strong>Beta usage reporting is on.</strong> Form records app opens and activity timestamps for product improvements and aggregate investor reports. You can turn it off in Profile.</p><button className="btn secondary" onClick={onManage}>Manage</button><button className="icon-button" aria-label="Dismiss usage notice" onClick={dismiss}><X size={18}/></button></aside>;
}
