import type {PosePoint, SquatRep} from './types';
import type {FormFeedbackCard,FormCheck} from './form-feedback';
import {reliablePoint} from './pose-signal';

type Side = 'left'|'right';
export type FeedbackPhase = 'setup'|'eccentric'|'bottom'|'concentric'|'hold';
export type Kinematics = Partial<Record<'hipOffset'|'elbowX'|'elbowY'|'upperArm'|'lean'|'hipAngle'|'thighTilt'|'heel'|'handShin'|'earGap'|'headTilt',number>>;
export type KinematicSample = {time:number;metric:number;side:Side;kinematics:Kinematics};
export type KinematicRep = {rep:SquatRep;samples:KinematicSample[];range:number};
const median = (v:number[]) => {const a=[...v].sort((a,b)=>a-b),i=Math.floor(a.length/2);return a.length?(a.length%2?a[i]:(a[i-1]+a[i])/2):NaN;};
const values = (s:KinematicSample[],key:keyof Kinematics) => s.flatMap(p=>p.kinematics[key]===undefined?[]:[p.kinematics[key]!]);
type Pixel = {x:number;y:number};
const subtract = (a:Pixel,b:Pixel):Pixel => ({x:a.x-b.x,y:a.y-b.y});
const length = (p:Pixel) => Math.hypot(p.x,p.y);
const degrees = (u:Pixel,v:Pixel) => Math.acos(Math.max(-1,Math.min(1,(u.x*v.x+u.y*v.y)/(length(u)*length(v)))))*180/Math.PI;

/** Optional metrics abstain separately: hidden feet must not disable elbow checks. */
export function extractKinematics(points:PosePoint[],side:Side,d:{width:number;height:number}):Kinematics {
  const offset=side==='right'?1:0;
  const point=(id:number):Pixel|undefined=>{
    const p=points[id+offset];
    return reliablePoint(p)&&p.x>.015&&p.x<.985&&p.y>.015&&p.y<.985?{x:p.x*d.width,y:p.y*d.height}:undefined;
  };
  const s=point(11),h=point(23),e=point(13),w=point(15),k=point(25),a=point(27),heel=point(29),toe=point(31),ear=point(7);
  if(!s||!h)return {};
  const torso=length(subtract(s,h));
  if(torso<d.height*.07)return {};
  const out:Kinematics={lean:Math.abs(Math.atan2(s.x-h.x,h.y-s.y)*180/Math.PI)};
  if(a){
    const line=subtract(a,s),hip=subtract(h,s),span=length(line);
    // Orient the cross product towards screen gravity, independent of facing left/right.
    // A nearly vertical line cannot distinguish above/below the body reliably.
    if(span>torso&&Math.abs(line.x)>span*.5)out.hipOffset=(line.x*hip.y-line.y*hip.x)/span*Math.sign(line.x)/torso;
  }
  if(e&&length(subtract(e,s))>torso*.15){
    out.elbowX=(e.x-s.x)/torso;out.elbowY=(e.y-s.y)/torso;
    out.upperArm=degrees(subtract(e,s),subtract(h,s));
  }
  if(k&&length(subtract(k,h))>torso*.15){
    out.hipAngle=degrees(subtract(s,h),subtract(k,h));
    out.thighTilt=Math.abs(Math.atan2(k.x-h.x,k.y-h.y)*180/Math.PI);
  }
  if(a&&heel&&toe&&length(subtract(toe,heel))>torso*.08)out.heel=(toe.y-heel.y)/torso;
  if(w&&k&&a&&Math.abs(a.y-k.y)>torso*.15){
    const t=Math.max(0,Math.min(1,(w.y-k.y)/(a.y-k.y))),shinX=k.x+(a.x-k.x)*t;
    out.handShin=Math.abs(w.x-shinX)/torso;
  }
  if(ear&&(s.y-ear.y)>torso*.04){
    out.earGap=(s.y-ear.y)/torso;
    // Large head tilts are not interpreted as shoulder elevation.
    out.headTilt=Math.atan2(ear.x-s.x,s.y-ear.y)*180/Math.PI;
  }
  return out;
}

/** Phase labels describe actual movement; high/low angle alone cannot establish
 * muscle action (a high-angle start is eccentric in squats, concentric in curls).
 * Unknown generic cycles deliberately have no eccentric/concentric interpretation.
 */
