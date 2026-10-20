import {useEffect,useRef,useState} from 'react';
import {ArrowRight,Check,ChevronDown,Coins,Flame,FlaskConical,Gift,Info,Minus,RefreshCw,Snowflake,Sparkles,Target,TrendingDown,TrendingUp,Zap} from 'lucide-react';
import {REWARD_RULES,rewardDate,rewardMonthComparison,type RewardItem} from '../shared/rewards';
import type {RewardsController} from './useRewards';
import './rewards.css';

const count=(value:number)=>value.toLocaleString(undefined,{maximumFractionDigits:0});
const monthLabel=(month:string)=>new Date(`${month}-15T12:00:00`).toLocaleDateString(undefined,{month:'long',year:'numeric'});
const shortDate=(day:string)=>new Date(`${day}T12:00:00`).toLocaleDateString(undefined,{month:'short',day:'numeric'});
function trackedMonths(firstMonth:string,lastMonth:string){
  const months:string[]=[];
  const cursor=new Date(`${lastMonth}-01T12:00:00Z`);
  while(cursor.toISOString().slice(0,7)>=firstMonth&&months.length<1200){months.push(cursor.toISOString().slice(0,7));cursor.setUTCMonth(cursor.getUTCMonth()-1)}
  return months;
}

function RewardsStatus({rewards}:{rewards:RewardsController}){
  const {message,notice,busy,status,pendingPurchase,requiresSignIn}=rewards;
  if(!message&&!notice&&!pendingPurchase)return null;
  return <div className={`rewards-status${status==='error'?' rewards-status-error':''}`} role="status" aria-live="polite">
    <p>{message||notice||'A purchase is awaiting confirmation.'}</p>
    {requiresSignIn?<a className="btn secondary" href="/?auth=login">Sign in again<ArrowRight size={15} aria-hidden="true"/></a>:pendingPurchase&&!busy?<button className="btn secondary" disabled={status==='offline'||status==='pending'} onClick={()=>void rewards.purchase(pendingPurchase)}>Retry {pendingPurchase==='freeze'?'freeze':'boost'} purchase<RefreshCw size={15} aria-hidden="true"/></button>:status==='error'&&!busy?<button className="btn secondary" onClick={rewards.refresh}>Retry rewards<RefreshCw size={15} aria-hidden="true"/></button>:null}
  </div>;
}

export function RewardsSummary({rewards,onOpen,onSignIn}:{rewards:RewardsController;onOpen:()=>void;onSignIn:()=>void}){
  const snapshot=rewards.snapshot;
  if(rewards.status==='guest')return <section className="rewards-summary rewards-summary-guest panel" aria-label="Training rewards"><span className="rewards-summary-icon"><Gift size={23} aria-hidden="true"/></span><div><h2>Make your consistency count.</h2><p>Earn points and credits toward your weekly goal.</p></div><button className="btn secondary" onClick={onSignIn}>{rewards.needsProfile?'Finish profile':'Sign in'}<ArrowRight size={16} aria-hidden="true"/></button></section>;
  if(!snapshot)return <section className="rewards-summary panel" aria-label="Training rewards"><span className="rewards-summary-icon"><Target size={23} aria-hidden="true"/></span><div><h2>Your training rewards</h2><p>{rewards.message}</p></div><button className="btn ghost" onClick={onOpen}>View rewards<ArrowRight size={16} aria-hidden="true"/></button></section>;
  const week=snapshot.currentWeek;
  return <button className="rewards-summary panel rewards-summary-button" onClick={onOpen} aria-label={`${week.basePoints} of ${REWARD_RULES.weeklyPoints} weekly goal points, ${snapshot.balance} credits. View rewards and shop.`}><span className="rewards-summary-icon"><Sparkles size={23} aria-hidden="true"/></span><span className="rewards-summary-copy"><strong>{count(week.basePoints)} <span>/ {REWARD_RULES.weeklyPoints} weekly points</span></strong><span>{week.days} of {week.goal} earning days · {snapshot.balance} credits{rewards.status!=='ready'?' · last synced':''}</span><span className="rewards-summary-track" aria-hidden="true"><span style={{width:`${week.basePoints}%`}}/></span></span><ArrowRight size={20} aria-hidden="true"/></button>;
}

