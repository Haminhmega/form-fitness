import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:"export * from './src/ai/specific-movements'; export {getAnalyzer,listAnalyzers} from './src/ai/registry';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false});
const {analyzeSpecificMovement,getAnalyzer,listAnalyzers}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const p=(x,y)=>({x,y,z:0,visibility:.99,presence:.99});
function pose(id,deg,active=0){
 const points=Array.from({length:33},()=>p(.5,.5));
 for(const o of [0,1]){
  const d=o===active||!['curl','row','pushup'].includes(id)?deg:160,r=d*Math.PI/180,dx=o*.025;
  let shoulder=p(.45+dx,.3),hip=p(.45+dx,.65),knee=p(.45+dx,.8),ankle=p(.45+dx,.94),elbow=p(.45+dx,.48),wrist=p(elbow.x+Math.sin(r)*.18,elbow.y-Math.cos(r)*.18);
  if(id==='row'){shoulder=p(.27+dx,.35);hip=p(.60+dx,.4);elbow=p(shoulder.x,.55);wrist=p(elbow.x+Math.sin(r)*.18,elbow.y-Math.cos(r)*.18);}
  if(id==='pushup'){shoulder=p(.25+dx,.42);hip=p(.55+dx,.58);ankle=p(.85+dx,.75);elbow=p(shoulder.x,.62);wrist=p(elbow.x+Math.sin(r)*.18,elbow.y-Math.cos(r)*.18);}
  if(id==='press'){elbow=p(shoulder.x+Math.sin(r)*.18,shoulder.y+Math.cos(r)*.18);wrist=p(elbow.x,elbow.y-.08);}
  if(id==='rdl'||id==='glute-bridge'){hip=p(.5+dx,.5);knee=p(.5+dx,.75);shoulder=p(hip.x+Math.sin(r)*.25,hip.y+Math.cos(r)*.25);}
  if(id==='reverse-lunge'){knee=p(.45+dx,.6);hip=p(.45+dx,.4);shoulder=p(.45+dx,.2);ankle=p(knee.x+Math.sin(r)*.22,knee.y-Math.cos(r)*.22);}
  if(id==='hip-abduction'){shoulder=p(.24+dx,.65);hip=p(.5+dx,.65);knee=p(hip.x-Math.cos(r)*.25,hip.y-Math.sin(r)*.25);ankle=p(knee.x+.08,knee.y);}
  if(id==='plank'){shoulder=p(.25+dx,.5);hip=p(.52+dx,.62);ankle=p(.82+dx,.75);elbow=p(.25+dx,.75);}
  for(const [index,point] of [[11,shoulder],[13,elbow],[15,wrist],[23,hip],[25,knee],[27,ankle]])points[index+o]=point;
 }
 return points;
}
function clip(id,active=0){
 const up=['press','glute-bridge'].includes(id),a=up?70:160,b=up?160:75;
 const keys=[[0,a],[.5,a],[1.3,b],[2.1,a],[2.6,a],[3.4,b],[4.2,a],[4.7,a]];
 const frames=Array.from({length:48},(_,i)=>{const time=i/10;let k=0;while(k<keys.length-2&&time>keys[k+1][0])k++;const [ta,va]=keys[k],[tb,vb]=keys[k+1];const d=va+(vb-va)*Math.max(0,Math.min(1,(time-ta)/(tb-ta)));return {time,poses:[pose(id,d,active)]}});
 return {frames,duration:4.7,width:1000,height:1000,sampleRate:10};
}
for(const id of ['pushup','curl','row','press','rdl','glute-bridge','reverse-lunge','hip-abduction']){
 const result=analyzeSpecificMovement(clip(id),id,id);
 assert.equal(result.reps.length,2,id+': '+JSON.stringify(result.issues));
 assert.notDeepEqual(result.phaseLabels,['First phase','Return phase']);
 assert.equal(getAnalyzer(id).spec.version,'0.2.0');
 const crowd=clip(id);crowd.frames.forEach(f=>f.poses.push(f.poses[0]));
 assert.equal(analyzeSpecificMovement(crowd,id,id).status,'unable',id+' crowd');
}
const right=analyzeSpecificMovement(clip('row',1),'row','Row');
assert.ok(right.reps.every(r=>r.side==='right'),'Must track moving arm instead of stationary support arm');
const missing=clip('curl');missing.frames.forEach(f=>{f.poses[0][23].visibility=0;f.poses[0][24].visibility=0});
assert.equal(analyzeSpecificMovement(missing,'curl','Curl').status,'unable');
const still=clip('curl');still.frames.forEach(f=>f.poses=[pose('curl',160)]);
assert.equal(analyzeSpecificMovement(still,'curl','Curl').reps.length,0);
const plank=clip('plank'),hold=analyzeSpecificMovement(plank,'plank','Plank');
assert.equal(hold.holdSeconds,4.7);assert.equal(hold.reps.length,0);assert.equal(hold.status,'assessed');
const broken=clip('plank');broken.frames[23].poses=[];
const interrupted=analyzeSpecificMovement(broken,'plank','Plank');
assert.equal(interrupted.status,'partial');assert.ok(interrupted.holdSeconds<3);
const wrongView=clip('row');wrongView.frames.forEach(f=>{f.poses[0][11]=p(.45,.2);f.poses[0][12]=p(.475,.2);f.poses[0][23]=p(.45,.65);f.poses[0][24]=p(.475,.65)});
assert.equal(analyzeSpecificMovement(wrongView,'row','Row').status,'unable');
assert.ok(listAnalyzers().length>=100);
console.log('Specific movement checks passed: eight rep patterns, moving-arm selection, stationary/crowded/occluded rejection, orientation gates, and timed plank gaps.');

