import type {Demo,Pose,P} from './exercise-demonstrations';
import {mix} from './exercise-demonstrations';

type Props={demo:Demo;pose:Pose;demoKey:string;phase:number};
const line=(a:P,b:P)=>`M${a.join(',')}L${b.join(',')}`;

function Equipment({demo,pose,demoKey}:Props){
 const pad=(x:number,y:number,w:number,h:number)=><rect className="demo-pad" x={x} y={y} width={w} height={h} rx="5"/>;
 const bench=(x:number,y:number,w:number)=><><path d={`M${x+15} ${y+13}V299M${x+w-15} ${y+13}V299M${x+2} 300H${x+29}M${x+w-29} 300H${x+w-2}`}/>{pad(x,y,w,13)}</>;
 const seat=demo.support==='seat'||demoKey==='press';
 return <g className="demo-equipment" aria-hidden="true">
  {demo.floor&&<path className="demo-mat" d="M48 300H397L414 307H31Z"/>}
  {demoKey==='row'&&bench(124,201,198)}
  {demo.support==='flat'&&bench(80,236,192)}
  {demo.support==='incline'&&<><path d="M178 182L157 299M254 240L281 299M148 300H175M270 300H295"/><path className="demo-pad-line" d="M160 152L233 235H271"/></>}
  {demo.support==='hip'&&bench(74,199,88)}
  {seat&&<>{bench(132,207,115)}{pad(239,89,14,118)}</>}
  {demo.support==='chest-pad'&&<>{bench(190,209,86)}<path d="M267 299V155"/>{pad(251,102,17,65)}</>}
  {demo.support==='wall'&&<><path className="demo-support-wall" d="M137 35V304"/><path className="demo-construction" d="M121 52L137 36M121 85L137 69M121 118L137 102M121 151L137 135M121 184L137 168M121 217L137 201M121 250L137 234M121 283L137 267"/></>}
  {demo.support==='raised'&&bench(72,253,100)}
  {demo.equipment==='lat-pull'&&<><path d="M83 300V18H177"/><circle cx="177" cy="18" r="7"/><path className="demo-cable" d={line([177,18],pose.hand)}/>{pad(142,193,62,12)}<path d="M153 205V224"/></>}
  {demo.equipment==='cable-high'&&<><path d="M87 300V28H126"/><circle cx="126" cy="28" r="7"/><path className="demo-cable" d={line([126,28],pose.hand)}/><path d="M74 300H108"/>{[0,1,2,3,4,5].map(i=><rect className="demo-stack" key={i} x="73" y={230+i*9} width="28" height="7" rx="2"/>)}</>}
  {demo.equipment==='machine-press'&&<><path d={`M310 300V59L${pose.hand[0]} ${pose.hand[1]}`}/><circle cx="310" cy="59" r="6"/></>}
  {demo.equipment==='machine-row'&&<><path d={`M371 300V189L${pose.hand[0]} ${pose.hand[1]}`}/><circle cx="371" cy="189" r="6"/></>}
  {demo.equipment==='leg-press'&&<><path d="M92 141L280 289M117 115L306 263M280 290H393"/><path className="demo-pad-line" d="M376 164L318 262L277 243"/><path d="M349 235V291"/></>}
  {demoKey==='calf-seated'&&<><path d="M116 296H169"/><path className="demo-pad-line" d={`M128 ${pose.knee[1]-14}H177`}/></>}
 </g>;
}

