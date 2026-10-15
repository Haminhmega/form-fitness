import {analyzeGenericMotion} from './generic-motion';
import type {MotionProfile} from './popular-profiles';
import type {AnalysisInput,PosePoint} from './types';

type SetupGuard='overheadHands'|'lowHands'|'chestHeight'|'seatedThigh'|'standingThigh'|'standingCalf'|'seatedCalf';
type Rule={profile:MotionProfile;start:'high'|'low';phases:[string,string];orientation:'upright'|'horizontal'|'any';view:'side'|'front';camera:string;minimumRange:number;guard?:SetupGuard};
const side='Film from the working side with shoulder, elbow, wrist, hip, knee and ankle visible. Keep the camera fixed.';
const rule=(profile:MotionProfile,start:Rule['start'],phases:Rule['phases'],orientation:Rule['orientation'],camera=side,view:Rule['view']='side',minimumRange=25):Rule=>({profile,start,phases,orientation,camera,view,minimumRange});
const guarded=(config:Rule,guard:SetupGuard):Rule=>({...config,guard});
export const priorityRules={
 squat:rule('knee','high',['Lowering','Standing'],'upright'),
 lunge:rule('knee','high',['Lowering','Standing'],'upright',side+' Complete one leg’s set before switching; only the tracked leg is counted.'),
 hinge:rule('hip','high',['Hinging','Standing'],'any',side+' Begin upright, hinge down and return upright. A floor-start deadlift must first reach the upright position.'),
 bridge:rule('hip','low',['Lifting hips','Lowering hips'],'any',side+' Film at floor height. Begin with hips lowered, then lift and return.'),
 bench:rule('elbow','high',['Lowering','Pressing'],'any',side+' Position the camera beside the bench; plates and the bench must not hide the working elbow. Begin with arms extended.'),
 pushup:rule('elbow','high',['Lowering','Pressing'],'horizontal',side+' Include the whole body. Begin in the top push-up position.'),
 inclinePushup:rule('elbow','high',['Lowering','Pressing'],'any',side+' Include the elevated hand support and the whole body. Begin with arms extended; keep the camera at the height of your torso.'),
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
 hipThrust:rule('hip','low',['Lifting hips','Lowering hips'],'any',side+' Show the bench, shoulder, hip and working knee. Begin with hips lowered; keep the plate away from the visible hip. Complete one leg’s set before switching.'),
 pullup:guarded(rule('elbow','high',['Pulling up','Lowering'],'upright',side+' Include the bar and wrists above the shoulders throughout. Begin in a controlled arms-extended hang. This measures the visible arm cycle, not chin-over-bar height or assistance.'),'overheadHands'),
 dip:guarded(rule('elbow','high',['Lowering','Pressing up'],'upright',side+' Show the working shoulder, elbow, wrist and hip around the bars. Begin at the top with arms extended. Dip depth and shoulder safety are not graded.'),'lowHands'),
 chestPress:guarded(rule('elbow','low',['Pressing','Returning'],'upright',side+' Film beside the seat with the working arm clear of the machine. Begin with elbows bent and handles near chest height; keep wrists visible.'),'chestHeight'),
 stepup:rule('knee','low',['Stepping up','Stepping down'],'upright',side+' Begin with the working foot already on a stable step and that knee bent. Step up and return with the same working foot on the step. Finish one side before switching; alternating and walking steps are not counted reliably.'),
 supportedSquat:rule('knee','high',['Lowering','Pressing up'],'any',side+' Show the working hip, knee and ankle beside the sled. Begin with knees extended. If the machine hides your hip or knee, use set logging instead.'),
 legPress:rule('knee','high',['Lowering sled','Pressing'],'any',side+' Show the working hip, knee and ankle from beside the seat. Begin with knees extended without forcing lockout. The sled must not hide the joints; sled travel and load are not measured.'),
 seatedLegCurl:guarded(rule('knee','high',['Curling','Returning'],'upright',side+' Film beside the seat with the working thigh, knee and ankle clear of the pad. Begin with the knee extended; the thigh stays supported.'),'seatedThigh'),
 standingLegCurl:guarded(rule('knee','high',['Curling','Lowering'],'upright',side+' Show the working hip, knee and ankle beside the machine. Begin standing with the working knee extended. Complete one leg’s set before switching.'),'standingThigh'),
 calfRaise:guarded(rule('ankle','low',['Raising heels','Lowering heels'],'upright',side+' Place the camera low enough to resolve the working knee, ankle, heel and toes, while keeping the shoulder and hip in view. Begin with heels lowered and the knee nearly straight. Shoe-covered or tiny foot landmarks may prevent measurement.','side',12),'standingCalf'),
 seatedCalfRaise:guarded(rule('ankle','low',['Raising heels','Lowering heels'],'upright',side+' Film beside the seat at lower-leg height with knee, ankle, heel and toes visible, plus shoulder and hip. Begin with heels lowered and knees bent. Keep the thigh pad from hiding your knee.','side',12),'seatedCalf'),
 backExtension:rule('hip','high',['Lowering torso','Raising torso'],'any',side+' Include the shoulder, hip and knee on the extension bench. Begin with the torso in line with the legs, lower under control and return. The hip cycle does not measure spinal curvature or lumbar safety.'),
} satisfies Record<string,Rule>;
export type PriorityFamily=keyof typeof priorityRules;
const triples:Record<MotionProfile,number[]>={knee:[23,25,27],hip:[11,23,25],elbow:[11,13,15],shoulder:[13,11,23],ankle:[25,27,31]};
const visible=(p:PosePoint|undefined)=>!!p&&[p.x,p.y,p.z,p.visibility,p.presence??1].every(Number.isFinite)&&Math.min(p.visibility,p.presence??1)>=.65&&p.x>.015&&p.x<.985&&p.y>.015&&p.y<.985;
function projectedAngle(p:PosePoint[],ids:number[],input:AnalysisInput){const [a,b,c]=ids.map(j=>p[j]);const u=[(a.x-b.x)*input.width,(a.y-b.y)*input.height],v=[(c.x-b.x)*input.width,(c.y-b.y)*input.height];return Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/(Math.hypot(...u)*Math.hypot(...v)))))*180/Math.PI;}
export function analyzePriorityMotion(input:AnalysisInput,family:PriorityFamily,name:string){
 const config:Rule=priorityRules[family],joints=[...new Set([...triples[config.profile],11,23,...(config.profile==='ankle'?[29]:[])])];
 const reasons=new Map<number,string>();
 const filtered:AnalysisInput={...input,frames:input.frames.map(frame=>{
  if(frame.poses.length!==1)return frame;
  const pose=frame.poses[0].map(p=>({...p}));
  const original=frame.poses[0];
  for(const o of [0,1]){
   let ok=joints.every(j=>visible(pose[j+o]));
   if(ok){
    const s=pose[11+o],h=pose[23+o],dx=Math.abs((s.x-h.x)*input.width),dy=Math.abs((s.y-h.y)*input.height),length=Math.hypot(dx,dy);
    ok=length>input.height*.07&&(config.orientation==='any'||(config.orientation==='upright'?dy>dx*.7:dx>dy*.7));
    if(config.view==='side'&&visible(original[11])&&visible(original[12]))ok=ok&&Math.hypot((original[11].x-original[12].x)*input.width,(original[11].y-original[12].y)*input.height)<length*.8;
    if(config.view==='front')ok=ok&&visible(original[11])&&visible(original[12])&&Math.abs(original[11].x-original[12].x)*input.width>length*.25;
    const wrist=pose[15+o],knee=pose[25+o];
    if(ok&&config.guard==='overheadHands')ok=visible(wrist)&&(wrist.y-s.y)*input.height<length*.15;
    if(ok&&config.guard==='lowHands')ok=visible(wrist)&&(wrist.y-s.y)*input.height>length*.2;
    if(ok&&config.guard==='chestHeight')ok=visible(wrist)&&Math.abs(wrist.y-s.y)*input.height<length*.6;
    if(ok&&['seatedThigh','seatedCalf'].includes(config.guard||''))ok=visible(knee)&&Math.abs((knee.y-h.y)*input.height)<Math.abs((knee.x-h.x)*input.width)*1.3;
    if(ok&&['standingThigh','standingCalf'].includes(config.guard||''))ok=visible(knee)&&(knee.y-h.y)*input.height>Math.abs((knee.x-h.x)*input.width)*1.3;
    if(ok&&config.profile==='ankle'){
     const kneeAngle=projectedAngle(pose,[23+o,25+o,27+o],input),heel=pose[29+o],toe=pose[31+o];
     ok=Number.isFinite(kneeAngle)&&(config.guard==='standingCalf'?kneeAngle>=145:kneeAngle>=55&&kneeAngle<=125)&&Math.hypot((heel.x-toe.x)*input.width,(heel.y-toe.y)*input.height)>input.height*.025;
    }
   }
   if(!ok){reasons.set(frame.time,'The required joints, camera view or selected movement setup were not clear. '+config.camera);for(const j of joints)if(pose[j+o])pose[j+o].visibility=0;}
  }
  return {...frame,poses:[pose]};
 })};
 // Track one side for the whole set, preferring the limb with measurable excursion.
 const range=(o:number)=>{const ids=triples[config.profile].map(j=>j+o);const a=filtered.frames.flatMap(f=>f.poses.length===1&&ids.every(j=>visible(f.poses[0][j]))?[projectedAngle(f.poses[0],ids,input)]:[]).filter(Number.isFinite).sort((a,b)=>a-b);return a.length<8?-1:a[Math.floor((a.length-1)*.9)]-a[Math.floor((a.length-1)*.1)];};
 const side=range(1)>range(0)?1:0;
 for(const f of filtered.frames)if(f.poses.length===1)for(const j of joints)if(f.poses[0][j+1-side])f.poses[0][j+1-side].visibility=0;
 const result=analyzeGenericMotion(filtered,config.profile,name,Math.min(20,config.minimumRange));
 result.frames.forEach(f=>{if(!f.valid&&reasons.has(f.time))f.reason=reasons.get(f.time)});
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
 if(config.profile==='ankle')result.observations.push({id:'foot-visibility',title:'Foot-landmark estimate',detail:'Counted visible ankle-angle cycles with the requested knee setup. Shoe shape, toe visibility and camera height can change this estimate; heel-rise height and calf activation are not measured.',repIndexes:reps.map(r=>r.index),tone:'neutral'});
 return result;
}
