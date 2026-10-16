import {getAnalyzer} from './registry';
import {priorityProfiles} from './priority-profiles';
import {priorityRules} from './priority-motion';
import {specificConfigs, type SpecificMovement} from './specific-movements';
import {extractKinematics,kinematicCards,executionHighlights,type Kinematics,type FeedbackPhase} from './feedback-kinematics';
import {poseDiscontinuity} from './pose-signal';
import type {AnalyzedFrame,PosePoint,SquatAnalysis,SquatRep} from './types';

export type FormFeedbackCard={id:string;kind:'technique'|'consistency'|'capture'|'practice';title:string;observed:string;action:string;why:string;time?:number;repIndexes:number[];biomechanics?:string;cue?:string;phase?:FeedbackPhase;highlight?:{side:'left'|'right';joints:number[]}};
export type FormFeedback={status:'ready'|'limited'|'retake';summary:string;cards:FormFeedbackCard[];limitations:string[]};
type Dimensions={width:number;height:number};
type Side='left'|'right';
type Metric='knee'|'hip'|'elbow'|'shoulder'|'ankle'|'body';
type Sample={time:number;metric:number;torso:number|null;body:number|null;side:Side;segment:number;kinematics:Kinematics};
type RepData={rep:SquatRep;samples:Sample[];range:number;seconds:number;segment:number};
type Guide={family:string;metric:Metric;practice:string;why:string;orientation?:'upright'|'horizontal';bodyLine?:boolean;torso?:boolean};

// Engineering heuristics for selecting review moments, not validated clinical
// cutoffs, ideal joint angles or proof that a repetition is correct/incorrect.
const LIMITS={confidence:.65,coverage:.65,readyCoverage:.85,minimumFrames:8,minimumRepSeconds:.65,maximumRepSeconds:25,torsoChange:15,bodyChange:12,rangeChange:10,relativeRangeChange:.2,tempoRatio:1.3,tempoDifference:.35,persistenceSeconds:.3} as const;
const baseLimitations=[
  'These are experimental suggestions from projected 2D landmarks, not a form grade or a safety assessment. The movement was selected by you; it was not independently identified.',
  'Camera angle, movement, clothing and occlusion can change the estimates. Load, grip, spinal curvature, muscle activation and injury risk are not measured.',
  'Suggested review thresholds are engineering heuristics, not clinically validated coaching standards. Intentional pauses and individual movement choices may explain a change.',
];
const finite=Number.isFinite;
const quantile=(values:number[],fraction:number)=>{const sorted=[...values].sort((a,b)=>a-b);const position=(sorted.length-1)*fraction,low=Math.floor(position);return sorted.length?sorted[low]+(sorted[Math.ceil(position)]-sorted[low])*(position-low):0;};
const median=(values:number[])=>quantile(values,.5);
const robustRange=(values:number[])=>quantile(values,.9)-quantile(values,.1);
const visible=(point:PosePoint|undefined):point is PosePoint=>!!point&&[point.x,point.y,point.z,point.visibility,point.presence??1].every(finite)&&point.visibility<=1&&(point.presence??1)<=1&&Math.min(point.visibility,point.presence??1)>=LIMITS.confidence&&point.x>.015&&point.x<.985&&point.y>.015&&point.y<.985;
const pixel=(p:PosePoint,d:Dimensions)=>({x:p.x*d.width,y:p.y*d.height});
function angle(points:PosePoint[],ids:number[],d:Dimensions){
  if(!ids.every(id=>visible(points[id])))return null;
  const [a,b,c]=ids.map(id=>pixel(points[id],d));
  const ux=a.x-b.x,uy=a.y-b.y,vx=c.x-b.x,vy=c.y-b.y;
  if(Math.min(Math.hypot(ux,uy),Math.hypot(vx,vy))<Math.max(4,d.height*.02))return null;
  return Math.acos(Math.max(-1,Math.min(1,(ux*vx+uy*vy)/(Math.hypot(ux,uy)*Math.hypot(vx,vy)))))*180/Math.PI;
}

