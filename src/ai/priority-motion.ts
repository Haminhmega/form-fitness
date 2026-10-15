import {analyzeGenericMotion} from './generic-motion';
import type {MotionProfile} from './popular-profiles';
import type {AnalysisInput,PosePoint} from './types';

type Rule={profile:MotionProfile;start:'high'|'low';phases:[string,string];orientation:'upright'|'horizontal'|'any';view:'side'|'front';camera:string;minimumRange:number};
const side='Film from the working side with shoulder, elbow, wrist, hip, knee and ankle visible. Keep the camera fixed.';
const rule=(profile:MotionProfile,start:Rule['start'],phases:Rule['phases'],orientation:Rule['orientation'],camera=side,view:Rule['view']='side',minimumRange=25):Rule=>({profile,start,phases,orientation,camera,view,minimumRange});
export const priorityRules={
 squat:rule('knee','high',['Lowering','Standing'],'upright'),
 lunge:rule('knee','high',['Lowering','Standing'],'upright',side+' Complete one leg’s set before switching; only the tracked leg is counted.'),
 hinge:rule('hip','high',['Hinging','Standing'],'any',side+' Begin upright, hinge down and return upright. A floor-start deadlift must first reach the upright position.'),
 bridge:rule('hip','low',['Lifting hips','Lowering hips'],'any',side+' Film at floor height. Begin with hips lowered, then lift and return.'),
 bench:rule('elbow','high',['Lowering','Pressing'],'any',side+' Position the camera beside the bench; plates and the bench must not hide the working elbow. Begin with arms extended.'),
 pushup:rule('elbow','high',['Lowering','Pressing'],'horizontal',side+' Include the whole body. Begin in the top push-up position.'),
 row:rule('elbow','high',['Pulling','Lowering'],'horizontal',side+' Keep the working arm visible beside the bench or torso. Begin with that arm extended.'),
 seatedRow:rule('elbow','high',['Pulling','Returning'],'upright',side+' Keep the cable and handle from obscuring the working wrist. Begin with arms extended.'),
 pulldown:rule('elbow','high',['Pulling down','Returning overhead'],'upright',side+' Include the hands at full overhead reach and keep the cable stack out of view.'),
 curl:rule('elbow','high',['Curling','Lowering'],'any',side+' Begin with the working arm extended. For unilateral curls, complete one side before switching.'),
 press:rule('elbow','low',['Pressing','Lowering'],'upright',side+' Include both the wrist overhead and the hip. Begin at shoulder level with the elbow bent.'),
 lateralRaise:rule('shoulder','low',['Raising','Lowering'],'upright','Film directly from the front, showing both shoulders, elbows and hips. Begin with arms by your sides.','front',20),
 frontRaise:rule('shoulder','low',['Raising','Lowering'],'upright',side+' Begin with arms by your sides; show the forward arm path.', 'side',20),
 pushdown:rule('elbow','low',['Extending','Returning'],'upright',side+' Begin with the elbow bent and keep the upper arm beside your torso.'),
 overheadExtension:rule('elbow','low',['Extending','Lowering'],'upright',side+' Include the wrist behind and above the head. Begin with the elbow bent.'),
 skullcrusher:rule('elbow','high',['Lowering','Extending'],'horizontal',side+' Include shoulder, elbow and wrist above the bench. Begin with arms extended.'),
 legCurl:rule('knee','high',['Curling','Lowering'],'horizontal',side+' Keep the knee and ankle visible beyond the machine pad. Begin with knees extended.'),
 legExtension:rule('knee','low',['Extending','Lowering'],'upright',side+' Show the working hip, knee and ankle beyond the machine pad. Begin with knees bent.'),
} satisfies Record<string,Rule>;
export type PriorityFamily=keyof typeof priorityRules;
const triples:Record<MotionProfile,number[]>={knee:[23,25,27],hip:[11,23,25],elbow:[11,13,15],shoulder:[13,11,23]};
const visible=(p:PosePoint|undefined)=>!!p&&[p.x,p.y,p.z,p.visibility,p.presence??1].every(Number.isFinite)&&Math.min(p.visibility,p.presence??1)>=.65&&p.x>.015&&p.x<.985&&p.y>.015&&p.y<.985;
function projectedAngle(p:PosePoint[],ids:number[],input:AnalysisInput){const [a,b,c]=ids.map(j=>p[j]);const u=[(a.x-b.x)*input.width,(a.y-b.y)*input.height],v=[(c.x-b.x)*input.width,(c.y-b.y)*input.height];return Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/(Math.hypot(...u)*Math.hypot(...v)))))*180/Math.PI;}
export function analyzePriorityMotion(input:AnalysisInput,family:PriorityFamily,name:string){
 const config=priorityRules[family],joints=[...new Set([...triples[config.profile],11,23])];
 const filtered:AnalysisInput={...input,frames:input.frames.map(frame=>{
  if(frame.poses.length!==1)return frame;
  const pose=frame.poses[0].map(p=>({...p}));
  for(const o of [0,1]){
   let ok=joints.every(j=>visible(pose[j+o]));
   if(ok){
    const s=pose[11+o],h=pose[23+o],dx=Math.abs((s.x-h.x)*input.width),dy=Math.abs((s.y-h.y)*input.height),length=Math.hypot(dx,dy);
    ok=length>input.height*.07&&(config.orientation==='any'||(config.orientation==='upright'?dy>dx*.7:dx>dy*.7));
    if(config.view==='side'&&visible(pose[11])&&visible(pose[12]))ok=ok&&Math.hypot((pose[11].x-pose[12].x)*input.width,(pose[11].y-pose[12].y)*input.height)<length*.8;
   }
   if(!ok)for(const j of joints)if(pose[j+o])pose[j+o].visibility=0;
  }
  return {...frame,poses:[pose]};
 })};
 // Track one side for the whole set, preferring the limb with measurable excursion.
 const range=(o:number)=>{const ids=triples[config.profile].map(j=>j+o);const a=filtered.frames.flatMap(f=>f.poses.length===1&&ids.every(j=>visible(f.poses[0][j]))?[projectedAngle(f.poses[0],ids,input)]:[]).filter(Number.isFinite).sort((a,b)=>a-b);return a.length<8?-1:a[Math.floor((a.length-1)*.9)]-a[Math.floor((a.length-1)*.1)];};
 const side=range(1)>range(0)?1:0;
 for(const f of filtered.frames)if(f.poses.length===1)for(const j of joints)if(f.poses[0][j+1-side])f.poses[0][j+1-side].visibility=0;
 const result=analyzeGenericMotion(filtered,config.profile,name);
 const at=(t:number)=>result.frames.find(f=>Math.abs(f.time-t)<.002)?.angle;
 result.reps=result.reps.filter(rep=>{const first=at(rep.start),middle=at(rep.bottom);return first!=null&&middle!=null&&rep.rangeDegrees>=config.minimumRange&&(config.start==='high'?first>middle:first<middle);}).map((r,i)=>({...r,index:i+1}));
 result.phaseLabels=config.phases;
 result.observations=[];
 if(!result.reps.length){result.status='unable';result.issues.push('No complete repetition met the selected movement’s start position, visible range and timing rules. Recheck the camera setup.');return result;}
 const reps=result.reps,rangeSpread=Math.max(...reps.map(r=>r.rangeDegrees))-Math.min(...reps.map(r=>r.rangeDegrees));
 result.observations.push({id:'priority-cycles',title:`${reps.length} complete repetitions measured`,detail:`Tracked ${config.phases[0].toLowerCase()} and ${config.phases[1].toLowerCase()} for ${name}. Only the ${side?'right':'left'} side was counted. Grip, equipment, load and exercise identity are not detected.`,repIndexes:reps.map(r=>r.index),time:reps[0].start,tone:'neutral'});
 if(reps.length>=3)result.observations.push({id:'priority-consistency',title:'Within-set range comparison',detail:`Projected range varied by ${Math.round(rangeSpread)}°. Compare the replay from a fixed camera; this is not a prescribed range or a technique grade.`,repIndexes:reps.map(r=>r.index),time:reps.at(-1)!.bottom,tone:rangeSpread>15?'notice':'neutral'});
 const durations=reps.map(r=>r.end-r.start);
 if(reps.length>=3&&Math.max(...durations)>Math.min(...durations)*1.5)result.observations.push({id:'priority-tempo',title:'Repetition timing varied',detail:'The slowest repetition took over 1.5 times as long as the fastest. Pauses may be intentional; review your replay.',repIndexes:reps.map(r=>r.index),tone:'notice'});
 return result;
}
