import type {KinematicSample} from './feedback-kinematics';
import type {FormCheck,FormFeedbackCard} from './form-feedback';
import type {SquatRep} from './types';

// These thresholds nominate a visible pattern for coaching. They are not
// physiological limits or learned/validated classifications of good/bad form.
const LIMITS={uprightLean:20,uprightKnee:150,lean:35,hipFlexion:40,maxKneeFlexion:45,maxThighTilt:30,persistence:.3,minimumExcursion:.7,maximumExcursion:12,maximumGap:.25};
const finite=Number.isFinite;
const reliable=(s:KinematicSample)=>[s.metric,s.kinematics.lean,s.kinematics.hipAngle,s.kinematics.thighTilt].every(v=>typeof v==='number'&&finite(v));
const upright=(s:KinematicSample)=>s.kinematics.lean!<=LIMITS.uprightLean&&s.metric>=LIMITS.uprightKnee;
const hingePattern=(s:KinematicSample)=>s.kinematics.lean!>=LIMITS.lean&&180-s.kinematics.hipAngle!>=LIMITS.hipFlexion&&180-s.metric<LIMITS.maxKneeFlexion&&s.kinematics.thighTilt!<LIMITS.maxThighTilt;

/** Review hip-led attempts independently of the knee-depth rep counter.
 * Use one continuous side only, require upright references before and after,
 * and evaluate the ENTIRE excursion so an ordinary early squat descent cannot
 * trigger a correction if it subsequently bends the knees further.
 */
export function squatCoaching(segments:KinematicSample[][],reps:SquatRep[]=[]):{cards:FormFeedbackCard[];checks:FormCheck[];attempts:number}{
  const check:FormCheck={id:'squat-knee-participation',label:'Knee bend versus hip folding',status:'unable',detail:'Need a continuous side view of shoulders, hips, knees and ankles, including an upright position before and after the movement. Full-depth counted reps are not required.'};
  const stance:FormCheck={id:'squat-stance-width',label:'Stance width and knee direction',status:'unsupported',detail:'This side-view check does not measure stance width or knees tracking toward the toes. A front or oblique view of both feet is needed for a separate stance assessment; it cannot label your stance too narrow.'};
  const candidates:Array<{window:KinematicSample[];hits:Array<{time:number;end:number;sample:KinematicSample}>;attempts:number}>=[];
  for(const samples of segments){
    let top:KinematicSample[]=[];let moving:KinematicSample[]|undefined;let returning:KinematicSample[]=[];let last=-Infinity;
    const hits:Array<{time:number;end:number;sample:KinematicSample}>=[];let attempts=0;
    for(const sample of samples){
      if(!reliable(sample)||sample.time<=last||sample.time-last>LIMITS.maximumGap){top=[];moving=undefined;returning=[];}
      last=sample.time;
      if(!reliable(sample))continue;
      if(!moving){
        if(upright(sample)){top.push(sample);continue;}
        if(top.length>=2&&top.at(-1)!.time-top[0].time>=.1-1e-7)moving=[top.at(-1)!,sample];
        top=[];continue;
      }
      moving.push(sample);
      if(sample.time-moving[0].time>LIMITS.maximumExcursion){moving=undefined;top=[];returning=[];continue;}
      if(!upright(sample)){returning=[];continue;}
      returning.push(sample);
      if(returning.length<2||returning.at(-1)!.time-returning[0].time<.1-1e-7)continue;
      const excursion=moving;moving=undefined;top=[...returning];returning=[];
      if(excursion.at(-1)!.time-excursion[0].time<LIMITS.minimumExcursion)continue;
      const leans=excursion.map(s=>s.kinematics.lean!);
      if(Math.max(...leans)-Math.min(...leans)<20)continue;
      attempts++;
      // Reject a false early-descent finding if deeper knee/thigh motion occurs
      // anywhere in this same movement, not just the nominated review window.
      if(excursion.some(s=>180-s.metric>=LIMITS.maxKneeFlexion||s.kinematics.thighTilt!>=LIMITS.maxThighTilt))continue;
      let start:KinematicSample|undefined;
      for(const s of excursion){
        if(!hingePattern(s)){start=undefined;continue;}
        start??=s;
        if(s.time-start.time>=LIMITS.persistence-1e-7){hits.push({time:start.time,end:excursion.at(-1)!.time,sample:start});break;}
      }
    }
    candidates.push({window:samples,hits,attempts});
  }
  // Do not pool left/right duplicates or disconnected fragments into a pattern.
  const selected=candidates.sort((a,b)=>b.attempts-a.attempts||b.window.length-a.window.length)[0];
  if(!selected?.attempts)return {cards:[],checks:[check,stance],attempts:0};
  check.status='not_detected';check.detail=`Reviewed ${selected.attempts} continuous hip-motion ${selected.attempts===1?'attempt':'attempts'}. No sustained combination of forward torso lean and limited knee bend met this check’s threshold. This is not an overall form pass.`;
  if(!selected.hits.length)return {cards:[],checks:[check,stance],attempts:selected.attempts};
  const hit=selected.hits[0],count=selected.hits.length,offset=hit.sample.side==='right'?1:0;
  const card:FormFeedbackCard={id:check.id,kind:'technique',title:'Bend your knees more as you lower',
    observed:`For the squat you selected, the visible movement is too hip-dominant: your torso folds forward while your knees bend only a little and your thighs stay fairly upright. ${count===1?'I found this in one continuous movement attempt; it is not a judgment of every rep.':`I found this in ${count} continuous movement attempts.`}`,
    action:'Start without extra weight. Bend your knees and hips together, lower your hips between your feet, and allow your knees to travel forward naturally while keeping your whole foot settled. Use a comfortable range; do not force depth.',
    cue:'Bend the knees and lower the hips, instead of only folding forward.',
    steps:['Stand comfortably and keep your whole foot on the floor.','Bend knees and hips together; let the knees move forward as the hips lower.','Stand back up, then film 2–3 controlled attempts to compare the movement.'],
    experiment:'If lowering feels cramped, try a slightly wider comfortable stance with a small toe turn-out. This is an optional setup experiment, not a finding that your current stance is too narrow.',
    biomechanics:'A squat combines knee and hip flexion. Restricting forward knee movement can shift the movement toward the hips and torso. Some forward lean is normal and depends on your proportions and squat variation.',
    why:'This judgment combines limited knee bend, fairly upright thighs and sustained torso folding across a movement that returns upright. Forward lean alone does not trigger it. It applies to a squat goal, not an intentional Romanian deadlift or good morning.',
    time:hit.time,repIndexes:reps.filter(r=>selected.hits.some(h=>r.side===h.sample.side&&h.time>=r.start&&h.time<=r.end)).map(r=>r.index),highlight:{side:hit.sample.side,joints:[11,23,25,27].map(id=>id+offset)}};
  check.status='finding';check.detail=card.observed;check.cardId=card.id;
  return {cards:[card],checks:[check,stance],attempts:selected.attempts};
}