function guideFor(exerciseId:string):Guide|undefined{
  const analyzer=getAnalyzer(exerciseId);
  if(!analyzer)return;
  const priority=priorityProfiles.find(profile=>profile.id===exerciseId);
  const builtIns:Record<string,string>={squat:'squat',pushup:'pushup',curl:'curl',row:'row',press:'press',rdl:'hinge','glute-bridge':'bridge','reverse-lunge':'lunge','hip-abduction':'abduction',plank:'plank'};
  const family=priority?.family||builtIns[exerciseId]||'generic';
  const config=priority?priorityRules[priority.family]:undefined;
  const label=analyzer.spec.metricLabel.toLowerCase();
  const metric:Metric=family==='plank'?'body':exerciseId==='press'?'shoulder':config?.profile||(/knee/.test(label)?'knee':/hip|thigh/.test(label)?'hip':/elbow/.test(label)?'elbow':/ankle/.test(label)?'ankle':'shoulder');
  const common={family,metric,orientation:config?.orientation==='any'?undefined:config?.orientation};
  if(['squat','supportedSquat','legPress'].includes(family))return {...common,practice:'Keep your feet settled and lower and return through a range you can control. Reset between reps if the movement stops feeling repeatable.',why:'A repeatable setup makes your own repetitions easier to compare; no universal squat depth or knee-angle target is prescribed.'};
  if(['hinge','backExtension'].includes(family))return {...common,practice:family==='hinge'?'Send your hips back with a small, steady knee bend. If using a weight, keep it close and stop the descent where you can control the return.':'Use a controlled hip movement and return without forcing a larger range. Review your setup before adding range or load.',why:'This is a general setup cue for the selected hinge movement. The camera cannot assess spinal curvature.'};
  if(['lunge','stepup'].includes(family))return {...common,practice:'Choose a balanced stance or stable step. Lower and return smoothly, using support if needed; complete one side before filming the other.',why:'A stable, repeatable setup helps compare the same working leg without mixing sides.'};
  if(['pushup','inclinePushup','plank'].includes(family))return {...common,orientation:family==='inclinePushup'?undefined:'horizontal',bodyLine:true,practice:family==='plank'?'Use your own comfortable starting body line as a reference. Reset or shorten the hold if you cannot keep the position you intended.':'Move your torso and hips together. Reset a shorter set or choose an easier elevated-hand variation if you cannot maintain the position you intended.',why:'The shoulder–hip–ankle line can be compared over time, but its unsigned 2D angle cannot tell whether a change is a sag, a pike or camera projection.'};
  if(['row','seatedRow','pulldown','pullup'].includes(family))return {...common,torso:['row','seatedRow'].includes(family),orientation:family==='row'?'horizontal':common.orientation,practice:'Set your torso and support first, then move the working arm smoothly. If extra body movement was unintended, use a load or range that lets you repeat the setup.',why:'This cue is for a controlled version of the selected pulling movement; it does not establish equipment, grip or torso rotation from the video.'};
  if(family==='curl')return {...common,torso:true,orientation:exerciseId==='curl'?'upright':common.orientation,practice:'For a strict curl, settle your torso and keep the upper arm in the position you intended. If body movement was unintended, use a lighter load or a smaller controlled range.',why:'The video can show projected torso changes, but it cannot determine the load or whether a moving-body variation was intentional.'};
  if(family==='press')return {...common,torso:true,orientation:'upright',practice:'Set your torso and press through a comfortable, repeatable path. If the torso movement was unintended, reset and use a load or range that lets you keep the position you intended.',why:'Visible torso movement can be reviewed without assuming spinal arching, wrist alignment or a particular grip.'};
  if(['calfRaise','seatedCalfRaise'].includes(family))return {...common,practice:'Use light support for balance and raise and lower smoothly through a comfortable range. Keep the knee position consistent with your selected standing or seated variation.',why:'Ankle-angle changes do not directly measure heel-rise height, calf activation or an ideal range.'};
  if(['bridge','hipThrust','abduction'].includes(family))return {...common,practice:'Keep your support and starting position repeatable. Move through a comfortable range and return under control before beginning the next rep.',why:'The selected hip movement can be rehearsed without treating one projected angle as an ideal position.'};
  if(['legCurl','seatedLegCurl','standingLegCurl','legExtension'].includes(family))return {...common,practice:'Set the machine and support first, then move the working knee through a comfortable range. Return smoothly without trying to force a larger range.',why:'Consistent setup makes knee-angle cycles easier to compare; the video does not assess pad alignment or joint loading.'};
  return {...common,practice:'Use the exercise guide to establish your setup. Choose a repeatable, controlled range and pace, and review any change before trying to correct it.',why:'This is a general practice cue for the selected movement, not an observed fault or a prescription for a particular joint angle.'};
}

