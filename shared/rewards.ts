import {z} from 'zod';
import type {AccountDocument} from './account';

export const REWARD_RULES = {
  weeklyPoints: 100, creditsPerDay: 10, freezeCost: 60, boostCost: 30,
  maxFreezes: 2, boostMultiplier: 0.5, syncGraceDays: 7,
} as const;
export type RewardItem = 'freeze' | 'boost';
type WeekStatus = 'open' | 'met' | 'protected' | 'missed' | 'intro';
export type RewardAward = {sessionId:string;date:string;completedAt:string;basePoints:number;bonusPoints:number;credits:number};
type RewardWeek = {key:string;goal:number;status:WeekStatus};
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const whole = z.number().int().nonnegative();
export const rewardLedgerSchema = z.object({
  version:z.literal(1), enrolledAt:z.string().datetime(), timeZone:z.string().max(100),
  desiredGoal:z.number().int().min(1).max(7), balance:whole.max(10_000_000),
  freezes:whole.max(REWARD_RULES.maxFreezes), boost:z.object({purchasedAt:z.string().datetime()}).strict().nullable(),
  weeks:z.array(z.object({key:dateKey,goal:z.number().int().min(1).max(7),status:z.enum(['open','met','protected','missed','intro'])}).strict()).max(6000),
  awards:z.array(z.object({sessionId:z.string().min(1).max(120),date:dateKey,completedAt:z.string().datetime(),basePoints:whole.max(100),bonusPoints:whole.max(50),credits:z.literal(10)}).strict()).max(100_000),
  seenIds:z.array(z.string().min(1).max(120)).max(100_000),
  purchases:z.array(z.object({requestId:z.string().uuid(),item:z.enum(['freeze','boost'])}).strict()).max(100_000),
}).strict();
export type RewardLedger = z.infer<typeof rewardLedgerSchema>;
export type RewardMonth = {
  month:string;basePoints:number;bonusPoints:number;points:number;days:number;creditsEarned:number;
  daysBreakdown:{date:string;basePoints:number;bonusPoints:number}[];
};
export type RewardSnapshot = {
  version:1;enrolledAt:string;timeZone:string;today:string;balance:number;
  inventory:{freezes:number;boostActive:boolean};
  currentWeek:{key:string;goal:number;days:number;basePoints:number;bonusPoints:number;dates:string[]};
  nextGoal:{goal:number;effectiveWeek:string}|null;
  streak:{weeks:number;lastWeekStatus:'met'|'protected'|'missed'|null;pendingWeek:string|null};
  months:RewardMonth[];lifetime:{basePoints:number;bonusPoints:number;points:number;days:number};
  recentAwards:{date:string;basePoints:number;bonusPoints:number;credits:number}[];
};

