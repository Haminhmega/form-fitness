import {useEffect,useState} from 'react';
import type {Exercise} from './types';
import {Pause,Play} from 'lucide-react';
import './exercise-demo.css';
type P=[number,number];
type Pose={head:P;shoulder:P;hip:P;knee:P;ankle:P;elbow:P;hand:P;farKnee?:P;farAnkle?:P;farElbow?:P;farHand?:P};
type Demo={title:string;start:string;finish:string;cues:string[];poses:[Pose,Pose];bench?:boolean;floor?:boolean;dumbbells?:boolean;view:string};
const demos:Record<string,Demo>={
 squat:{title:'Bodyweight squat',view:'Side view',start:'Stand tall',finish:'Sit between your hips',cues:['Whole foot stays grounded','Knees follow the toes','Return to the same standing position'],poses:[
 {head:[187,65],shoulder:[195,101],hip:[205,182],knee:[201,237],ankle:[200,290],elbow:[151,111],hand:[111,113]},
 {head:[155,112],shoulder:[177,141],hip:[250,209],knee:[175,239],ankle:[200,290],elbow:[133,139],hand:[91,142]}]},
 row:{title:'Bench-supported single-arm dumbbell row',view:'Working-arm side',bench:true,dumbbells:true,start:'Let the working arm lengthen',finish:'Pull elbow toward your hip',cues:['One hand and knee stay on the bench','Keep your torso steady','Lower the dumbbell with control'],poses:[
 {head:[124,75],shoulder:[158,105],hip:[283,130],knee:[313,221],ankle:[340,290],elbow:[171,171],hand:[174,240],farElbow:[146,145],farHand:[144,184],farKnee:[246,178],farAnkle:[288,180]},
 {head:[124,75],shoulder:[158,105],hip:[283,130],knee:[313,221],ankle:[340,290],elbow:[239,104],hand:[228,160],farElbow:[146,145],farHand:[144,184],farKnee:[246,178],farAnkle:[288,180]}]},
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
 {head:[100,172],shoulder:[136,190],hip:[250,218],knee:[321,250],ankle:[381,283],elbow:[137,283],hand:[88,286]},
 {head:[100,172],shoulder:[136,190],hip:[250,218],knee:[321,250],ankle:[381,283],elbow:[137,283],hand:[88,286]}]},
 'reverse-lunge':{title:'Bodyweight reverse lunge',view:'Side view',start:'Stand tall',finish:'Step back and lower',cues:['Keep the front foot grounded','Lower both knees with control','Push through the front foot to return'],poses:[
 {head:[198,53],shoulder:[206,90],hip:[211,180],knee:[205,237],ankle:[206,290],elbow:[185,144],hand:[156,160],farKnee:[220,235],farAnkle:[221,290]},
 {head:[197,92],shoulder:[205,130],hip:[222,215],knee:[153,220],ankle:[155,290],elbow:[184,166],hand:[154,178],farKnee:[291,280],farAnkle:[352,290]}]},
 'hip-abduction':{title:'Side-lying hip abduction',view:'Front of body',floor:true,start:'Stack hips and legs',finish:'Raise the top leg',cues:['Keep pelvis stacked','Lift without rolling backward','Lower the leg slowly'],poses:[
 {head:[90,246],shoulder:[125,260],hip:[231,275],knee:[307,280],ankle:[383,285],elbow:[104,280],hand:[82,267],farKnee:[303,290],farAnkle:[380,296]},
 {head:[90,246],shoulder:[125,260],hip:[231,275],knee:[294,222],ankle:[356,170],elbow:[104,280],hand:[82,267],farKnee:[303,290],farAnkle:[380,296]}]}
};
const exactNames:Record<string,string>={
 'bodyweight squat':'squat','single-arm dumbbell row':'row','single arm dumbbell row':'row',
 'push-up':'pushup','standing biceps curl':'curl','dumbbell romanian deadlift':'rdl',
 'forearm plank':'plank','dumbbell shoulder press':'press','glute bridge':'glute-bridge',
 'reverse lunge':'reverse-lunge','side-lying hip abduction':'hip-abduction'
};
export function demonstrationKey(exercise:Exercise){
 if(exercise.custom)return undefined;
 const key=exactNames[exercise.name.toLowerCase().trim()];
 if(!key)return undefined;
 const weighted=['row','curl','press','rdl'].includes(key);
 if(weighted&&!/dumbbell/i.test(exercise.equipment))return undefined;
 if(!weighted&&exercise.equipment!=='Bodyweight')return undefined;
 if(key==='row'&&!/bench.supported/i.test(exercise.variation)&&exercise.id!=='row')return undefined;
 if(key==='press'&&!/seated/i.test(exercise.variation)&&exercise.id!=='press')return undefined;
 return key;
}
export function ExerciseDemo({exercise}:{exercise:Exercise}){
 const key=demonstrationKey(exercise),demo=key?demos[key]:undefined;
 const [phase,setPhase]=useState(0),[playing,setPlaying]=useState(false);
 useEffect(()=>{setPhase(0);setPlaying(false)},[exercise.id]);
 useEffect(()=>{
  if(!playing)return;
  let frame=0;const started=performance.now();
  const tick=(now:number)=>{setPhase((1-Math.cos((now-started)/2400*Math.PI*2))/2);frame=requestAnimationFrame(tick)};
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
 },[playing]);
 if(!demo)return <div className="exercise-demo-empty"><span className="eyebrow">MOVEMENT REFERENCE</span><h3>{exercise.name}</h3><p>A matching demonstration for this exact variation is not available yet.</p><p>Use the movement instructions below. No substitute exercise is shown.</p></div>;
 const pose=Object.fromEntries(Object.entries(demo.poses[0]).map(([part,start])=>{
  const end=demo.poses[1][part as keyof Pose]||start;
  return [part,[(start as P)[0]+(end[0]-(start as P)[0])*phase,(start as P)[1]+(end[1]-(start as P)[1])*phase]];
 })) as Pose;
 const line=(parts:P[],kind='')=><polyline className={'demo-limb '+kind} points={parts.map(p=>p.join(',')).join(' ')}/>;
 const hand=pose.hand;
 return <figure className="exercise-demo"><div className="demo-title"><strong>{demo.title}</strong><span>{demo.view}</span></div>
 <svg viewBox="0 0 440 330" role="img" aria-label={demo.title+': '+(phase<.5?demo.start:demo.finish)}>
 <defs><linearGradient id={'body-'+exercise.id} x1="0" x2="1"><stop stopColor="#adc9ac"/><stop offset="1" stopColor="#e4edda"/></linearGradient></defs>
 <path d="M35 303 H410" className="demo-floor"/>{demo.bench&&<g className="demo-bench"><rect x="124" y="187" width="184" height="15" rx="5"/><path d="M145 202V296M284 202V296M132 298H158M271 298H297"/></g>}
 {pose.farKnee&&line([pose.hip,pose.farKnee,pose.farAnkle!],'far')}{pose.farHand&&line([pose.shoulder,pose.farElbow!,pose.farHand],'far')}
 {line([pose.hip,pose.knee,pose.ankle],'leg')}{line([pose.shoulder,pose.hip],'torso')}
 {line([pose.shoulder,pose.elbow,pose.hand],'arm')}
 <path d={'M'+pose.shoulder.join(' ')+' L'+pose.head.join(' ')} className="demo-neck"/>
 <ellipse cx={pose.head[0]} cy={pose.head[1]} rx="15" ry="19" className="demo-head"/>
 <path d={'M'+(pose.ankle[0]-8)+' '+(pose.ankle[1]+5)+'h25'} className="demo-shoe"/>
 {pose.farAnkle&&<path d={'M'+(pose.farAnkle[0]-8)+' '+(pose.farAnkle[1]+5)+'h25'} className="demo-shoe far"/>}
 {demo.dumbbells&&<g transform={'translate('+hand.join(' ')+')'} className="demo-dumbbell"><path d="M-20 0H20"/><rect x="-28" y="-12" width="12" height="24" rx="3"/><rect x="16" y="-12" width="12" height="24" rx="3"/></g>}
 {[pose.shoulder,pose.hip,pose.knee,pose.elbow].map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r="4" className="demo-joint"/>)}
 </svg>
 <div className="demo-phase-controls"><button type="button" aria-pressed={!playing&&phase===0} onClick={()=>{setPlaying(false);setPhase(0)}}>1 · {demo.start}</button><button type="button" aria-pressed={!playing&&phase===1} onClick={()=>{setPlaying(false);setPhase(1)}}>2 · {demo.finish}</button></div>
 {key!=='plank'&&<button type="button" className="btn secondary demo-play" onClick={()=>setPlaying(!playing)}>{playing?<Pause size={16}/>:<Play size={16}/>} {playing?'Pause demonstration':'Play movement'}</button>}
 <figcaption><ul>{demo.cues.map(cue=><li key={cue}>{cue}</li>)}</ul><small>Movement illustration · demonstrates the named variation, not a measurement of your technique.</small></figcaption>
 </figure>;
}