const needsTorso=(guide:Guide)=>!!(guide.orientation||guide.torso||guide.bodyLine||['hip','shoulder','body'].includes(guide.metric));

function sampleFrame(frame:AnalyzedFrame,side:Side,guide:Guide,d:Dimensions):Omit<Sample,'segment'>|undefined{
  if(!frame.valid||!finite(frame.angle)||!Array.isArray(frame.landmarks))return;
  const offset=side==='right'?1:0,p=frame.landmarks;
  const triples:Record<Metric,number[]>={knee:[23,25,27],hip:[11,23,25],elbow:[11,13,15],shoulder:[13,11,23],ankle:[25,27,31],body:[11,23,27]};
  const required=[...new Set([...triples[guide.metric],...(needsTorso(guide)?[11,23]:[]),...(guide.bodyLine?[27]:[]),...(guide.metric==='ankle'?[29]:[])])].map(id=>id+offset);
  if(!required.every(id=>visible(p[id])))return;
  let torso:number|null=null;
  if(needsTorso(guide)){
    const shoulder=pixel(p[11+offset],d),hip=pixel(p[23+offset],d),dx=shoulder.x-hip.x,dy=hip.y-shoulder.y;
    if(Math.hypot(dx,dy)<d.height*.07)return;
    if(guide.orientation==='upright'&&Math.abs(dy)<Math.abs(dx)*.7)return;
    if(guide.orientation==='horizontal'&&Math.abs(dx)<Math.abs(dy)*.7)return;
    torso=Math.atan2(dx,dy)*180/Math.PI;
  }
  const metric=angle(p,triples[guide.metric].map(id=>id+offset),d);
  if(metric===null||!finite(metric))return;
  const body=guide.bodyLine?angle(p,[11+offset,23+offset,27+offset],d):null;
  if(guide.bodyLine&&body===null)return;
  return {time:frame.time,metric,torso,body,side,kinematics:extractKinematics(p,side,d)};
}

function segmentFrames(frames:AnalyzedFrame[],guide:Guide,d:Dimensions,duration:number,maxGap:number){
  const segments:Sample[][]=[];
  for(const side of ['left','right'] as const){
    let current:Sample[]=[],last=-Infinity;
    const flush=()=>{if(current.length)segments.push(current);current=[];};
    for(const frame of frames){
      if(!finite(frame.time)||frame.time<0||frame.time>duration+.001||frame.time<=last){flush();continue;}
      const sample=sampleFrame(frame,side,guide,d);
      if(!sample){flush();last=frame.time;continue;}
      if(frame.time-last>maxGap)flush();
      current.push({...sample,segment:segments.length});last=frame.time;
    }
    flush();
  }
  return segments;
}

function completeReps(result:SquatAnalysis,segments:Sample[][],step:number){
  const accepted:RepData[]=[];
  const seen=new Set<number>();
  let previousEnd=-Infinity;
  for(const rep of [...result.reps].sort((a,b)=>a.start-b.start)){
    if(!Number.isInteger(rep.index)||rep.index<1||seen.has(rep.index)||!['left','right'].includes(rep.side)||![rep.start,rep.bottom,rep.end].every(finite)||rep.start<0||rep.start>=rep.bottom||rep.bottom>=rep.end||rep.end>result.duration+.001||rep.end-rep.start<LIMITS.minimumRepSeconds||rep.end-rep.start>LIMITS.maximumRepSeconds||rep.start<previousEnd-.05)continue;
    const segment=segments.find(samples=>samples[0].side===rep.side&&samples[0].time<=rep.start+step*.6&&samples.at(-1)!.time>=rep.end-step*.6);
    if(!segment)continue;
    const samples=segment.filter(sample=>sample.time>=rep.start-step*.4&&sample.time<=rep.end+step*.4);
    if(samples.length<LIMITS.minimumFrames||samples[0].time>rep.start+step*.6||samples.at(-1)!.time<rep.end-step*.6)continue;
    const range=robustRange(samples.map(sample=>sample.metric));
    if(range<8)continue;
    const edge=Math.max(2,Math.floor(samples.length*.1));
    if(Math.abs(median(samples.slice(0,edge).map(s=>s.metric))-median(samples.slice(-edge).map(s=>s.metric)))>Math.max(12,range*.4))continue;
    accepted.push({rep,samples,range,seconds:rep.end-rep.start,segment:samples[0].segment});seen.add(rep.index);previousEnd=rep.end;
  }
  return accepted;
}