export function eccentricHalf(labels?:[string,string]):0|1|undefined {
  if(!labels)return;
  const eccentric=/^(lowering|hinging|returning|stepping down)/i;
  if(eccentric.test(labels[0])&&!eccentric.test(labels[1]))return 0;
  if(eccentric.test(labels[1])&&!eccentric.test(labels[0]))return 1;
}
export function phaseDurations(rep:SquatRep,half:0|1) {
  const first=rep.bottom-rep.start,second=rep.end-rep.bottom;
  return {eccentric:half===0?first:second,concentric:half===0?second:first};
}

/** Missing optional joints break persistence; no interpolation across occlusion.
 * A median of three removes a single spike but never fills an absent sample.
 */
function scanSustained(samples:KinematicSample[],measure:(s:KinematicSample)=>number|undefined,threshold:number,seconds=.3,onEvaluated?:()=>void):number|undefined {
  let since:number|undefined,last=-Infinity,visibleSince:number|undefined,previous=-Infinity,reported=false;
  for(let i=0;i<samples.length;i++){
    const raw=measure(samples[i]);
    const neighbours=samples.slice(Math.max(0,i-1),i+2).map(measure);
    const value=raw===undefined||neighbours.some(v=>v===undefined)?undefined:median(neighbours as number[]);
    if(value!==undefined&&Number.isFinite(value)){
      if(samples[i].time-previous>.25)visibleSince=undefined;
      visibleSince??=samples[i].time;
      if(!reported&&samples[i].time-visibleSince>=seconds-1e-7){onEvaluated?.();reported=true;}
    }else visibleSince=undefined;
    previous=samples[i].time;
    if(value!==undefined&&Number.isFinite(value)&&value>=threshold){
      if(samples[i].time-last>.25)since=undefined;
      since??=samples[i].time;
      if(samples[i].time-since>=seconds-1e-7)return since;
      last=samples[i].time;
    }else {since=undefined;last=-Infinity;}
  }
}
const baseline=(rep:KinematicRep,key:keyof Kinematics)=>{
  const start=rep.samples.filter(s=>s.time<=rep.rep.start+Math.min(.3,(rep.rep.bottom-rep.rep.start)*.3));
  const v=values(start,key);return v.length>=Math.max(2,Math.ceil(start.length*.7))?median(v):NaN;
};
const joints=(side:Side,ids:number[])=>ids.map(id=>id+(side==='right'?1:0));
const highlight=(side:Side,ids:number[])=>({side,joints:joints(side,ids)});
type Hit={rep:KinematicRep;time:number};
// Permit a small amount of unavailable optional data, but never interpolate it:
// scanSustained still breaks evidence windows at each missing sample or gap.
const continuousMetrics=(rep:KinematicRep,keys:Array<keyof Kinematics>)=>rep.samples.filter(s=>keys.every(key=>s.kinematics[key]!==undefined&&Number.isFinite(s.kinematics[key]))).length>=Math.ceil(rep.samples.length*.8);

