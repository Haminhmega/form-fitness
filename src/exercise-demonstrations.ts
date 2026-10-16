import type {Exercise} from './types';
import {additionalDemonstrations,additionalDemoKeys} from './exercise-demo-data';
export type P=[number,number];
export type Pose={head:P;shoulder:P;hip:P;knee:P;ankle:P;elbow:P;hand:P;farKnee?:P;farAnkle?:P;farElbow?:P;farHand?:P};
export type Demo={title:string;start:string;finish:string;cues:string[];poses:[Pose,Pose];bench?:boolean;floor?:boolean;dumbbells?:boolean;view:string;support?:"flat"|"incline"|"hip"|"seat"|"chest-pad"|"wall"|"raised";equipment?:"barbell-back"|"barbell-hand"|"barbell-hip"|"cable-high"|"machine-press"|"machine-row"|"lat-pull"|"leg-extension"|"leg-curl"|"leg-press";weightStyle?:"neutral"|"goblet";fixedKnees?:boolean;fixedElbows?:boolean;fixedShoulder?:boolean;front?:boolean};
export const demos:Record<string,Demo>={
 squat:{title:'Bodyweight squat',view:'Side view',start:'Stand tall',finish:'Sit between your hips',cues:['Whole foot stays grounded','Knees follow the toes','Return to the same standing position'],poses:[
 {head:[199,51],shoulder:[205,83],hip:[210,174],knee:[201,232],ankle:[200,290],elbow:[158,102],hand:[113,110]},
 {head:[157,125],shoulder:[182,148],hip:[241,217],knee:[175,239],ankle:[200,290],elbow:[137,148],hand:[94,160]}]},
 row:{title:'Bench-supported single-arm dumbbell row',view:'Working-arm side',bench:true,dumbbells:true,start:'Let the working arm lengthen',finish:'Pull elbow toward your hip',cues:['One hand and knee stay on the bench','Keep your torso steady','Lower the dumbbell with control'],poses:[
 {head:[153,80],shoulder:[174,106],hip:[279,129],knee:[304,209],ankle:[323,290],elbow:[177,162],hand:[178,218],farElbow:[154,148],farHand:[144,196],farKnee:[234,193],farAnkle:[307,204]},
 {head:[153,80],shoulder:[174,106],hip:[279,129],knee:[304,209],ankle:[323,290],elbow:[231,113],hand:[218,167],farElbow:[154,148],farHand:[144,196],farKnee:[234,193],farAnkle:[307,204]}]},
 pushup:{title:'Standard floor push-up',view:'Side view',floor:true,start:'Straight-arm plank',finish:'Lower chest toward the floor',cues:['Hands and toes remain planted','Head, hips and heels move together','Press back up without sagging'],poses:[
 {head:[93,154],shoulder:[130,169],hip:[247,209],knee:[321,242],ankle:[386,280],elbow:[128,224],hand:[125,285]},
 {head:[91,218],shoulder:[132,228],hip:[254,251],knee:[327,267],ankle:[386,280],elbow:[189,239],hand:[125,285]}]},
 curl:{title:'Standing dumbbell biceps curl',view:'Side view',dumbbells:true,start:'Arms long at your sides',finish:'Bend the elbows',cues:['Upper arms stay beside your torso','Keep the wrists aligned','No torso swing'],poses:[
 {head:[204,53],shoulder:[204,91],hip:[208,181],knee:[203,239],ankle:[203,290],elbow:[206,156],hand:[218,222]},
 {head:[204,53],shoulder:[204,91],hip:[208,181],knee:[203,239],ankle:[203,290],elbow:[206,156],hand:[253,107]}]},
 press:{title:'Seated dumbbell shoulder press',view:'Side view',bench:true,dumbbells:true,start:'Dumbbell at shoulder level',finish:'Press overhead',cues:['Feet stay supported on the floor','Keep ribs over the pelvis','Lower through a comfortable range'],poses:[
 {head:[219,80],shoulder:[219,113],hip:[228,186],knee:[159,222],ankle:[145,290],elbow:[255,147],hand:[267,92]},
 {head:[219,80],shoulder:[219,113],hip:[228,186],knee:[159,222],ankle:[145,290],elbow:[229,64],hand:[239,18]}]},
 rdl:{title:'Dumbbell Romanian deadlift',view:'Side view',dumbbells:true,start:'Stand with soft knees',finish:'Hinge the hips backward',cues:['Keep dumbbells close to your legs','Maintain a long spine','Stand by extending the hips'],poses:[
 {head:[202,51],shoulder:[211,88],hip:[220,180],knee:[202,239],ankle:[202,290],elbow:[205,149],hand:[199,208]},
 {head:[105,127],shoulder:[139,148],hip:[244,190],knee:[220,236],ankle:[202,290],elbow:[158,208],hand:[196,265]}]},
 'glute-bridge':{title:'Bodyweight glute bridge',view:'Side view',floor:true,start:'Hips on the floor',finish:'Lift the hips',cues:['Keep feet and shoulders grounded','Finish with hips extended','Avoid arching the lower back'],poses:[
 {head:[83,284],shoulder:[121,279],hip:[237,279],knee:[285,213],ankle:[335,290],elbow:[166,285],hand:[202,288]},
 {head:[83,284],shoulder:[121,279],hip:[218,222],knee:[285,205],ankle:[335,290],elbow:[166,285],hand:[202,288]}]},
 plank:{title:'Forearm plank',view:'Side view',floor:true,start:'Set your forearms and toes',finish:'Hold a steady body line',cues:['Elbows beneath shoulders','Breathe throughout the hold','Stop when you cannot maintain position'],poses:[
 {head:[111,210],shoulder:[143,227],hip:[250,248],knee:[320,265],ankle:[383,284],elbow:[142,281],hand:[89,286]},
 {head:[111,210],shoulder:[143,227],hip:[250,248],knee:[320,265],ankle:[383,284],elbow:[142,281],hand:[89,286]}]},
 'reverse-lunge':{title:'Bodyweight reverse lunge',view:'Side view',start:'Stand tall',finish:'Step back and lower',cues:['Keep the front foot grounded','Lower both knees with control','Push through the front foot to return'],poses:[
 {head:[198,53],shoulder:[206,90],hip:[211,180],knee:[205,237],ankle:[206,290],elbow:[185,144],hand:[156,160],farKnee:[220,235],farAnkle:[221,290]},
 {head:[197,92],shoulder:[205,130],hip:[222,215],knee:[153,220],ankle:[155,290],elbow:[184,166],hand:[154,178],farKnee:[291,280],farAnkle:[300,290]}]},
 'hip-abduction':{title:'Side-lying hip abduction',view:'Front of body',floor:true,start:'Stack hips and legs',finish:'Raise the top leg',cues:['Keep pelvis stacked','Lift without rolling backward','Lower the leg slowly'],poses:[
 {head:[90,246],shoulder:[125,260],hip:[231,275],knee:[314,280],ankle:[397,285],elbow:[104,280],hand:[82,267],farKnee:[303,290],farAnkle:[380,296]},
 {head:[90,246],shoulder:[125,260],hip:[231,275],knee:[294,222],ankle:[356,170],elbow:[104,280],hand:[82,267],farKnee:[303,290],farAnkle:[380,296]}]}
};
Object.assign(demos, additionalDemonstrations(demos));
demos.curl.fixedElbows=true;
demos['glute-bridge'].fixedShoulder=true;
const exactNames:Record<string,string>={
 'bodyweight squat':'squat','single-arm dumbbell row':'row','single arm dumbbell row':'row',
 'push-up':'pushup','standing biceps curl':'curl','dumbbell romanian deadlift':'rdl',
 'forearm plank':'plank','dumbbell shoulder press':'press','glute bridge':'glute-bridge',
 'reverse lunge':'reverse-lunge','side-lying hip abduction':'hip-abduction',
 'pushups':'pushup','elbow plank':'plank','one-arm dumbbell row':'row',
 'seated dumbbell shoulder press':'press'
};
export function demonstrationKey(exercise:Exercise){
 if(exercise.custom)return undefined;
 const exact=additionalDemoKeys[exercise.id];
 if(exact)return exact.equipment===exercise.equipment?exact.key:undefined;
 const key=exactNames[exercise.name.toLowerCase().trim()];
 if(!key)return undefined;
 const weighted=['row','curl','press','rdl'].includes(key);
 if(weighted&&!/dumbbell/i.test(exercise.equipment))return undefined;
 if(!weighted&&exercise.equipment!=='Bodyweight')return undefined;
 if(key==='row'&&!/bench.supported/i.test(exercise.variation)&&!['row','gym-1669-one-arm-dumbbell-row'].includes(exercise.id))return undefined;
 if(key==='press'&&!/seated/i.test(exercise.variation)&&!['press','gym-2534-seated-dumbbell-shoulder-press'].includes(exercise.id))return undefined;
 return key;
}