export function ExerciseFigure(props:Props){
 const {demo,pose:p,demoKey:key,phase}=props;
 const calf=key==='calf-standing'||key==='calf-seated';
 const foot=(ankle:P,far=false)=>{
  if(calf){
   const start=demo.poses[0].ankle,x=start[0]+(far?12:0),ground=start[1]+12;
   return <g><path className="demo-foot" d={`M${ankle[0]+6} ${ankle[1]-3}L${ankle[0]-5} ${ankle[1]-3}L${x-16} ${ground-8}L${x-25} ${ground-4}V${ground}H${x-11}L${ankle[0]+6} ${ankle[1]+10}Z`}/><path className="demo-sole" d={`M${x-25} ${ground}H${x-11}L${ankle[0]+6} ${ankle[1]+10}`}/></g>;
  }
  const pointing=key==='machine-row'||key==='leg-press'?1:-1;
  const angle=calf?phase*27:demo.floor&&key!=='glute-bridge'?24:key==='leg-extension'||key==='leg-curl'?-Math.atan2(p.ankle[0]-p.knee[0],p.ankle[1]-p.knee[1])*180/Math.PI:0;
  return <g transform={`translate(${ankle.join(' ')}) rotate(${angle}) scale(${pointing} 1)`}><path className={far?'demo-foot far':'demo-foot'} d="M-6-3H4L9 5 22 8Q26 9 24 12H-8Z"/><path d="M-7 12H24" className="demo-sole"/></g>;
 };
 const limb=(a:P,b:P,width:number)=><path d={line(a,b)} strokeWidth={width}/>;
 const leg=(knee:P,ankle:P,far=false)=><g className={far?'demo-body far':'demo-body'}>{limb(p.hip,knee,20)}{limb(knee,ankle,13)}<path className="demo-shorts" d={line(p.hip,mix(p.hip,knee,.48))} strokeWidth="24"/><circle cx={knee[0]} cy={knee[1]} r="6" className="demo-joint-cap"/>{foot(ankle,far)}</g>;
 const dumbbell=(hand:P)=><g className="demo-weight" transform={`translate(${hand.join(' ')}) rotate(${demo.weightStyle==='neutral'||demo.weightStyle==='goblet'?90:0})`}><path d="M-21 0H21"/>{[-1,1].map(side=><g key={side} transform={`scale(${side} 1)`}><rect x="13" y="-11" width="9" height="22" rx="2"/><rect x="22" y="-8" width="4" height="16" rx="1"/></g>)}</g>;
 const arm=(elbow:P,hand:P,far=false)=>{
  const root:P=demo.front?[p.shoulder[0]+(far?18:-18),p.shoulder[1]+3]:p.shoulder;
  return <g className={far&&!demo.front?'demo-body far':'demo-body'}>{limb(root,elbow,15)}{limb(elbow,hand,11)}<circle className="demo-joint-cap" cx={elbow[0]} cy={elbow[1]} r="4.5"/>{demo.dumbbells&&(!far||!['row','goblet-squat'].includes(key))&&dumbbell(hand)}<circle cx={hand[0]} cy={hand[1]} r="5.5" className="demo-hand"/></g>;
 };
 const farKnee=p.farKnee||[p.knee[0]+11,p.knee[1]] as P;
 const farAnkle=p.farAnkle||[p.ankle[0]+12,p.ankle[1]] as P;
 const farElbow=p.farElbow||[p.elbow[0]+9,p.elbow[1]] as P;
 const farHand=p.farHand||[p.hand[0]+9,p.hand[1]] as P;
 const tilt=Math.atan2(p.shoulder[0]-p.head[0],p.shoulder[1]-p.head[1])*-180/Math.PI;
 const bar=demo.equipment==='barbell-back'?p.shoulder:demo.equipment==='barbell-hip'?p.hip:p.hand;
 return <svg viewBox="0 -14 440 344" role="img" aria-label={demo.title+': '+demo.start+'; '+demo.finish}>
  <path className="demo-horizon" d="M26 303H414"/>
  <Equipment {...props}/>
  {leg(farKnee,farAnkle,true)}
  {arm(farElbow,farHand,true)}
  {leg(p.knee,p.ankle)}
  <path d={line(p.head,p.shoulder)} className="demo-neck"/>
  <path d={line(p.shoulder,p.hip)} className="demo-torso"/>
  <path d={line(mix(p.shoulder,p.hip,.2),mix(p.shoulder,p.hip,.74))} className="demo-torso-seam"/>
  <g transform={`translate(${p.head.join(' ')}) rotate(${tilt})`}><ellipse className="demo-face" rx="12" ry="17"/><path className="demo-face-line" d="M-8-5V4"/></g>
  {arm(p.elbow,p.hand)}
  {demo.equipment?.startsWith('barbell-')&&<g className="demo-barbell" transform={`translate(${bar.join(' ')})`}><path d="M-29 0H29"/><circle r={demo.equipment==='barbell-back'?17:20}/><circle r="6"/><path className="demo-plate-detail" d="M-11-9A14 14 0 0 1 11-9"/></g>}
  {['machine-press','machine-row','lat-pull','cable-high'].includes(demo.equipment||'')&&<path className="demo-handle" d={`M${p.hand[0]-10} ${p.hand[1]}H${p.hand[0]+10}`}/>}
  {['leg-extension','leg-curl'].includes(demo.equipment||'')&&<g className="demo-equipment"><path d={line(p.knee,p.ankle)}/><circle cx={p.knee[0]} cy={p.knee[1]} r="6"/><rect className="demo-pad" x={p.ankle[0]-12} y={p.ankle[1]-15} width="24" height="13" rx="5"/>{demo.equipment==='leg-curl'&&<path className="demo-pad-line" d="M160 197H197"/>}</g>}
  {demo.equipment==='leg-press'&&<path className="demo-footplate" d={`M${p.ankle[0]-20} ${p.ankle[1]+29}L${p.ankle[0]+21} ${p.ankle[1]-22}`}/>}
 </svg>;
}