export function RewardsPanel({rewards,onSignIn,onTrain}:{rewards:RewardsController;onSignIn:()=>void;onTrain:()=>void}){
  const snapshot=rewards.snapshot;
  const [selectedMonth,setSelectedMonth]=useState('');
  const [confirmItem,setConfirmItem]=useState<RewardItem|null>(null);
  const buyButtons=useRef<Partial<Record<RewardItem,HTMLButtonElement|null>>>({});
  const confirmButtons=useRef<Partial<Record<RewardItem,HTMLButtonElement|null>>>({});
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{if(confirmItem)confirmButtons.current[confirmItem]?.focus()},[confirmItem]);
  if(rewards.status==='guest')return <section className="rewards-panel panel rewards-welcome" aria-labelledby="rewards-title"><span className="rewards-feature-icon"><Gift size={28} aria-hidden="true"/></span><div><p className="eyebrow">A LITTLE CONSISTENCY. A LITTLE EXTRA.</p><h2 id="rewards-title">Your effort, rewarded.</h2><p>Earn points toward your weekly goal, compare your months, and collect credits for the potion shop.</p><p className="rewards-fine-print">{rewards.needsProfile?'Finish your profile to start earning.':'Rewards begin after you sign in.'} Sample workouts do not earn points.</p></div><button className="btn primary" onClick={onSignIn}>{rewards.needsProfile?'Finish profile to earn rewards':'Sign in to earn rewards'}<ArrowRight size={17} aria-hidden="true"/></button></section>;
  if(!snapshot)return <section className="rewards-panel panel" aria-labelledby="rewards-title" aria-busy={rewards.busy}><div className="rewards-heading"><div><p className="eyebrow">CONSISTENCY HAS ITS PERKS</p><h2 id="rewards-title">Your rewards</h2></div><Sparkles size={24} aria-hidden="true"/></div><RewardsStatus rewards={rewards}/></section>;
  const thisMonth=snapshot.today.slice(0,7);
  const enrollmentDate=rewardDate(new Date(snapshot.enrolledAt),snapshot.timeZone);
  const monthOptions=trackedMonths(enrollmentDate.slice(0,7),thisMonth);
  const month=monthOptions.includes(selectedMonth)?selectedMonth:thisMonth;
  const comparison=rewardMonthComparison(snapshot,month);
  const monthData=snapshot.months.find(item=>item.month===month);
  const week=snapshot.currentWeek;
  const current=month===thisMonth;
  const max=Math.max(comparison.currentPoints,comparison.previousPoints,1);
  const fullPrevious=monthLabel(comparison.previousMonth);
  const delta=comparison.delta;
  const ComparisonIcon=!comparison.previousPeriodComplete?Info:delta<0?TrendingDown:delta>0?TrendingUp:Minus;
  const canRetry=!!rewards.pendingPurchase;
  const purchase=async(item:RewardItem)=>{setConfirmItem(null);await rewards.purchase(item);heading.current?.focus()};
  const cancelPurchase=(item:RewardItem)=>{setConfirmItem(null);requestAnimationFrame(()=>{const button=buyButtons.current[item];if(button&&!button.disabled)button.focus();else heading.current?.focus()})};
  const shop=[
    {id:'freeze' as const,name:'Streak freeze',price:REWARD_RULES.freezeCost,icon:Snowflake,description:'Protect one missed weekly goal automatically.',detail:'Your streak stays in place. No points or workout days are added.',owned:`${snapshot.inventory.freezes} of ${REWARD_RULES.maxFreezes} stored`,full:snapshot.inventory.freezes>=REWARD_RULES.maxFreezes,fullLabel:'Inventory full'},
    {id:'boost' as const,name:'Point boost',price:REWARD_RULES.boostCost,icon:Zap,description:'+50% bonus points on your next earning day.',detail:'One use; bonus rounds down to whole points. Your goal score and earned credits stay the same.',owned:snapshot.inventory.boostActive?'Ready for your next earning day':'One boost can be ready at a time',full:snapshot.inventory.boostActive,fullLabel:'Boost ready'},
  ];
  return <section className="rewards-panel panel" aria-labelledby="rewards-title" aria-busy={rewards.busy}>
    <div className="rewards-heading"><div><p className="eyebrow">CONSISTENCY HAS ITS PERKS</p><h2 id="rewards-title" ref={heading} tabIndex={-1}>Your effort, rewarded.</h2></div><span className="rewards-wallet" aria-label={`${snapshot.balance} credits available`}><Coins size={19} aria-hidden="true"/><strong>{count(snapshot.balance)}</strong><span>credits</span></span></div>
    <RewardsStatus rewards={rewards}/>
    <div className="rewards-overview">
      <div className="rewards-week"><div className="rewards-row"><h3>This week’s goal</h3><span>{shortDate(week.key)} onward</span></div><p className="rewards-points"><strong>{count(week.basePoints)}</strong><span>/ {REWARD_RULES.weeklyPoints} points</span></p><progress max={REWARD_RULES.weeklyPoints} value={week.basePoints} aria-label="Weekly goal points"/><div className="rewards-row rewards-week-bottom"><span>{week.days} / {week.goal} earning days</span>{week.basePoints===REWARD_RULES.weeklyPoints?<strong className="rewards-met"><Check size={16} aria-hidden="true"/>Goal met</strong>:<span>{week.goal===5?'20':`About ${Math.round(REWARD_RULES.weeklyPoints/week.goal)}`} points per day</span>}</div>{snapshot.nextGoal&&<p className="rewards-fine-print">Your {snapshot.nextGoal.goal}-day goal starts {shortDate(snapshot.nextGoal.effectiveWeek)}. This week stays at {week.goal} days.</p>}</div>
      <div className="rewards-streak"><span className="rewards-feature-icon"><Flame size={26} aria-hidden="true"/></span><div><p className="rewards-streak-number">{snapshot.streak.weeks}<span>week streak{snapshot.streak.pendingWeek?' · pending':''}</span></p><p>{snapshot.streak.pendingWeek?'Pending last week’s sync':'Meet your weekly goal. Keep your rest days.'}</p></div>{snapshot.streak.lastWeekStatus==='protected'&&<span className="rewards-inventory-note"><Snowflake size={14} aria-hidden="true"/>A freeze protected your last week.</span>}{snapshot.streak.pendingWeek&&<p className="rewards-fine-print">Last week is waiting for offline workouts to sync. We allow {REWARD_RULES.syncGraceDays} days before settling a missed week.</p>}</div>
    </div>
    <section className="rewards-month" aria-labelledby="rewards-month-title">
      <div className="rewards-month-heading"><div><h3 id="rewards-month-title">Your month in points</h3><p>{current?`Through ${shortDate(snapshot.today)}`:'Completed month'} · goal points + bonus points</p></div><label className="rewards-month-select"><span className="sr-only">Rewards month</span><select aria-label="Rewards month" value={month} onChange={event=>setSelectedMonth(event.target.value)}>{monthOptions.map(value=><option key={value} value={value}>{monthLabel(value)}</option>)}</select></label></div>
      <div className="rewards-month-grid"><div className="rewards-month-score"><strong>{count(comparison.currentPoints)}<span>points</span></strong><p>{count(comparison.currentBasePoints)} goal points <span>+</span> {count(comparison.currentPoints-comparison.currentBasePoints)} bonus</p><div className={`rewards-comparison${delta>0&&comparison.previousPeriodComplete?' rewards-comparison-up':''}`}><ComparisonIcon size={16} aria-hidden="true"/><span>{!comparison.previousPeriodComplete?comparison.previousMonth<enrollmentDate.slice(0,7)?'No earlier rewards history yet':`Partial history since ${shortDate(enrollmentDate)}; compare a full month next time.`:<>{delta===0?'Level with':`${delta>0?'+':'−'}${count(Math.abs(delta))} points ${delta>0?'ahead of':'behind'}`} {current?'the same period last month':'last month'}</>}</span></div></div><div className="rewards-month-chart"><div className="rewards-chart-row"><span>{monthLabel(month)}{current?` · days 1–${comparison.elapsedDays}`:''}</span><strong>{count(comparison.currentPoints)}</strong><span className="rewards-chart-track"><span style={{width:`${comparison.currentPoints/max*100}%`}}/></span></div><div className="rewards-chart-row rewards-chart-previous"><span>{fullPrevious}{current?` · matching days`:''}{!comparison.previousPeriodComplete?' · incomplete history':''}</span><strong>{comparison.previousMonth<enrollmentDate.slice(0,7)?'—':count(comparison.previousPoints)}</strong><span className="rewards-chart-track"><span style={{width:`${comparison.previousPoints/max*100}%`}}/></span></div><p className="rewards-fine-print">{comparison.previousPeriodComplete?<>{fullPrevious} full month: {count(comparison.previousFullPoints)} points. Goal points in the comparison: {count(comparison.currentBasePoints)} vs {count(comparison.previousBasePoints)}.</>:<>Rewards tracking began {shortDate(enrollmentDate)}. Earlier activity is not included.</>}</p></div></div>
      <p className="rewards-month-detail">{monthData?.days||0} earning days · {monthData?.creditsEarned||0} credits earned this month{!comparison.currentPeriodComplete?` · tracking since ${shortDate(enrollmentDate)}`:''}</p>
      {comparison.currentPoints===0&&<div className="rewards-empty"><p>{current?'Your next synced workout can start this month’s score.':'No points were earned in this month.'}</p>{current&&<button className="btn secondary" onClick={onTrain}>Choose a workout<ArrowRight size={16} aria-hidden="true"/></button>}</div>}
    </section>
    <section className="rewards-shop" aria-labelledby="rewards-shop-title"><div className="rewards-shop-heading"><div><p className="eyebrow">SPEND CREDITS. KEEP YOUR POINTS.</p><h3 id="rewards-shop-title">The potion shop</h3></div><FlaskConical size={25} aria-hidden="true"/></div><div className="rewards-products">{shop.map(item=>{
      const enough=snapshot.balance>=item.price;
      const disabled=!rewards.canPurchase||item.full||!enough||canRetry;
      const confirming=confirmItem===item.id;
      return <article className={`rewards-product rewards-product-${item.id}`} key={item.id}><span className="rewards-potion" aria-hidden="true"><FlaskConical size={44} strokeWidth={1.4}/><item.icon className="rewards-potion-symbol" size={15}/></span><div className="rewards-product-copy"><h4>{item.name}</h4><p>{item.description}</p><span>{item.detail}</span><p className="rewards-owned">{item.full&&<Check size={14} aria-hidden="true"/>}{item.owned}</p></div><div className="rewards-product-action"><strong><Coins size={15} aria-hidden="true"/>{item.price}<span>credits</span></strong>{confirming?<div className="rewards-buy-confirm" role="group" aria-label={`Confirm ${item.name.toLowerCase()} purchase`}><p>Use {item.price} credits?</p><button className="btn primary" ref={element=>{confirmButtons.current[item.id]=element}} disabled={disabled} onClick={()=>void purchase(item.id)}>Confirm {item.name.toLowerCase()}</button><button className="btn ghost" onClick={()=>cancelPurchase(item.id)}>Cancel</button></div>:<button className="btn secondary" ref={element=>{buyButtons.current[item.id]=element}} disabled={disabled} onClick={()=>setConfirmItem(item.id)}>{item.full?item.fullLabel:enough?`Get ${item.name.toLowerCase()}`:`${item.price-snapshot.balance} more credits`}</button>}</div></article>;
    })}</div><p className="rewards-earn"><Coins size={16} aria-hidden="true"/>Earn {REWARD_RULES.creditsPerDay} credits per qualifying day, up to your weekly goal. Ad rewards are not available yet.</p></section>
    <details className="rewards-rules"><summary>How your rewards work<ChevronDown size={16} aria-hidden="true"/></summary><ul><li>Earn on one workout per day, up to your weekly goal. Log at least one completed set with reps, or finish at least five minutes of recovery.</li><li>A full week earns {REWARD_RULES.weeklyPoints} goal points. For a five-day goal, that’s 20 points each day. Other goals divide the same total across their days.</li><li>Bonus points are listed separately. Credits are only for the shop; spending them never reduces your points.</li><li>Weeks start Monday in {snapshot.timeZone.replaceAll('_',' ')}. Goal changes take effect the following week. Planned rest days do not break a weekly streak.</li><li>A freeze protects one missed week without adding to your streak length. An incomplete first week does not use a freeze.</li><li>Rewards start from {shortDate(enrollmentDate)}; existing history and sample workouts do not count. Sync new workouts within {REWARD_RULES.syncGraceDays} days. Confirmed rewards stay recorded if you later edit or remove a workout.</li></ul></details>
  </section>;
}
