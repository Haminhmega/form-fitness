import {useEffect,useId,useRef,useState} from 'react';
import type {Exercise} from './types';
import {Pause,Play} from 'lucide-react';
import './exercise-demo.css';
type P=[number,number];
type Pose={head:P;shoulder:P;hip:P;knee:P;ankle:P;elbow:P;hand:P;farKnee?:P;farAnkle?:P;farElbow?:P;farHand?:P};
type Demo={title:string;start:string;finish:string;cues:string[];poses:[Pose,Pose];bench?:boolean;floor?:boolean;dumbbells?:boolean;view:string};
const demos:Record<string,Demo>={
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
 {head:[105,127],shoulder:[139,148],hip:[265,180],knee:[220,236],ankle:[202,290],elbow:[158,208],hand:[176,265]}]},
 'glute-bridge':{title:'Bodyweight glute bridge',view:'Side view',floor:true,start:'Hips on the floor',finish:'Lift the hips',cues:['Keep feet and shoulders grounded','Finish with hips extended','Avoid arching the lower back'],poses:[
 {head:[83,264],shoulder:[121,271],hip:[237,279],knee:[285,213],ankle:[335,290],elbow:[166,285],hand:[202,288]},
 {head:[83,264],shoulder:[121,271],hip:[218,222],knee:[285,205],ankle:[335,290],elbow:[166,285],hand:[202,288]}]},
 plank:{title:'Forearm plank',view:'Side view',floor:true,start:'Set your forearms and toes',finish:'Hold a steady body line',cues:['Elbows beneath shoulders','Breathe throughout the hold','Stop when you cannot maintain position'],poses:[
 {head:[111,210],shoulder:[143,227],hip:[250,248],knee:[320,265],ankle:[383,284],elbow:[142,281],hand:[89,286]},
 {head:[111,210],shoulder:[143,227],hip:[250,248],knee:[320,265],ankle:[383,284],elbow:[142,281],hand:[89,286]}]},
 'reverse-lunge':{title:'Bodyweight reverse lunge',view:'Side view',start:'Stand tall',finish:'Step back and lower',cues:['Keep the front foot grounded','Lower both knees with control','Push through the front foot to return'],poses:[
 {head:[198,53],shoulder:[206,90],hip:[211,180],knee:[205,237],ankle:[206,290],elbow:[185,144],hand:[156,160],farKnee:[220,235],farAnkle:[221,290]},
 {head:[197,92],shoulder:[205,130],hip:[222,215],knee:[153,220],ankle:[155,290],elbow:[184,166],hand:[154,178],farKnee:[291,280],farAnkle:[352,290]}]},
 'hip-abduction':{title:'Side-lying hip abduction',view:'Front of body',floor:true,start:'Stack hips and legs',finish:'Raise the top leg',cues:['Keep pelvis stacked','Lift without rolling backward','Lower the leg slowly'],poses:[
 {head:[90,246],shoulder:[125,260],hip:[231,275],knee:[314,280],ankle:[397,285],elbow:[104,280],hand:[82,267],farKnee:[303,290],farAnkle:[380,296]},
 {head:[90,246],shoulder:[125,260],hip:[231,275],knee:[294,222],ankle:[356,170],elbow:[104,280],hand:[82,267],farKnee:[303,290],farAnkle:[380,296]}]}
};
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
 const key=exactNames[exercise.name.toLowerCase().trim()];
 if(!key)return undefined;
 const weighted=['row','curl','press','rdl'].includes(key);
 if(weighted&&!/dumbbell/i.test(exercise.equipment))return undefined;
 if(!weighted&&exercise.equipment!=='Bodyweight')return undefined;
 if(key==='row'&&!/bench.supported/i.test(exercise.variation)&&!['row','gym-1669-one-arm-dumbbell-row'].includes(exercise.id))return undefined;
 if(key==='press'&&!/seated/i.test(exercise.variation)&&!['press','gym-2534-seated-dumbbell-shoulder-press'].includes(exercise.id))return undefined;
 return key;
}