function comparableGroups(reps:RepData[]){
  const groups:RepData[][]=[];
  for(const rep of reps){
    const group=groups.at(-1),previous=group?.at(-1);
    if(!previous||previous.rep.side!==rep.rep.side||previous.segment!==rep.segment||rep.rep.start-previous.rep.end>3)groups.push([rep]);
    else group!.push(rep);
  }
  return groups.sort((a,b)=>b.length-a.length);
}

function smooth(samples:Sample[],value:(sample:Sample)=>number){
  return samples.map((sample,index)=>({time:sample.time,value:median(samples.slice(Math.max(0,index-1),index+2).map(value))}));
}
function sustainedTime(samples:Array<{time:number;value:number}>,baseline:number,threshold:number){
  let start:number|undefined;
  for(const sample of samples){
    if(Math.abs(sample.value-baseline)>=threshold){start??=sample.time;if(sample.time-start>=LIMITS.persistenceSeconds)return start;}
    else start=undefined;
  }
}
function postureChange(group:RepData[],body:boolean){
  const threshold=body?LIMITS.bodyChange:LIMITS.torsoChange;
  const key=(sample:Sample)=>body?sample.body!:sample.torso!;
  const changed=group.flatMap(rep=>{
    const values=smooth(rep.samples,key),baseline=median(values.slice(0,Math.max(3,Math.floor(values.length*.2))).map(sample=>sample.value));
    const time=sustainedTime(values,baseline,threshold);
    return time!==undefined&&robustRange(values.map(sample=>sample.value))>=threshold?[{rep,time}]:[];
  });
  if(changed.length>=2)return {time:changed[0].time,repIndexes:changed.map(entry=>entry.rep.rep.index)};
  if(group.length>=3){
    const baseline=median(group[0].samples.map(key)),later=group.slice(-2);
    if(later.every(rep=>Math.abs(median(rep.samples.map(key))-baseline)>=threshold))return {time:later[0].rep.start,repIndexes:later.map(rep=>rep.rep.index)};
  }
}

