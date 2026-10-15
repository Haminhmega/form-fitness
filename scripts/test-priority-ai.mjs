import assert from 'node:assert/strict';
import {build} from 'esbuild';
const b=await build({stdin:{contents:"export * from './src/ai/priority-profiles';export * from './src/ai/priority-motion';export {getAnalyzer,listAnalyzers} from './src/ai/registry';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false});
const {priorityProfiles,priorityRules,getAnalyzer,listAnalyzers}=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const p=(x,y)=>({x,y,z:0,visibility:.99,presence:.99});
function pose(rule,deg){
 const a=Array.from({length:33},()=>p(.5,.5)),r=deg*Math.PI/180;
 for(const o of [0,1]){
  const dx=o*.02;let s=p(.4+dx,.25),h=p(.4+dx,.6),e=p(.4+dx,.42),w=p(e.x+Math.sin(r)*.16,e.y-Math.cos(r)*.16),k=p(.4+dx,.75),n=p(.4+dx,.92);
  if(rule.orientation==='horizontal'){s=p(.25+dx,.35);h=p(.6+dx,.4);e=p(s.x,.55);w=p(e.x+Math.sin(r)*.16,e.y-Math.cos(r)*.16);}
  if(rule.profile==='knee'){h=p(.45+dx,.4);k=p(.45+dx,.6);n=p(k.x+Math.sin(r)*.2,k.y-Math.cos(r)*.2);if(rule.orientation==='horizontal')s=p(.2+dx,.4);else s=p(.45+dx,.2);}
  if(rule.profile==='hip'){h=p(.5+dx,.5);k=p(.5+dx,.75);s=p(h.x+Math.sin(r)*.25,h.y+Math.cos(r)*.25);}
  if(rule.profile==='shoulder'){e=p(s.x+Math.sin(r)*.2,s.y+Math.cos(r)*.2);w=p(e.x,e.y+.1);}
  for(const [j,v] of [[11,s],[13,e],[15,w],[23,h],[25,k],[27,n]])a[j+o]=v;
 }
 return a;
}
function clip(rule,reverse=false){
 const start=(rule.start==='high')!==reverse?160:65,end=start===160?65:160;
 const keys=[[0,start],[.5,start],[1.3,end],[2.1,start],[2.6,start],[3.4,end],[4.2,start],[4.7,start]];
 return {duration:4.7,width:1000,height:1000,sampleRate:10,frames:Array.from({length:48},(_,i)=>{const time=i/10;let k=0;while(k<keys.length-2&&time>keys[k+1][0])k++;const [t,a]=keys[k],[u,b]=keys[k+1];return {time,poses:[pose(rule,a+(b-a)*Math.max(0,Math.min(1,(time-t)/(u-t))))]};})};
}
assert.equal(priorityProfiles.length,60);assert.equal(new Set(priorityProfiles.map(e=>e.id)).size,60);
let scenarios=0;
for(const entry of priorityProfiles){
 const rule=priorityRules[entry.family],analyzer=getAnalyzer(entry.id);
 assert.equal(analyzer.spec.validation,'beta','Synthetic fixtures do not establish real-world verification');
 const run=input=>{scenarios++;return analyzer.analyze(input);};
 assert.equal(run(clip(rule)).reps.length,2,entry.name);
 assert.equal(run(clip(rule,true)).reps.length,0,entry.name+' opposite starting phase');
 const stationary=clip(rule);stationary.frames.forEach(f=>f.poses=[pose(rule,120)]);assert.equal(run(stationary).status,'unable');
 const crowd=clip(rule);crowd.frames.forEach(f=>f.poses.push(f.poses[0]));assert.equal(run(crowd).status,'unable');
 const absent=clip(rule);absent.frames.forEach(f=>f.poses=[]);assert.equal(run(absent).status,'unable');
 const occluded=clip(rule);occluded.frames.forEach(f=>{f.poses[0][23].visibility=0;f.poses[0][24].visibility=0});assert.equal(run(occluded).status,'unable');
 const gap=clip(rule);gap.frames=gap.frames.filter(f=>f.time<.7||f.time>3.9);assert.equal(run(gap).reps.length,0,'Must not join reps over tracking gaps');
 const wrong=clip(rule);wrong.frames.forEach(f=>f.time=0);assert.equal(run(wrong).status,'unable');
 const nan=clip(rule);nan.frames.forEach(f=>{f.poses[0][23].x=NaN;f.poses[0][24].x=NaN});assert.equal(run(nan).status,'unable');
}
console.log(`60 exercise profiles passed ${scenarios} synthetic scenarios. Registry total: ${listAnalyzers().length}. Real-video validation: pending.`);