export function kinematicCards(family:string,group:KinematicRep[],hold:KinematicSample[],labels?:[string,string],checks:FormCheck[]=[]):FormFeedbackCard[] {
  const cards:FormFeedbackCard[]=[];
  const half=eccentricHalf(labels);
  let active:FormCheck|undefined;
  const begin=(id:string,label:string,detail:string)=>{
    active={id,label,status:'unable',detail};checks.push(active);return active;
  };
  const assessed=(check:FormCheck,detail:string)=>{check.status='not_detected';check.detail=detail;};
  const sustained=(samples:KinematicSample[],measure:(s:KinematicSample)=>number|undefined,threshold:number,seconds=.3)=>scanSustained(samples,measure,threshold,seconds,()=>{
    if(active)assessed(active,'Checked visible, uninterrupted windows on the working side. No sustained pattern met this check’s review threshold in those windows. Unseen portions are not assessed.');
  });
  const addRepeated=(id:string,ids:number[],hits:Hit[],card:Omit<FormFeedbackCard,'id'|'time'|'repIndexes'|'highlight'>)=>{
    if(!hits.length)return;
    const observed=hits.length===1?card.observed.replaceAll('repeatedly','').replaceAll('repeated reps','the visible rep').replaceAll('repeated hinges','the visible hinge')+' This was observed in one rep; it is not an established set-wide pattern.':card.observed;
    cards.push({...card,observed,id,time:hits[0].time,repIndexes:hits.map(h=>h.rep.rep.index),highlight:highlight(hits[0].rep.rep.side,ids)});
  };
  if(['pushup','inclinePushup','plank'].includes(family)){
    begin('body-position','Hip position and body line','Need a continuous side view of shoulder, hip and ankle. Keep the whole body visible and the camera level; a short or obscured body line cannot be assessed.');
    for(const direction of [1,-1]){
      const hits=group.flatMap(rep=>{
        if(!continuousMetrics(rep,['hipOffset']))return [];
        const start=baseline(rep,'hipOffset');
        const change=sustained(rep.samples,s=>s.kinematics.hipOffset===undefined?undefined:Math.min(direction*(s.kinematics.hipOffset-start),direction*s.kinematics.hipOffset),.12);
        const position=sustained(rep.samples,s=>s.kinematics.hipOffset===undefined?undefined:direction*s.kinematics.hipOffset,.2,.6);
        const time=change??position;return time===undefined?[]:[{rep,time,static:change===undefined}];
      });
      const base=median(values(hold.filter(s=>s.time<=hold[0]?.time+.8),'hipOffset'));
      const holdChange=sustained(hold,s=>s.kinematics.hipOffset===undefined?undefined:Math.min(direction*(s.kinematics.hipOffset-base),direction*s.kinematics.hipOffset),.12,.4);
      const holdPosition=sustained(hold,s=>s.kinematics.hipOffset===undefined?undefined:direction*s.kinematics.hipOffset,.2,1);
      const holdTime=holdChange??holdPosition;
      if(!hits.length&&holdTime===undefined)continue;
      const sag=direction===1,time=holdTime??hits[0].time,side=holdTime===undefined?hits[0].rep.rep.side:hold[0].side;
      const phase:FeedbackPhase=holdTime!==undefined?'hold':half===undefined?'concentric':time<=hits[0].rep.rep.bottom?(half===0?'eccentric':'concentric'):(half===0?'concentric':'eccentric');
      cards.push({id:sag?'hip-sag-change':'hip-pike-change',kind:'technique',title:sag?'Review your hips dropping':'Review your hips rising',
        observed:`Your visible hips ${holdChange===undefined&&holdPosition!==undefined||hits[0]?.static?'stayed':'moved'} ${sag?'below':'above'} the shoulder–ankle line (${sag?'sag':'pike'} direction in this camera view). ${holdTime!==undefined?'This was sustained during the visible hold.':hits.length===1?'Observed in one rep; this is not an established set-wide pattern.':`Observed in ${hits.length} comparable reps.`}`,
        action:sag?'Gently squeeze your glutes and brace your abdomen while breathing. Move the hips and torso together; shorten the set or elevate your hands if needed.':'Bring your hips back toward your starting shoulder–ankle line, without forcing the position. Use an easier variation if that longer body position is difficult to repeat.',
        cue:sag?'Brace as if preparing for a gentle punch; move your body as one unit.':'Bring the hips into line and move the chest and hips together.',
        biomechanics:'Changing hip position changes the body lever and support demands. The camera does not measure spinal loading or establish whether this position is unsafe.',
        why:'Signed, torso-normalized hip displacement distinguishes direction only in a stable, sufficiently horizontal view. Camera tilt and deliberate variations can explain the change.',phase,time,repIndexes:hits.map(h=>h.rep.rep.index),highlight:highlight(side,[11,23,27])});
    }
  }
  if(['curl','pushdown','overheadExtension','skullcrusher'].includes(family)&&half!==undefined){
    begin('elbow-drift-change','Upper-arm stability','Need visible shoulder, elbow and hip at the start and during lifting. Show the working arm from the side for a longer uninterrupted phase.');
    const hits=group.flatMap(rep=>{
      if(!continuousMetrics(rep,['elbowX','elbowY','upperArm']))return [];
      const x=baseline(rep,'elbowX'),y=baseline(rep,'elbowY'),angle=baseline(rep,'upperArm');
      const start=half===0?rep.rep.bottom:rep.rep.start,end=half===0?rep.rep.end:rep.rep.bottom;
      const window=rep.samples.filter(s=>s.time>=start&&s.time<=end);
      const time=sustained(window,s=>{
        const m=s.kinematics;if(m.elbowX===undefined||m.elbowY===undefined||m.upperArm===undefined)return;
        return Math.max(Math.abs(m.elbowX-x)/.18,Math.abs(m.elbowY-y)/.18,Math.abs(m.upperArm-angle)/18);
      },1);
      return time===undefined?[]:[{rep,time}];
    });
    const curl=family==='curl';
    addRepeated('elbow-drift-change',[11,13,23],hits,{kind:'technique',phase:'concentric',title:'Keep the intended upper-arm position',
      observed:'The working elbow moved relative to the shoulder, or the upper arm changed angle relative to the torso, repeatedly during the lifting phase.',
      action:curl?'For a strict curl, settle the upper arm beside your ribs or on the intended support pad. Curl the wrist in an arc instead of lifting the elbow; use a manageable load.':'For an elbow-extension variation, keep the upper arm in its intended position and move through the elbow hinge. Keep an overhead upper arm overhead; do not force it beside your ribs.',
      cue:curl?'Keep the upper arm quiet and arc the wrist toward you.':'Keep your upper arm steady while the elbow opens.',
      biomechanics:'Upper-arm movement can change leverage and involve shoulder motion. This is a possible compensation for a strict variation, not measured front-delt, lat or pec takeover.',
      why:'This compares shoulder-relative displacement and upper-arm angle within the same repetition. It cannot identify elbow flare in depth, muscle activation, or whether movement was intentional.'});
  }
  if(['squat','lunge'].includes(family)){
    begin('hip-shoot-change','Hips and chest during ascent','Need visible shoulder, hip, knee and ankle, with matching knee positions on lowering and rising. Film a complete side-view rep without hiding these joints.');
    const hipHits=group.flatMap(rep=>{
      if(!continuousMetrics(rep,['lean','hipAngle']))return [];
      const descending=rep.samples.filter(s=>s.time<rep.rep.bottom),ascending=rep.samples.filter(s=>s.time>=rep.rep.bottom&&s.time<=rep.rep.bottom+(rep.rep.end-rep.rep.bottom)*.5);
      const bottom=rep.samples.reduce((a,b)=>Math.abs(a.time-rep.rep.bottom)<Math.abs(b.time-rep.rep.bottom)?a:b);
      const time=sustained(ascending,s=>{
        const m=s.kinematics,b=bottom.kinematics;
        if(m.lean===undefined||m.hipAngle===undefined||b.hipAngle===undefined)return;
        const match=descending.filter(d=>d.kinematics.lean!==undefined&&Math.abs(d.metric-s.metric)<=6).sort((a,b)=>Math.abs(a.metric-s.metric)-Math.abs(b.metric-s.metric))[0];
        if(!match)return;
        const kneeExtension=s.metric-bottom.metric,hipExtension=m.hipAngle-b.hipAngle;
        if(kneeExtension<4||kneeExtension-hipExtension<5)return 0;
        return m.lean-match.kinematics.lean!;
      },14,.2);
      return time===undefined?[]:[{rep,time}];
    });
    addRepeated('hip-shoot-change',[11,23,25,27],hipHits,{kind:'technique',phase:'concentric',title:'Review hips and chest rising together',observed:'Early in the ascent, the torso leaned farther forward than on the descent at a similar knee angle, while knee extension outpaced hip extension.',action:'If this was unintended, brace and think about driving the upper back and hips up together. Try a lighter or shorter set to keep the ascent repeatable.',cue:'Bring your chest and hips up together.',biomechanics:'A changing torso angle can change hip and knee leverage. This is projected joint coupling, not a measure of spinal motion or joint torque.',why:'The comparison uses matched knee angles in the first half of the ascent, on the same visible side.'});
    begin('heel-rise-change','Heel movement near the bottom','Need ankle, heel and toe landmarks plus a visible starting position. Include the feet at sufficient size; shoes, equipment or cropping can prevent this check.');
    const heelHits=group.flatMap(rep=>{
      if(!continuousMetrics(rep,['heel']))return [];
      const base=baseline(rep,'heel'),window=rep.samples.filter(s=>Math.abs(s.time-rep.rep.bottom)<=Math.min(.5,(rep.rep.end-rep.rep.start)*.25));
      const time=sustained(window,s=>s.kinematics.heel===undefined?undefined:s.kinematics.heel-base,.08);
      return time===undefined?[]:[{rep,time}];
    });
    addRepeated('heel-rise-change',[27,29,31],heelHits,{kind:'technique',phase:'bottom',title:'Review heel movement near the bottom',observed:'The visible heel rose relative to the toe near the bottom in repeated reps.',action:'Keep pressure balanced across the foot and try a range you can control. If useful, test stable lifting shoes or a purpose-built heel wedge; a coach can help review ankle mobility and your setup.',cue:'Keep the foot settled as you lower.',biomechanics:'Heel elevation changes the setup and available ankle motion. The video cannot measure foot pressure or diagnose restricted ankle mobility.',why:'Ankle, heel and toe must all remain visible. Shoe landmarks and perspective can distort this estimate.'});
  }
  if(family==='hinge'){
    begin('hinge-hand-drift','Hand path relative to the legs','Need wrist, knee, ankle, shoulder and hip visible during lowering. Include the hands and lower legs; weights themselves are not tracked.');
    const hits=group.flatMap(rep=>{
      if(!continuousMetrics(rep,['handShin']))return [];
      const base=baseline(rep,'handShin');
      const time=sustained(rep.samples.filter(s=>s.time<=rep.rep.bottom),s=>s.kinematics.handShin===undefined?undefined:s.kinematics.handShin-base,.22);
      return time===undefined?[]:[{rep,time}];
    });
    addRepeated('hinge-hand-drift',[15,25,27],hits,{kind:'technique',phase:'eccentric',title:'Review hands moving away from the legs',observed:'The visible wrist moved farther horizontally from the knee/shin line during repeated hinges. The weights or bar were not tracked.',action:'If using weights, keep them close to your thighs and shins as you send your hips back. Use a range and load that let you repeat that path without forcing contact.',cue:'Keep the weights close as your hips travel back.',biomechanics:'Holding a load farther away can increase its external lever arm. Wrist position is only a proxy; this video does not measure load or lower-back torque.',why:'This compares wrist-to-leg distance with your own starting position, normalized by visible torso length.'});
  }
  if(['lateralRaise','frontRaise','row','seatedRow','pulldown'].includes(family)&&half!==undefined){
    begin('shoulder-shrug-change','Shoulder elevation','Need ear, shoulder and hip visible with a stable head angle during the lifting peak. Head motion or a short visible peak prevents comparison.');
    const hits=group.flatMap(rep=>{
      if(!continuousMetrics(rep,['earGap','headTilt']))return [];
      const base=baseline(rep,'earGap'),head=baseline(rep,'headTilt');
      const peak=half===0?rep.rep.end:rep.rep.bottom,start=half===0?rep.rep.bottom:rep.rep.start;
      const time=sustained(rep.samples.filter(s=>s.time>=start+(peak-start)*.55&&s.time<=peak),s=>{
        const m=s.kinematics;
        if(m.earGap===undefined||m.headTilt===undefined||Math.abs(m.headTilt-head)>12||base<.08)return;
        return (base-m.earGap)/base;
      },.25);
      return time===undefined?[]:[{rep,time}];
    });
    const raise=['lateralRaise','frontRaise'].includes(family);
    addRepeated('shoulder-shrug-change',[7,11,13],hits,{kind:'technique',phase:'concentric',title:'Review shoulder elevation at the top',observed:'The shoulder-to-ear gap shortened repeatedly near the lifting peak in this camera view.',action:raise?'If you are deliberately shrugging to finish the rep, try a manageable load and reach outward. Allow normal shoulder-blade upward rotation; do not pin the shoulders down.':'If the extra shrug was unintended, reset your neck and torso and pull smoothly. Allow the shoulder blades to move naturally, especially during an overhead return.',cue:raise?'Reach outward, with a relaxed neck.':'Keep the neck relaxed and pull without an extra shrug.',biomechanics:'Shoulder elevation can be normal, especially during arm elevation. This cue reviews an optional movement change; it does not identify upper-trap dominance or scapular mechanics.',why:'Visible head landmarks and a stable head angle are required. A 2D shoulder–ear distance cannot isolate shoulder motion from every head movement.'});
  }
  if(family!=='plank'){
    const tempo=begin('tempo-eccentric-control','Lowering and lifting control',half===undefined?'This exercise profile does not establish lowering/lifting phase order. Only total cycle timing is available.':'Need at least three complete reps on the same uninterrupted side to compare lowering and lifting.');
    const slowing=begin('concentric-slowing','Late-set lifting pace',half===undefined?'This profile does not establish the lifting phase.':'Need at least four comparable reps to compare the final two lifting phases with the first two.');
    if(group.length>=3&&half!==undefined){
    const times=group.map(r=>phaseDurations(r.rep,half)),ecc=median(times.map(t=>t.eccentric)),con=median(times.map(t=>t.concentric));
    assessed(tempo,`Measured ${group.length} reps: median lowering ${ecc.toFixed(2)} s, lifting ${con.toFixed(2)} s. No rushed-lowering pattern met this check’s threshold.`);
    const rushed=group.filter((_,i)=>times[i].eccentric<.75&&times[i].eccentric<.55*times[i].concentric);
    if(ecc<.75&&ecc<.55*con&&rushed.length>=2){
      const rep=rushed[0];
      cards.push({id:'tempo-eccentric-control',kind:'technique',phase:'eccentric',title:'Try a more controlled lowering phase',observed:`Median lowering time was ${ecc.toFixed(2)} s versus ${con.toFixed(2)} s lifting in these comparable reps.`,action:'If a fast lowering phase was not intentional, try a controlled 2–3 second lowering phase and a brief, comfortable pause before reversing. This is a practice option, not a mandatory tempo.',cue:'Lower with control, then reverse smoothly.',biomechanics:'Phase duration changes time under load, but speed alone cannot establish tension, a bounce or the hypertrophy stimulus.',why:'Timing is mapped to this exercise’s lowering and lifting phases. Sampling, pauses and the selected variation affect the estimate.',time:half===0?rep.rep.start:rep.rep.bottom,repIndexes:group.map(r=>r.rep.index),highlight:highlight(rep.rep.side,['squat','lunge'].includes(family)?[23,25,27]:[11,13,15])});
    }
    if(group.length>=4){
      assessed(slowing,'Compared the first two and final two lifting phases. No late-set slowing met this check’s threshold; this does not estimate reps left before failure.');
      const early=median(times.slice(0,2).map(t=>t.concentric)),later=times.slice(-2);
      if(later.every(t=>t.concentric>=early*1.45&&t.concentric-early>=.5)){
        const rep=group.at(-2)!;
        cards.push({id:'concentric-slowing',kind:'consistency',phase:'concentric',title:'Review the slower lifting phases',observed:`The last two lifting phases were at least 45% and 0.5 s longer than the opening two (baseline ${early.toFixed(2)} s).`,action:'Review whether the slower reps were deliberate. If effort is rising and your intended posture is hard to maintain, finish the set or reduce the next set’s load.',cue:'Keep your intended posture through the sticking point.',biomechanics:'Slower lifting can accompany fatigue, but can also reflect pacing or pauses. No exact reps-in-reserve or muscular-failure estimate is inferred.',why:'Only the concentric phases are compared; deliberately slower lowering does not trigger this check.',time:half===0?rep.rep.bottom:rep.rep.start,repIndexes:group.slice(-2).map(r=>r.rep.index)});
      }
    }
    }
  }
  for(const check of checks){
    const findings=cards.filter(card=>card.id===check.id||check.id==='body-position'&&['hip-sag-change','hip-pike-change'].includes(card.id));
    if(findings.length){check.status='finding';check.detail=findings.map(card=>card.observed).join(' ');check.cardId=findings[0].id;}
  }
  return cards;
}

export function executionHighlights(group:KinematicRep[],hold:KinematicSample[],labels?:[string,string]):string {
  const highlights:string[]=[];
  const half=eccentricHalf(labels);
  if(group.length>=3){
    if(half!==undefined){const times=group.map(r=>phaseDurations(r.rep,half)),ecc=median(times.map(t=>t.eccentric)),con=median(times.map(t=>t.concentric));highlights.push(`Median lowering/lifting: ${ecc.toFixed(2)} / ${con.toFixed(2)} s (${(ecc/con).toFixed(2)}:1).`);}
    const ranges=group.map(r=>r.range);highlights.push(`Projected rep-range spread: ${(Math.max(...ranges)-Math.min(...ranges)).toFixed(1)}° across ${group.length} comparable reps.`);
  }
  const lean=values(hold.length?hold:group.flatMap(r=>r.samples),'lean');
  if(lean.length){const mean=lean.reduce((s,v)=>s+v,0)/lean.length,variance=lean.reduce((s,v)=>s+(v-mean)**2,0)/lean.length;highlights.push(`Projected torso-angle variance: ${variance.toFixed(1)} deg².`);}
  return highlights.join(' ');
}