export function buildFormFeedback(exerciseId:string,result:SquatAnalysis,dimensions:Dimensions):FormFeedback{
  const analyzer=getAnalyzer(exerciseId),guide=guideFor(exerciseId);
  const setup=`${analyzer?.spec.camera.setupInstructions||'Choose a supported exercise and follow its camera setup.'}${guide&&needsTorso(guide)?' Keep the shoulder and hip visible as well as the working joints.':''}`;
  const capture=(observed:string,action?:string):FormFeedback=>({status:'retake',summary:'Record a clearer example before changing your form.',cards:[{id:'capture-retake',kind:'capture',title:'Retake this clip',observed,action:action||`${setup} Keep only one person visible, hold the camera still and ${guide?.family==='plank'?'hold your setup for at least 2 uninterrupted seconds':'include complete repetitions'}.`,why:'A capture problem can resemble a movement change. No technique correction or form grade is inferred from this clip.',repIndexes:[]}],limitations:[...baseLimitations]});
  if(!analyzer||!guide)return capture('This selected exercise does not have a motion analyzer.','Use the exercise guide for practice, or select an exercise with an available beta motion check.');
  if(![dimensions.width,dimensions.height,result.duration,result.validFraction].every(finite)||dimensions.width<=0||dimensions.height<=0||result.duration<2||result.validFraction<0||result.validFraction>1)return capture('Video dimensions, duration or tracking coverage were unavailable or invalid.');
  if(result.status==='unable'||!Array.isArray(result.frames)||result.frames.length<LIMITS.minimumFrames)return capture('There is not enough reliable tracked footage to make a movement suggestion.');
  if([...result.issues,...result.frames.map(frame=>frame.reason||'')].some(reason=>/more than one person|multiple (?:people|persons|person)|crowd/i.test(reason)))return capture('More than one person was reported in the clip, so the tracked movement cannot be assigned reliably.');
  if(result.frames.some(frame=>!frame.landmarks.length&&/One person with the required joints/.test(frame.reason||'')))return capture('Some hold frames did not resolve one visible person reliably.');
  if(result.frames.some((frame,index)=>index>0&&frame.valid&&result.frames[index-1].valid&&poseDiscontinuity(result.frames[index-1].landmarks,frame.landmarks,dimensions.width,dimensions.height)))return capture('A sudden body-position or scale change could be a camera cut or tracking discontinuity. Record one continuous set with a fixed camera.');
  const intervals=result.frames.slice(1).flatMap((frame,index)=>{const gap=frame.time-result.frames[index].time;return finite(gap)&&gap>0&&gap<1?[gap]:[];});
  const step=median(intervals);
  if(!step||step>.225)return capture('The sampled footage is too sparse for reliable movement comparisons.');
  const maximumGap=Math.max(.25,Math.min(.4,step*2.5));
  const segments=segmentFrames(result.frames,guide,dimensions,result.duration,maximumGap);
  const validTimes=new Set(segments.flatMap(segment=>segment.map(sample=>sample.time)));
  const trackedSeconds=result.frames.slice(1).reduce((sum,frame,index)=>{
    const previous=result.frames[index],gap=frame.time-previous.time;
    return sum+(validTimes.has(frame.time)&&validTimes.has(previous.time)&&gap>0&&gap<=maximumGap?gap:0);
  },0);
  const coverage=Math.min(result.validFraction,validTimes.size/result.frames.length,trackedSeconds/result.duration);
  const longest=segments.reduce<Sample[]>((best,segment)=>!best.length||segment.at(-1)!.time-segment[0].time>best.at(-1)!.time-best[0].time?segment:best,[]);
  if(coverage<LIMITS.coverage||longest.length<LIMITS.minimumFrames||longest.at(-1)!.time-longest[0].time<1.5)return capture('Required joints were missing, unclear or interrupted for too much of this clip.');
  const limitations=[...baseLimitations];
  const cards:FormFeedbackCard[]=[];
  const reps=guide.family==='plank'?[]:completeReps(result,segments,step);
  const groups=comparableGroups(reps),group=groups[0]||[];
  const hold=guide.family==='plank'&&finite(result.holdSeconds)&&result.holdSeconds!>=2&&longest.at(-1)!.time-longest[0].time>=2;
  if(!hold&&!reps.length)return capture('No complete repetition could be independently matched to a continuous, visible working side.');
  const priority=priorityProfiles.find(profile=>profile.id===exerciseId);
  const phases=priority?priorityRules[priority.family].phases:exerciseId==='squat'?['Lowering','Standing'] as [string,string]:specificConfigs[exerciseId as SpecificMovement]?.phases??result.phaseLabels;
  cards.push(...kinematicCards(guide.family,group,hold?longest:[],phases));
  if(coverage<LIMITS.readyCoverage){cards.push({id:'capture-limited',kind:'capture',title:'Improve the camera view',observed:'Part of the clip could not be used consistently. Only uninterrupted visible movement is considered below.',action:setup+' Keep the camera fixed and record one working side at a time.',why:'Clearer landmarks make within-set comparisons more useful.',repIndexes:[]});limitations.push('Tracking coverage was limited; suggestions use only the reliable portions.');}
  if(hold){
    const values=smooth(longest,sample=>sample.body!),baseline=median(values.filter(sample=>sample.time<=values[0].time+.8).map(sample=>sample.value));
    const time=sustainedTime(values,baseline,LIMITS.bodyChange);
    if(time!==undefined&&robustRange(values.map(sample=>sample.value))>=LIMITS.bodyChange)cards.push({id:'body-line-change',kind:'technique',title:'Review the change in your body line',observed:'The projected shoulder–hip–ankle line changed from your starting position and stayed different for several sampled frames.',action:guide.practice,why:guide.why,time,repIndexes:[]});
  }else{
    if(group.length>=2&&(guide.bodyLine||guide.torso)){
      const change=postureChange(group,!!guide.bodyLine);
      if(change)cards.push({id:guide.bodyLine?'body-line-change':'torso-change',kind:'technique',title:guide.bodyLine?'Review your body-line changes':'Review your torso movement',observed:guide.bodyLine?'The projected shoulder–hip–ankle line changed repeatedly within this uninterrupted set.':'The projected shoulder-to-hip line changed repeatedly within this uninterrupted set. This could be intentional movement or camera motion.',action:guide.practice,why:guide.why,...change});
    }
    if(group.length>=3){
      const early=group.slice(0,Math.min(2,group.length-2)),later=group.slice(-2),baseline=median(early.map(rep=>rep.range));
      const threshold=Math.max(LIMITS.rangeChange,baseline*LIMITS.relativeRangeChange);
      const smaller=later.every(rep=>baseline-rep.range>=threshold),larger=later.every(rep=>rep.range-baseline>=threshold);
      if(smaller||larger)cards.push({id:'range-change',kind:'consistency',title:'Compare the range in your later reps',observed:`The last two comparable reps used ${smaller?'a smaller':'a larger'} projected ${analyzer.spec.metricLabel} range than the opening reps. This is a comparison with your own set, not a required depth.`,action:`Review the highlighted reps. If the change was unintended, reset your setup and use a repeatable, comfortable range on the next set.`,why:'Range can change with camera projection, fatigue or a deliberate choice. Do not force extra range just to match a number.',time:later[0].rep.bottom,repIndexes:later.map(rep=>rep.rep.index)});
      const seconds=median(early.map(rep=>rep.seconds)),slower=later.every(rep=>rep.seconds>=seconds*LIMITS.tempoRatio&&rep.seconds-seconds>=LIMITS.tempoDifference),faster=later.every(rep=>rep.seconds<=seconds/LIMITS.tempoRatio&&seconds-rep.seconds>=LIMITS.tempoDifference);
      if(slower||faster)cards.push({id:'tempo-change',kind:'consistency',title:'Make your intended pace repeatable',observed:`The last two comparable repetitions took ${slower?'longer':'less time'} than the opening repetitions. Deliberate pauses can explain this difference.`,action:'Replay these repetitions. Keep intentional pauses; if the change was unintended, reset between reps and choose a pace you can repeat without rushing. End the set if you cannot maintain the movement you intended.',why:'Consistency is compared within this set. There is no universal number of seconds that every rep should take.',time:later[0].rep.start,repIndexes:later.map(rep=>rep.rep.index)});
    }else limitations.push(`Only ${group.length} complete ${group.length===1?'rep was':'reps were'} comparable on one uninterrupted side. At least three are needed for range or timing comparisons.`);
    if(groups.length>1)limitations.push('Repetitions from different sides or interrupted segments were not compared with each other.');
  }
  const ready=coverage>=LIMITS.readyCoverage&&(hold||group.length>=3);
  if(cards.filter(card=>card.kind==='technique'||card.kind==='consistency').length===0)cards.push({id:'general-practice',kind:'practice',title:ready?'Your measured set, and one cue to practice':'A cue to practice next set',observed:`General practice cue — this is not a fault detected in your clip.${ready?' '+executionHighlights(group,hold?longest:[],phases):''}`,action:guide.practice,why:guide.why,cue:guide.practice.split('. ')[0]+'.',phase:hold?'hold':'setup',repIndexes:[]});
  const order={capture:0,technique:1,consistency:2,practice:3};
  cards.sort((a,b)=>order[a.kind]-order[b.kind]);
  // Legacy posture/range cards also carry a replay target. Never highlight the
  // opposite side just because its landmark confidence happens to be higher.
  for(const card of cards)if(card.time!==undefined&&!card.highlight){
    const side=result.reps.find(rep=>rep.index===card.repIndexes[0])?.side??longest[0]?.side;
    const ids=/body-line/.test(card.id)?[11,23,27]:/torso/.test(card.id)?[11,23]:guide.metric==='knee'?[23,25,27]:guide.metric==='hip'?[11,23,25]:guide.metric==='ankle'?[25,27,31]:guide.metric==='shoulder'?[13,11,23]:[11,13,15];
    if(side)card.highlight={side,joints:ids.map(id=>id+(side==='right'?1:0))};
  }
  return {status:ready?'ready':'limited',summary:cards.some(card=>card.kind==='technique'||card.kind==='consistency')?'Review these moments, then choose one change to try on your next set.':ready?'No repeated change met these limited checks. This does not establish that your form is correct.':'The visible footage supports only limited feedback. Use the setup and practice cue before recording again.',cards:cards.slice(0,3),limitations};
}