export function isRewardTimeZone(value:string):boolean {
  try { new Intl.DateTimeFormat('en',{timeZone:value}).format(0);return value.length<=100; } catch { return false; }
}
export function rewardDate(now:Date,timeZone:string):string {
  const parts=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part=(type:string)=>parts.find(p=>p.type===type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function addRewardDays(date:string,days:number):string {
  const value=new Date(`${date}T12:00:00Z`);value.setUTCDate(value.getUTCDate()+days);return value.toISOString().slice(0,10);
}
export function rewardWeekKey(date:string):string {
  const weekday=new Date(`${date}T12:00:00Z`).getUTCDay();return addRewardDays(date,-((weekday+6)%7));
}
export function rewardGoal(days:string[]):number {
  const valid=days.filter(day=>['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].includes(day));
  return new Set(valid).size||3;
}
export function enrollRewards(document:AccountDocument,timeZone:string,now=new Date()):RewardLedger {
  if(!isRewardTimeZone(timeZone))throw Error('Choose a valid time zone.');
  const goal=rewardGoal(document.training.preferences.days);
  return {version:1,enrolledAt:now.toISOString(),timeZone,desiredGoal:goal,balance:0,freezes:0,boost:null,
    weeks:[{key:rewardWeekKey(rewardDate(now,timeZone)),goal,status:'open'}],awards:[],
    seenIds:[...new Set(document.training.history.map(entry=>entry.id))],purchases:[]};
}
function eligible(entry:AccountDocument['training']['history'][number]):boolean {
  if(entry.sample)return false;
  if(entry.kind==='recovery')return entry.duration>=5;
  return entry.exercises.some(exercise=>exercise.sets.some(set=>set.done&&set.reps>0));
}
function weekAwards(ledger:RewardLedger,week:RewardWeek):RewardAward[] {
  return ledger.awards.filter(award=>rewardWeekKey(award.date)===week.key);
}
function finalizedStreak(ledger:RewardLedger):number {
  let weeks=0;
  for(const week of ledger.weeks){if(week.status==='met')weeks++;else if(week.status==='missed')weeks=0;}
  return weeks;
}
export function syncRewards(previous:RewardLedger,document:AccountDocument,now=new Date()):RewardLedger {
  const ledger=structuredClone(previous),today=rewardDate(now,ledger.timeZone),currentKey=rewardWeekKey(today);
  if(currentKey<ledger.weeks[ledger.weeks.length-1].key)return ledger;
  const calendarWeeks=(Date.parse(`${currentKey}T12:00:00Z`)-Date.parse(`${ledger.weeks[0].key}T12:00:00Z`))/(7*24*60*60*1000);
  if(calendarWeeks>=6000)throw Error('Rewards history exceeds the supported calendar range.');
  for(let key=addRewardDays(ledger.weeks[ledger.weeks.length-1].key,7);key<=currentKey;key=addRewardDays(key,7)){
    ledger.weeks.push({key,goal:ledger.desiredGoal,status:'open'});
  }
  const seen=new Set(ledger.seenIds),awardedDates=new Set(ledger.awards.map(award=>award.date));
  const cutoff=addRewardDays(today,-REWARD_RULES.syncGraceDays);
  const history=[...document.training.history].sort((a,b)=>(a.completedAt||'').localeCompare(b.completedAt||'')||a.id.localeCompare(b.id));
  for(const entry of history){
    if(seen.has(entry.id))continue;
    // A saved history item is observed once, including an empty or sample item.
    seen.add(entry.id);
    const completed=entry.completedAt&&z.string().datetime({offset:true}).safeParse(entry.completedAt).success?new Date(entry.completedAt):null;
    if(!completed||!Number.isFinite(completed.getTime())||completed.getTime()>now.getTime()||completed.getTime()<Date.parse(ledger.enrolledAt))continue;
    const date=rewardDate(completed,ledger.timeZone);
    if(date<cutoff||date>today||awardedDates.has(date)||!eligible(entry))continue;
    const week=ledger.weeks.find(value=>value.key===rewardWeekKey(date));
    if(!week||week.status!=='open')continue;
    const count=weekAwards(ledger,week).length;
    if(count>=week.goal)continue;
    const basePoints=Math.floor(REWARD_RULES.weeklyPoints*(count+1)/week.goal)-Math.floor(REWARD_RULES.weeklyPoints*count/week.goal);
    const boosted=ledger.boost!==null&&completed.getTime()>=Date.parse(ledger.boost.purchasedAt);
    const bonusPoints=boosted?Math.floor(basePoints*REWARD_RULES.boostMultiplier):0;
    if(boosted)ledger.boost=null;
    ledger.awards.push({sessionId:entry.id,date,completedAt:completed.toISOString(),basePoints,bonusPoints,credits:REWARD_RULES.creditsPerDay});
    ledger.balance+=REWARD_RULES.creditsPerDay;awardedDates.add(date);
  }
  ledger.seenIds=[...seen];
  // The previous calendar week stays open for seven days of offline syncing.
  for(const week of ledger.weeks){
    if(week.status!=='open'||addRewardDays(week.key,14)>today)continue;
    if(weekAwards(ledger,week).length>=week.goal)week.status='met';
    else if(week===ledger.weeks[0]&&rewardDate(new Date(ledger.enrolledAt),ledger.timeZone)!==week.key)week.status='intro';
    else if(finalizedStreak(ledger)>0&&ledger.freezes>0){week.status='protected';ledger.freezes--;}
    else week.status='missed';
  }
  ledger.desiredGoal=rewardGoal(document.training.preferences.days);
  return rewardLedgerSchema.parse(ledger);
}
export class RewardPurchaseError extends Error {
  constructor(message:string,readonly code:string){super(message);}
}
export function purchaseReward(previous:RewardLedger,item:RewardItem,requestId:string,now=new Date()):RewardLedger {
  const prior=previous.purchases.find(p=>p.requestId===requestId);
  if(prior){if(prior.item!==item)throw new RewardPurchaseError('This purchase reference belongs to another item.','REQUEST_REUSED');return previous;}
  if(item==='freeze'&&previous.freezes>=REWARD_RULES.maxFreezes)throw new RewardPurchaseError('You already have two streak freezes.','INVENTORY_FULL');
  if(item==='boost'&&previous.boost)throw new RewardPurchaseError('Your point boost is already ready for the next earning day.','BOOST_ACTIVE');
  const cost=item==='freeze'?REWARD_RULES.freezeCost:REWARD_RULES.boostCost;
  if(previous.balance<cost)throw new RewardPurchaseError('Complete more earning days to collect enough credits.','INSUFFICIENT_CREDITS');
  const ledger=structuredClone(previous);ledger.balance-=cost;
  if(item==='freeze')ledger.freezes++;else ledger.boost={purchasedAt:now.toISOString()};
  ledger.purchases.push({requestId,item});return rewardLedgerSchema.parse(ledger);
}
export function rewardsSnapshot(ledger:RewardLedger,now=new Date()):RewardSnapshot {
  const today=rewardDate(now,ledger.timeZone),currentKey=rewardWeekKey(today);
  const week=ledger.weeks.find(value=>value.key===currentKey)||{key:currentKey,goal:ledger.desiredGoal,status:'open' as const};
  const awards=weekAwards(ledger,week),months=new Map<string,RewardMonth>();
  for(const award of ledger.awards){
    const month=award.date.slice(0,7),entry=months.get(month)||{month,basePoints:0,bonusPoints:0,points:0,days:0,creditsEarned:0,daysBreakdown:[]};
    entry.basePoints+=award.basePoints;entry.bonusPoints+=award.bonusPoints;entry.points+=award.basePoints+award.bonusPoints;entry.days++;entry.creditsEarned+=award.credits;
    entry.daysBreakdown.push({date:award.date,basePoints:award.basePoints,bonusPoints:award.bonusPoints});months.set(month,entry);
  }
  let streak=0,lastWeekStatus:RewardSnapshot['streak']['lastWeekStatus']=null;
  for(const item of ledger.weeks){
    if(item.status==='met'||(item.status==='open'&&weekAwards(ledger,item).length>=item.goal))streak++;
    else if(item.status==='missed')streak=0;
    if(['met','protected','missed'].includes(item.status))lastWeekStatus=item.status as NonNullable<typeof lastWeekStatus>;
  }
  const pending=ledger.weeks.find(item=>item.key<currentKey&&item.status==='open'&&weekAwards(ledger,item).length<item.goal);
  const basePoints=ledger.awards.reduce((n,a)=>n+a.basePoints,0),bonusPoints=ledger.awards.reduce((n,a)=>n+a.bonusPoints,0);
  return {version:1,enrolledAt:ledger.enrolledAt,timeZone:ledger.timeZone,today,balance:ledger.balance,
    inventory:{freezes:ledger.freezes,boostActive:!!ledger.boost},
    currentWeek:{key:week.key,goal:week.goal,days:awards.length,basePoints:awards.reduce((n,a)=>n+a.basePoints,0),bonusPoints:awards.reduce((n,a)=>n+a.bonusPoints,0),dates:awards.map(a=>a.date).sort()},
    nextGoal:ledger.desiredGoal===week.goal?null:{goal:ledger.desiredGoal,effectiveWeek:addRewardDays(week.key,7)},
    streak:{weeks:streak,lastWeekStatus,pendingWeek:pending?.key||null},
    months:[...months.values()].sort((a,b)=>b.month.localeCompare(a.month)),
    lifetime:{basePoints,bonusPoints,points:basePoints+bonusPoints,days:ledger.awards.length},
    recentAwards:[...ledger.awards].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,7).map(({date,basePoints,bonusPoints,credits})=>({date,basePoints,bonusPoints,credits}))};
}
export function rewardMonthComparison(snapshot:RewardSnapshot,month=snapshot.today.slice(0,7)){
  const anchor=new Date(`${month}-01T12:00:00Z`);anchor.setUTCMonth(anchor.getUTCMonth()-1);
  const previousMonth=anchor.toISOString().slice(0,7),current=snapshot.months.find(m=>m.month===month),previous=snapshot.months.find(m=>m.month===previousMonth);
  const currentDays=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).getUTCDate();
  const elapsedDays=month===snapshot.today.slice(0,7)?Number(snapshot.today.slice(8,10)):currentDays;
  const matching=previous?.daysBreakdown.filter(day=>Number(day.date.slice(8,10))<=elapsedDays)||[];
  const previousPoints=month===snapshot.today.slice(0,7)?matching.reduce((sum,a)=>sum+a.basePoints+a.bonusPoints,0):previous?.points||0;
  const previousBasePoints=month===snapshot.today.slice(0,7)?matching.reduce((sum,a)=>sum+a.basePoints,0):previous?.basePoints||0;
  const trackingSince=rewardDate(new Date(snapshot.enrolledAt),snapshot.timeZone);
  return {month,previousMonth,elapsedDays,currentPoints:current?.points||0,previousPoints,previousFullPoints:previous?.points||0,delta:(current?.points||0)-previousPoints,currentBasePoints:current?.basePoints||0,previousBasePoints,
    trackingSince,currentPeriodComplete:trackingSince<=`${month}-01`,previousPeriodComplete:trackingSince<=`${previousMonth}-01`};
}
