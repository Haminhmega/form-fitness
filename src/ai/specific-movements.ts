import {analyzeGenericMotion} from './generic-motion';
import type {AnalysisInput,PosePoint,SquatAnalysis,AnalyzedFrame} from './types';
import type {MotionProfile} from './popular-profiles';
export type SpecificMovement='pushup'|'curl'|'row'|'press'|'rdl'|'glute-bridge'|'reverse-lunge'|'hip-abduction'|'plank';
type Config={profile:MotionProfile;label:string;phases:[string,string];joints:number[]};
export const specificConfigs:Record<SpecificMovement,Config>={
 pushup:{profile:'elbow',label:'elbow angle',phases:['Lowering','Pressing'],joints:[11,13,15,23,27]},
 curl:{profile:'elbow',label:'elbow angle',phases:['Curling','Lowering'],joints:[11,13,15,23]},
 row:{profile:'elbow',label:'elbow angle',phases:['Pulling','Lowering'],joints:[11,13,15,23]},
 press:{profile:'shoulder',label:'upper-arm elevation',phases:['Pressing','Lowering'],joints:[11,13,15,23]},
 rdl:{profile:'hip',label:'hip angle',phases:['Hinging','Standing'],joints:[11,23,25,27]},
 'glute-bridge':{profile:'hip',label:'hip angle',phases:['Lifting hips','Lowering hips'],joints:[11,23,25,27]},
 'reverse-lunge':{profile:'knee',label:'front-knee angle',phases:['Lowering','Standing'],joints:[11,23,25,27]},
 'hip-abduction':{profile:'hip',label:'trunk-to-thigh angle',phases:['Raising leg','Lowering leg'],joints:[11,23,25,27]},
 plank:{profile:'hip',label:'body-line angle',phases:['Hold','Hold'],joints:[11,13,23,27]},
};
const usable=(p:PosePoint|undefined)=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z)&&Number.isFinite(p.visibility)&&Math.min(p.visibility,p.presence??1)>=.65&&p.x>.015&&p.x<.985&&p.y>.015&&p.y<.985;
const pixel=(p:PosePoint,i:AnalysisInput)=>({x:p.x*i.width,y:p.y*i.height});
function angle(a:PosePoint,b:PosePoint,c:PosePoint,i:AnalysisInput){
 const pa=pixel(a,i),pb=pixel(b,i),pc=pixel(c,i),u=[pa.x-pb.x,pa.y-pb.y],v=[pc.x-pb.x,pc.y-pb.y];
 const product=Math.hypot(...u)*Math.hypot(...v);return product>36?Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/product)))*180/Math.PI:null;
}
function gate(p:PosePoint[],offset:number,id:SpecificMovement,input:AnalysisInput){
 const ids=specificConfigs[id].joints.map(j=>j+offset);
 if(!ids.every(j=>usable(p[j])))return 'Required movement and posture landmarks are not clearly visible.';
 const shoulder=p[11+offset],hip=p[23+offset],a=pixel(shoulder,input),b=pixel(hip,input);
 const torso=Math.hypot(a.x-b.x,a.y-b.y);
 if(torso<input.height*.07)return 'Move closer while keeping all required joints in frame.';
 if(['pushup','row','rdl','glute-bridge','reverse-lunge','plank'].includes(id)&&usable(p[11])&&usable(p[12])){
  const left=pixel(p[11],input),right=pixel(p[12],input);
  if(Math.hypot(left.x-right.x,left.y-right.y)>torso*.8)return 'Use the requested side view so the projected joint angles can be interpreted.';
 }
 if(['row','pushup','plank','hip-abduction'].includes(id)&&Math.abs(a.y-b.y)>Math.abs(a.x-b.x)*1.3)return 'The visible torso orientation does not match the requested setup. Recheck the selected exercise and camera view.';
 return null;
}
function phaseOrder(result:SquatAnalysis,id:SpecificMovement){
 const startLow=['press','glute-bridge'].includes(id);
 result.reps=result.reps.filter(rep=>{
  const nearby=result.frames.filter(f=>f.valid&&f.angle!==null);
  const nearest=(time:number)=>nearby.reduce<AnalyzedFrame|undefined>((best,f)=>!best||Math.abs(f.time-time)<Math.abs(best.time-time)?f:best,undefined)?.angle;
  const first=nearest(rep.start),middle=nearest(rep.bottom);
  return first!=null&&middle!=null&&(startLow?first<middle:first>middle);
 }).map((rep,index)=>({...rep,index:index+1}));
}
export function analyzeSpecificMovement(input:AnalysisInput,id:SpecificMovement,name:string):SquatAnalysis{
 const config=specificConfigs[id],reasons=new Map<number,string>();
 const filtered:AnalysisInput={...input,frames:input.frames.map(frame=>{
  if(frame.poses.length!==1)return frame;
  const original=frame.poses[0],pose=original.map(p=>({...p}));
  for(const offset of [0,1]){
   const reason=gate(original,offset,id,input);
   if(reason){for(const joint of config.joints)if(pose[joint+offset])pose[joint+offset].visibility=0;reasons.set(frame.time,reason);}
  }
  return {...frame,poses:[pose]};
 })};
 if(id==='plank')return analyzeHold(filtered,reasons);
 // In a supported row the resting arm can be easier to see than the working
 // arm. Lock to the side with the largest robust measured excursion instead
 // of switching sides frame by frame or defaulting to the left arm.
 const triples:Record<MotionProfile,number[]>={elbow:[11,13,15],hip:[11,23,25],knee:[23,25,27],shoulder:[13,11,23]};
 const excursion=(offset:number)=>{
  const ids=triples[config.profile].map(j=>j+offset),values=filtered.frames.flatMap(f=>{
   if(f.poses.length!==1||!ids.every(j=>usable(f.poses[0][j])))return [];
   const a=angle(f.poses[0][ids[0]],f.poses[0][ids[1]],f.poses[0][ids[2]],input);return a===null?[]:[a];
  }).sort((a,b)=>a-b);
  return values.length<8?-1:values[Math.floor((values.length-1)*.9)]-values[Math.floor((values.length-1)*.1)];
 };
 const side=excursion(1)>excursion(0)?1:0;
 for(const frame of filtered.frames)if(frame.poses.length===1)for(const joint of config.joints)if(frame.poses[0][joint+1-side])frame.poses[0][joint+1-side].visibility=0;
 const result=analyzeGenericMotion(filtered,config.profile,name);
 result.frames.forEach(frame=>{if(!frame.valid&&reasons.has(frame.time))frame.reason=reasons.get(frame.time)});
 phaseOrder(result,id);
 result.metricLabel=config.label;result.phaseLabels=config.phases;
 if(!result.reps.length){result.status='unable';result.observations=[];result.issues.push('No full repetition started and returned to the required starting position. Incomplete starts are not counted.');return result;}
 result.observations=result.observations.filter(o=>o.id!=='range-consistency').map(o=>({...o,repIndexes:result.reps.map(r=>r.index),time:result.reps[0].bottom,title:result.reps.length+' complete '+(result.reps.length===1?'rep':'reps')+' measured',detail:'Counted a full '+config.phases[0].toLowerCase()+' and '+config.phases[1].toLowerCase()+' cycle in the visible '+config.label+'. You selected the exercise; this is not automatic exercise identification.'}));
 const ranges=result.reps.map(r=>r.rangeDegrees),spread=Math.max(...ranges)-Math.min(...ranges);
 if(ranges.length>=3)result.observations.push({id:'specific-range',title:spread>15?'Range changed across repetitions':'Measured ranges were similar',detail:'Projected '+config.label+' range varied by about '+Math.round(spread)+'°. Review the marked rep from the same camera position; this is a within-set comparison, not a target range or technique grade.',time:result.reps.at(-1)!.bottom,repIndexes:result.reps.map(r=>r.index),tone:spread>15?'notice':'neutral'});
 const repTimes=result.reps.map(r=>r.end-r.start);
 if(repTimes.length>=3&&Math.max(...repTimes)>Math.min(...repTimes)*1.5)result.observations.push({id:'specific-tempo',title:'Repetition timing varied',detail:'The slowest complete repetition took more than 1.5 times as long as the fastest. Intentional pauses can explain this; review the clip before changing your pace.',time:result.reps[repTimes.indexOf(Math.max(...repTimes))].start,repIndexes:result.reps.map(r=>r.index),tone:'notice'});
 if(['curl','row','press'].includes(id)){
  const inclinations=result.frames.filter(f=>f.valid).map(f=>{const offset=result.reps[0].side==='left'?0:1,p=f.landmarks;return Math.atan2((p[11+offset].x-p[23+offset].x)*input.width,(p[23+offset].y-p[11+offset].y)*input.height)*180/Math.PI});
  const drift=Math.max(...inclinations)-Math.min(...inclinations);
  if(drift>15)result.observations.push({id:'torso-motion',title:'Visible torso angle changed',detail:'Projected torso angle varied by about '+Math.round(drift)+'°. For '+name.toLowerCase()+', compare torso position across reps. Camera movement can produce the same observation.',repIndexes:result.reps.map(r=>r.index),time:result.reps[0].bottom,tone:'notice'});
 }
 if(id==='pushup')addBodyLine(result,input,'push-up');
 if(result.validFraction<.8&&result.status!=='unable')result.status='partial';
 return result;
}
function addBodyLine(result:SquatAnalysis,input:AnalysisInput,name:string){
 const values=result.frames.filter(f=>f.valid).map(f=>{const side=result.reps[0]?.side==='right'?1:0,p=f.landmarks;return angle(p[11+side],p[23+side],p[27+side],input)}).filter((a):a is number=>a!==null);
 if(values.length){const lowest=Math.min(...values);result.observations.push({id:'body-line',title:'Projected body-line check',detail:'The smallest visible shoulder–hip–ankle angle was about '+Math.round(lowest)+'° during this '+name+'. Review hip position in the replay. A 2D angle cannot distinguish every cause or establish technique quality.',repIndexes:result.reps.map(r=>r.index),tone:lowest<155?'notice':'neutral'});}
}
function analyzeHold(input:AnalysisInput,reasons:Map<number,string>):SquatAnalysis{
 const frames:AnalyzedFrame[]=[];let start:number|null=null,last=-1,longest=0,valid=0;
 const duration=Number.isFinite(input.duration)&&input.duration>0?input.duration:0;
 for(const source of input.frames){
  const p=source.poses.length===1?source.poses[0]:[];
  const offset=[0,1].find(o=>specificConfigs.plank.joints.every(j=>usable(p[j+o])));
  const a=offset===undefined?null:angle(p[11+offset],p[23+offset],p[27+offset],input);
  const usableTime=Number.isFinite(source.time)&&source.time>=0&&source.time<=duration&&source.time>last;
  const ok=usableTime&&input.width>0&&input.height>0&&source.poses.length===1&&a!==null;
  frames.push({time:source.time,landmarks:p,valid:ok,angle:ok?a:null,reason:ok?undefined:reasons.get(source.time)||'One person with the required joints must stay visible.'});
  if(ok){valid++;if(start===null||source.time-last>.6)start=source.time;longest=Math.max(longest,source.time-start)}else start=null;
  if(Number.isFinite(source.time))last=Math.max(last,source.time);
 }
 const held=valid>=8&&longest>=2;
 return {status:!held?'unable':valid<frames.length?'partial':'assessed',reps:[],frames,duration,validFraction:frames.length?valid/frames.length:0,holdSeconds:held?Math.round(longest*10)/10:0,metricLabel:'body-line angle',phaseLabels:['Hold','Hold'],issues:held?valid<frames.length?['Tracking gaps are excluded from the continuous hold duration.']:[]:['At least two continuous seconds of a visible side-view plank setup are required.'],observations:held?[{id:'tracked-hold',title:'Continuous hold tracked',detail:'Longest uninterrupted visible hold: '+longest.toFixed(1)+' seconds. This measures tracking continuity, not a pass/fail test of plank technique.',repIndexes:[],tone:'neutral'}]:[]};
}