export const distance=(a:P,b:P)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export const mix=(a:P,b:P,t:number):P=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
const lengthen=(start:P,end:P,length:number):P=>{const scale=length/Math.max(.001,distance(start,end));return [start[0]+(end[0]-start[0])*scale,start[1]+(end[1]-start[1])*scale]};

// Solve a two-bone chain instead of blending the joint coordinates. The upper
// and lower limb keep their lengths as the hand or foot follows its path.
function articulatedJoint(root:P,target:P,upper:number,lower:number,bend:number):{joint:P;end:P}{
 const separation=Math.max(.001,Math.min(upper+lower-.001,Math.max(Math.abs(upper-lower)+.001,distance(root,target))));
 const end=lengthen(root,target,separation),dx=(end[0]-root[0])/separation,dy=(end[1]-root[1])/separation;
 const along=(upper*upper-lower*lower+separation*separation)/(2*separation),height=Math.sqrt(Math.max(0,upper*upper-along*along));
 const left:P=[root[0]+dx*along-dy*height,root[1]+dy*along+dx*height];
 const right:P=[root[0]+dx*along+dy*height,root[1]+dy*along-dx*height];
 return {joint:bend>=0?left:right,end};
}

export function demonstrationPose(exercise:Exercise,progress:number):Pose|undefined{
 const key=demonstrationKey(exercise),demo=key?demos[key]:undefined;
 if(!demo)return undefined;
 const position=Number.isFinite(progress)?Math.max(0,Math.min(1,progress)):0;
 const phase=position*position*(3-2*position);
 const [start,finish]=demo.poses;
 const pose=Object.fromEntries(Object.entries(start).map(([part,point])=>[part,mix(point as P,finish[part as keyof Pose]||point,phase)])) as Pose;
 const headOffset:P=[pose.head[0]-pose.shoulder[0],pose.head[1]-pose.shoulder[1]];
 const torsoLength=distance(start.hip,start.shoulder);
 const straightBody=['incline-pushup','wall-pushup','pushup','plank'].includes(key!);
 if(straightBody){
  const thigh=distance(start.hip,start.knee),shin=distance(start.knee,start.ankle);
  pose.shoulder=lengthen(pose.ankle,pose.shoulder,torsoLength+thigh+shin);
  pose.hip=lengthen(pose.shoulder,pose.ankle,torsoLength);
  pose.knee=lengthen(pose.hip,pose.ankle,thigh);
 }else if(demo.fixedShoulder)pose.hip=lengthen(pose.shoulder,pose.hip,torsoLength);
 else pose.shoulder=lengthen(pose.hip,pose.shoulder,torsoLength);
 pose.head=[pose.shoulder[0]+headOffset[0],pose.shoulder[1]+headOffset[1]];
 for(const [rootKey,jointKey,endKey] of [['hip','knee','ankle'],['shoulder','elbow','hand'],['hip','farKnee','farAnkle'],['shoulder','farElbow','farHand']] as const){
  if(!start[jointKey]||!start[endKey]||!finish[jointKey]||!finish[endKey])continue;
  if(straightBody&&jointKey==='knee')continue;
  const upper=distance(start[rootKey],start[jointKey]!);
  const lower=distance(start[jointKey]!,start[endKey]!);
  if((demo.fixedKnees&&jointKey==='knee')||(demo.fixedElbows&&jointKey==='elbow')){
   const pivot=start[jointKey]!;
   const angle=(point:P)=>Math.atan2(point[1]-pivot[1],point[0]-pivot[0]);
   const from=angle(start[endKey]!),to=angle(finish[endKey]!);
   const delta=Math.atan2(Math.sin(to-from),Math.cos(to-from));
   pose[jointKey]=[...pivot];
   pose[endKey]=[pivot[0]+Math.cos(from+delta*phase)*lower,pivot[1]+Math.sin(from+delta*phase)*lower];
   continue;
  }
  if(key==='hip-abduction'&&jointKey==='knee')pose.ankle=lengthen(pose.hip,pose.ankle,upper+lower-.001);
  const bendAt=(reference:Pose)=>{const root=reference[rootKey],joint=reference[jointKey]!,end=reference[endKey]!;return ((end[0]-root[0])*(joint[1]-root[1])-(end[1]-root[1])*(joint[0]-root[0]))/Math.max(1,distance(root,end))};
  const startBend=bendAt(start),finishBend=bendAt(finish);
  // Keep a consistent bend side across the movement. A near-straight source
  // pose must not flip the elbow or knee to the other IK solution mid-rep.
  const bend=key==='squat'&&rootKey==='shoulder'?-1:Math.abs(startBend)>Math.abs(finishBend)?startBend:finishBend;
  const solved=articulatedJoint(pose[rootKey],pose[endKey]!,upper,lower,bend);
  pose[jointKey]=solved.joint;pose[endKey]=solved.end;
 }
 return pose;
}

