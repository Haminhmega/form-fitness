import type {AnalysisInput,AnalyzedFrame,PosePoint,SquatAnalysis,SquatRep} from './types';
import type {MotionProfile} from './popular-profiles';

type Side='left'|'right';
type Sample={time:number;angle:number;side:Side};
const triples:Record<MotionProfile,{left:[number,number,number];right:[number,number,number];label:string}>={
  knee:{left:[23,25,27],right:[24,26,28],label:'knee angle'},
  hip:{left:[11,23,25],right:[12,24,26],label:'hip angle'},
  elbow:{left:[11,13,15],right:[12,14,16],label:'elbow angle'},
  shoulder:{left:[13,11,23],right:[14,12,24],label:'shoulder angle'},
  ankle:{left:[25,27,31],right:[26,28,32],label:'ankle angle'},
};
const finite=(n:number)=>Number.isFinite(n);
const confidence=(p:PosePoint|undefined)=>p&&finite(p.visibility)&&finite(p.presence??1)?Math.min(p.visibility,p.presence??1):0;
const round=(n:number,p=2)=>Number(n.toFixed(p));
function angle(a:PosePoint,b:PosePoint,c:PosePoint,width:number,height:number){
  const ax=(a.x-b.x)*width,ay=(a.y-b.y)*height,cx=(c.x-b.x)*width,cy=(c.y-b.y)*height;
  const divisor=Math.hypot(ax,ay)*Math.hypot(cx,cy);if(divisor<36)return null;
  return Math.acos(Math.max(-1,Math.min(1,(ax*cx+ay*cy)/divisor)))*180/Math.PI;
}
function measure(pose:PosePoint[],profile:MotionProfile,width:number,height:number,lockedSide?:Side):Sample|null{
  const definition=triples[profile];
  const candidates=(lockedSide?[lockedSide]:['left','right'] as Side[]).map(side=>{const ids=definition[side],points=ids.map(id=>pose[id]);if(points.some(point=>!point||!finite(point.x)||!finite(point.y)||confidence(point)<.65||point.x<.015||point.x>.985||point.y<.015||point.y>.985))return null;const value=angle(points[0],points[1],points[2],width,height);return value===null?null:{time:0,angle:value,side,score:points.reduce((sum,p)=>sum+confidence(p),0)};}).filter(Boolean) as (Sample&{score:number})[];
  if(!candidates.length)return null;const best=candidates.sort((a,b)=>b.score-a.score)[0];return {time:0,angle:best.angle,side:best.side};
}

/** Adaptive 2D cycle measurement for explicitly selected exercises. It reports motion only. */
export function analyzeGenericMotion(input:AnalysisInput,profile:MotionProfile,exerciseName:string,minimumExcursion=20):SquatAnalysis{
  const frames:AnalyzedFrame[]=[],segments:Sample[][]=[];let segment:Sample[]=[];let lastTime=-1;let invalid=0;
  const duration=finite(input.duration)&&input.duration>0?input.duration:0;const flush=()=>{if(segment.length)segments.push(segment);segment=[];};
  for(const source of input.frames){const pose=source.poses.length===1?source.poses[0]:[];const frame:AnalyzedFrame={time:source.time,landmarks:pose.map(p=>({...p})),valid:false,angle:null};
    if(!finite(source.time)||source.time<=lastTime||source.time<0||source.time>duration+.001||source.poses.length!==1||!finite(input.width)||!finite(input.height)||input.width<=0||input.height<=0){frame.reason=source.poses.length>1?'More than one person was detected.':source.poses.length===0?'No person was tracked.':'A frame could not be measured.';invalid++;flush();frames.push(frame);if(finite(source.time))lastTime=Math.max(lastTime,source.time);continue;}
    if(lastTime>=0&&source.time-lastTime>.6)flush();lastTime=source.time;const sample=measure(pose,profile,input.width,input.height,segment[0]?.side);
    if(!sample){frame.reason='The required joints were not confidently visible.';invalid++;flush();frames.push(frame);continue;}sample.time=source.time;frame.valid=true;frame.angle=round(sample.angle,3);frames.push(frame);segment.push(sample);}
  flush();const reps:SquatRep[]=[];
  const requiredExcursion=finite(minimumExcursion)?Math.max(12,minimumExcursion):20;
  for(const samples of segments){if(samples.length<8||samples.at(-1)!.time-samples[0].time<1.2)continue;const values=samples.map(s=>s.angle),lo=Math.min(...values),hi=Math.max(...values),span=hi-lo;if(span<requiredExcursion)continue;const low=lo+span*.28,high=hi-span*.28;
    type Extreme=Sample&{state:'low'|'high'};const events:Extreme[]=[];for(const sample of samples){const state=sample.angle<=low?'low':sample.angle>=high?'high':null;if(!state)continue;const prior=events.at(-1);if(prior?.state===state){const farther=state==='low'?sample.angle<prior.angle:sample.angle>prior.angle;if(farther)events[events.length-1]={...sample,state};}else events.push({...sample,state});}
    for(let i=0;i+2<events.length;i+=2){const start=events[i],middle=events[i+1],end=events[i+2];if(start.state!==end.state||middle.state===start.state){i--;continue;}const first=middle.time-start.time,second=end.time-middle.time,total=end.time-start.time,range=Math.abs(middle.angle-(start.angle+end.angle)/2);if(total<.6||total>20||first<.18||second<.18||range<requiredExcursion*.9)continue;reps.push({index:reps.length+1,start:round(start.time,3),bottom:round(middle.time,3),end:round(end.time,3),descentSeconds:round(first),ascentSeconds:round(second),rangeDegrees:round(range,1),minKneeAngle:round(Math.min(start.angle,middle.angle,end.angle),1),side:start.side});}}
  const valid=frames.length-invalid,validFraction=frames.length?valid/frames.length:0,issues:string[]=[];if(invalid)issues.push(`${invalid} sampled ${invalid===1?'frame was':'frames were'} withheld because the person or required joints were not clearly tracked.`);if(valid<8)issues.push('At least 8 usable sampled frames are required. Keep one person and the working joints fully visible.');if(!reps.length)issues.push(`No complete repeating ${triples[profile].label} cycle met the beta timing and range thresholds. This does not establish whether ${exerciseName.toLowerCase()} was attempted.`);
  const observations:SquatAnalysis['observations']=reps.length?[{id:'measured-cycles',title:`${reps.length} complete ${reps.length===1?'cycle':'cycles'} measured`,detail:`Counted from repeating visible ${triples[profile].label} changes after you selected ${exerciseName}. The app does not identify the exercise, load, or technique.`,repIndexes:reps.map(r=>r.index),time:reps[0].bottom,tone:'neutral'}]:[];
  if(reps.length>=4){const ranges=reps.map(r=>r.rangeDegrees),spread=Math.max(...ranges)-Math.min(...ranges);observations.push({id:'range-consistency',title:spread<=12?'Measured ranges were similar':'Measured range varied across cycles',detail:`The projected ${triples[profile].label} range spread was about ${Math.round(spread)}°. Camera position and tracking affect this value; it is not a form, depth, or safety grade.`,repIndexes:reps.map(r=>r.index),time:reps.at(-1)!.bottom,tone:spread<=12?'neutral':'notice'});}
  return {status:!reps.length?'unable':invalid?'partial':'assessed',reps,frames,duration,validFraction,issues,observations,metricLabel:triples[profile].label,phaseLabels:['First phase','Return phase']};
}