const distance=(a:P,b:P)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const mix=(a:P,b:P,t:number):P=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
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
 const phase=Number.isFinite(progress)?Math.max(0,Math.min(1,progress)):0;
 const [start,finish]=demo.poses;
 const pose=Object.fromEntries(Object.entries(start).map(([part,point])=>[part,mix(point as P,finish[part as keyof Pose]||point,phase)])) as Pose;
 const headOffset:P=[pose.head[0]-pose.shoulder[0],pose.head[1]-pose.shoulder[1]];
 pose.shoulder=lengthen(pose.hip,pose.shoulder,(distance(start.hip,start.shoulder)+distance(finish.hip,finish.shoulder))/2);
 pose.head=[pose.shoulder[0]+headOffset[0],pose.shoulder[1]+headOffset[1]];
 for(const [rootKey,jointKey,endKey] of [['hip','knee','ankle'],['shoulder','elbow','hand'],['hip','farKnee','farAnkle'],['shoulder','farElbow','farHand']] as const){
  if(!start[jointKey]||!start[endKey]||!finish[jointKey]||!finish[endKey])continue;
  const upper=Math.max(distance(start[rootKey],start[jointKey]!),distance(finish[rootKey],finish[jointKey]!));
  const lower=Math.max(distance(start[jointKey]!,start[endKey]!),distance(finish[jointKey]!,finish[endKey]!));
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

function segment(start:P,end:P,from:number,to:number){
 const length=Math.max(1,distance(start,end)),dx=(end[0]-start[0])/length,dy=(end[1]-start[1])/length,nx=-dy,ny=dx;
 const point=(p:P,width:number,along=0)=>`${p[0]+nx*width+dx*along},${p[1]+ny*width+dy*along}`;
 const middle=mix(start,end,.42);
 return `M${point(start,from)} Q${point(middle,(from+to)*.57)} ${point(end,to)} Q${point(end,0,to*.6)} ${point(end,-to)} Q${point(middle,-(from+to)*.57)} ${point(start,-from)} Q${point(start,0,-from*.5)} ${point(start,from)}Z`;
}

export function ExerciseDemo({exercise}:{exercise:Exercise}){
 const key=demonstrationKey(exercise),demo=key?demos[key]:undefined;
 const [phase,setPhase]=useState(0),[playing,setPlaying]=useState(false);
 const figureRef=useRef<HTMLElement|null>(null),phaseRef=useRef(phase);
 const paintId=useId().replace(/:/g,'');
 phaseRef.current=phase;
 const [reducedMotion,setReducedMotion]=useState(()=>typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{const query=window.matchMedia('(prefers-reduced-motion: reduce)');const change=()=>{setReducedMotion(query.matches);if(query.matches)setPlaying(false)};query.addEventListener('change',change);return()=>query.removeEventListener('change',change)},[]);
 useEffect(()=>{setPhase(0);setPlaying(false)},[exercise.id]);
 useEffect(()=>{const element=figureRef.current;if(!element)return;const observer=new IntersectionObserver(([entry])=>{if(!entry.isIntersecting)setPlaying(false)});observer.observe(element);const hide=()=>{if(document.hidden)setPlaying(false)};document.addEventListener('visibilitychange',hide);return()=>{observer.disconnect();document.removeEventListener('visibilitychange',hide)}},[key]);
 useEffect(()=>{
  if(!playing||reducedMotion)return;
  let frame=0,last=0;const started=performance.now(),offset=Math.acos(1-2*phaseRef.current);
  const tick=(now:number)=>{if(now-last>=1000/24){setPhase((1-Math.cos(offset+(now-started)/3600*Math.PI*2))/2);last=now}frame=requestAnimationFrame(tick)};
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
 },[playing,reducedMotion]);
 if(!demo)return <div className="exercise-demo-empty"><span className="eyebrow">MOVEMENT REFERENCE</span><h3>{exercise.name}</h3><p>A matching demonstration for this exact variation is not available yet.</p><p>Use the movement instructions below. No substitute exercise is shown.</p></div>;
 const pose=demonstrationPose(exercise,phase)!;
 const skin=`url(#${paintId}-skin)`,shirt=`url(#${paintId}-shirt)`,shorts=`url(#${paintId}-shorts)`;
 const facing=key==='curl'?1:-1;
 const shoe=(ankle:P,far=false)=><g className={`athlete-shoe${far?' far':''}`} transform={`translate(${ankle.join(' ')}) rotate(${key==='pushup'||key==='plank'?32:0}) scale(${demo.floor||key==='row'?1:facing} 1)`}><path d="M-9 3L-7-6 3-6 8 2 19 6Q24 8 22 12H-11Z" fill="#dce5df"/><path d="M-10 10H22V13H-10Z" fill="#9eada5"/><path d="M2 1L9 3M0 4L9 6" stroke="#6c7c74" strokeWidth="1.8"/><path d="M-8-3H0" stroke="#b8ec6e" strokeWidth="3"/></g>;
 const leg=(knee:P,ankle:P,far=false)=><g className={far?'athlete-far':'athlete-near'}><path d={segment(pose.hip,knee,17,10)} fill={skin}/><path d={segment(knee,ankle,10,5)} fill={skin}/><path d={segment(pose.hip,mix(pose.hip,knee,.57),19,15)} fill={shorts}/><path d={segment(mix(knee,ankle,.75),ankle,6,5)} fill="#d3ddd6"/>{shoe(ankle,far)}</g>;
 const dumbbell=(hand:P)=><g className="athlete-dumbbell" transform={`translate(${hand.join(' ')})`}><rect x="-23" y="-3" width="46" height="6" rx="2" fill="#b0beb7"/>{[-1,1].map(side=><g key={side} transform={`scale(${side} 1)`}><rect x="14" y="-13" width="10" height="26" rx="3" fill="#34413c"/><rect x="22" y="-10" width="7" height="20" rx="2" fill="#1c2822"/><path d="M17-9V9" stroke="#8b9e91" strokeWidth="2"/></g>)}</g>;
 const arm=(elbow:P,hand:P,far=false,hasWeight=false)=><g className={far?'athlete-far':'athlete-near'}><path d={segment(pose.shoulder,elbow,11,7)} fill={skin}/><path d={segment(elbow,hand,8,4.5)} fill={skin}/><path d={segment(pose.shoulder,mix(pose.shoulder,elbow,.35),12,10)} fill={shirt}/>{hasWeight&&dumbbell(hand)}<ellipse cx={hand[0]} cy={hand[1]} rx={hasWeight?5:6} ry={hasWeight?7:4.5} fill={skin}/></g>;
 const farKnee=pose.farKnee||[pose.knee[0]+10,pose.knee[1]] as P,farAnkle=pose.farAnkle||[pose.ankle[0]+13,pose.ankle[1]] as P;
 const farElbow=pose.farElbow||[pose.elbow[0]+8,pose.elbow[1]+2] as P,farHand=pose.farHand||[pose.hand[0]+9,pose.hand[1]+2] as P;
 const headTilt=key==='squat'?-8*phase:['curl','press','reverse-lunge'].includes(key||'')?0:Math.atan2(pose.shoulder[1]-pose.head[1],pose.shoulder[0]-pose.head[0])*180/Math.PI-90;
 return <figure className="exercise-demo" ref={figureRef}><div className="demo-title"><strong>{demo.title}</strong><span>{demo.view}</span></div>
 <div className="demo-stage"><svg viewBox="0 -14 440 344" role="img" aria-label={demo.title+': '+demo.start+'; '+demo.finish}>
 <defs>
  <linearGradient id={`${paintId}-skin`} x1="0" x2="1"><stop stopColor="#a97758"/><stop offset=".42" stopColor="#d9ae88"/><stop offset="1" stopColor="#c69670"/></linearGradient>
  <linearGradient id={`${paintId}-shirt`} x1="0" x2="1"><stop stopColor="#4a665b"/><stop offset=".5" stopColor="#789583"/><stop offset="1" stopColor="#496657"/></linearGradient>
  <linearGradient id={`${paintId}-shorts`} x1="0" x2="1"><stop stopColor="#243b36"/><stop offset=".6" stopColor="#3a564c"/><stop offset="1" stopColor="#20352f"/></linearGradient>
  <pattern id={`${paintId}-grid`} width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#b9d0b7" strokeOpacity=".035" strokeWidth="1"/></pattern>
 </defs>
 <rect x="0" y="-14" width="440" height="344" fill={`url(#${paintId}-grid)`}/>
 <ellipse cx="225" cy="307" rx={demo.floor?174:113} ry="7" fill="#08100c" opacity=".6"/>
 {demo.floor&&<path d="M56 300H397L415 306H43Z" fill="#354b3c" stroke="#71856b" strokeWidth=".6"/>}
 <path d="M24 310H419" className="demo-floor"/>
 {demo.bench&&<g className="athlete-bench">{key==='press'?<><path d="M198 206L184 297M252 206L270 297M172 298H200M257 298H284"/><rect x="169" y="192" width="108" height="16" rx="5"/><rect x="246" y="103" width="16" height="90" rx="7" transform="rotate(-4 254 190)"/></>:<><path d="M151 218L137 297M291 218L308 297M122 299H155M293 299H323M147 239H295"/><rect x="124" y="201" width="198" height="17" rx="5"/><path d="M133 207H313" className="bench-seam"/></>}</g>}
 {leg(farKnee,farAnkle,true)}
 {arm(farElbow,farHand,true,!!demo.dumbbells&&key!=='row')}
 <path d={segment(mix(pose.head,pose.shoulder,.5),pose.shoulder,7,9)} fill={skin}/>
 {leg(pose.knee,pose.ankle)}
 <path d={segment(pose.shoulder,pose.hip,19,15)} fill={shirt} className="athlete-shirt"/>
 <path d={segment(mix(pose.shoulder,pose.hip,.88),pose.hip,15,16)} fill={shorts}/>
 <path d={`M${mix(pose.shoulder,pose.hip,.22).join(',')}L${mix(pose.shoulder,pose.hip,.67).join(',')}`} stroke="#c2e5ba" strokeWidth="1.2" opacity=".3"/>
 <g transform={`translate(${pose.head.join(' ')}) rotate(${headTilt}) scale(${facing} 1)`} className="athlete-head"><path d="M-9-16C-1-22 12-17 13-8L17-1 13 2 12 10Q5 19-2 16Q-14 11-13-1Z" fill={skin}/><path d="M-13 1Q-17-13-8-19Q1-25 10-17L13-10 2-11-4-5-5 3Z" fill="#29352e"/><ellipse cx="-4" cy="2" rx="3" ry="4.5" fill="#c08f6e"/><path d="M8-5H11M9 8L12 7" stroke="#765745" strokeWidth="1.4" strokeLinecap="round"/></g>
 {arm(pose.elbow,pose.hand,false,!!demo.dumbbells)}
 </svg><span className="demo-stage-note">{key==='plank'?'HOLD POSITION':'CONTROLLED MOVEMENT'}</span></div>
 <div className="demo-phase-controls"><button type="button" aria-pressed={!playing&&phase===0} onClick={()=>{setPlaying(false);setPhase(0)}}>1 · {demo.start}</button><button type="button" aria-pressed={!playing&&phase===1} onClick={()=>{setPlaying(false);setPhase(1)}}>2 · {demo.finish}</button></div>
 {key!=='plank'&&<><label className="demo-scrub"><span>Explore the movement</span><output aria-hidden="true">{Math.round(phase*100)}%</output><input type="range" min="0" max="100" step="1" value={Math.round(phase*100)} aria-label="Movement position" aria-valuetext={`${Math.round(phase*100)} percent toward ${demo.finish.toLowerCase()}`} onChange={event=>{setPlaying(false);setPhase(Number(event.target.value)/100)}}/></label>{reducedMotion?<p className="small muted">Reduced motion is on. Use the position buttons or slider to explore this movement.</p>:<button type="button" className="btn secondary demo-play" onClick={()=>setPlaying(!playing)}>{playing?<Pause size={16}/>:<Play size={16}/>} {playing?'Pause demonstration':'Play movement'}</button>}</>}
 <figcaption><ul>{demo.cues.map(cue=><li key={cue}>{cue}</li>)}</ul><small>Movement illustration · demonstrates the named variation, not a measurement of your technique.</small></figcaption>
 </figure>;
}

