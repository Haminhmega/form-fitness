import assert from 'node:assert/strict';
import {build} from 'esbuild';
const b=await build({stdin:{contents:"export * from './src/ai/priority-profiles';export * from './src/ai/priority-motion';export {getAnalyzer,listAnalyzers} from './src/ai/registry';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false});
const {priorityProfiles,priorityRules,getAnalyzer,listAnalyzers}=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const p=(x,y)=>({x,y,z:0,visibility:.99,presence:.99});
function pose(rule,deg){
 const a=Array.from({length:33},()=>p(.5,.5)),r=deg*Math.PI/180;
 for(const o of [0,1]){
  const dx=o*(rule.view==='front'?.20:.02);let s=p(.4+dx,.25),h=p(.4+dx,.6),e=p(.4+dx,.42),w=p(e.x+Math.sin(r)*.16,e.y-Math.cos(r)*.16),k=p(.4+dx,.75),n=p(.4+dx,.92);
  if(rule.orientation==='horizontal'){s=p(.25+dx,.35);h=p(.6+dx,.4);e=p(s.x,.55);w=p(e.x+Math.sin(r)*.16,e.y-Math.cos(r)*.16);}
  if(rule.profile==='knee'){h=p(.45+dx,.4);k=p(.45+dx,.6);n=p(k.x+Math.sin(r)*.2,k.y-Math.cos(r)*.2);if(rule.orientation==='horizontal')s=p(.2+dx,.4);else s=p(.45+dx,.2);}
  if(rule.profile==='hip'){h=p(.5+dx,.5);k=p(.5+dx,.75);s=p(h.x+Math.sin(r)*.25,h.y+Math.cos(r)*.25);}
  if(rule.profile==='shoulder'){e=p(s.x+Math.sin(r)*.2,s.y+Math.cos(r)*.2);w=p(e.x,e.y+.1);}
  if(rule.guard==='overheadHands'){s=p(.4+dx,.4);h=p(.4+dx,.75);e=p(.4+dx,.2);w=p(e.x+Math.sin(r)*.16,e.y+Math.cos(r)*.16);}
  if(rule.guard==='chestHeight'){e=p(s.x+.16,s.y);w=p(e.x-Math.cos(r)*.16,e.y-Math.sin(r)*.16);}
  if(rule.guard==='seatedThigh'){k=p(h.x+.25,h.y);n=p(k.x-Math.cos(r)*.2,k.y+Math.sin(r)*.2);}
  if(rule.profile==='ankle'){
   n=p(.45+dx,.8);k=p(.45+dx,.58);h=rule.guard==='seatedCalf'?p(.25+dx,.58):p(.45+dx,.36);s=p(h.x,h.y-.22);
   a[29+o]=p(n.x-.03,n.y-.01);a[31+o]=p(n.x+Math.sin(r)*.12,n.y-Math.cos(r)*.12);
  }
  for(const [j,v] of [[11,s],[13,e],[15,w],[23,h],[25,k],[27,n]])a[j+o]=v;
 }
 return a;
}
function clip(rule,reverse=false){
 const high=rule.profile==='ankle'?120:160,low=rule.profile==='ankle'?90:65;
 const start=(rule.start==='high')!==reverse?high:low,end=start===high?low:high;
 const keys=[[0,start],[.5,start],[1.3,end],[2.1,start],[2.6,start],[3.4,end],[4.2,start],[4.7,start]];
 return {duration:4.7,width:1000,height:1000,sampleRate:10,frames:Array.from({length:48},(_,i)=>{const time=i/10;let k=0;while(k<keys.length-2&&time>keys[k+1][0])k++;const [t,a]=keys[k],[u,b]=keys[k+1];return {time,poses:[pose(rule,a+(b-a)*Math.max(0,Math.min(1,(time-t)/(u-t))))]};})};
}
assert.equal(priorityProfiles.length,100);assert.equal(new Set(priorityProfiles.map(e=>e.id)).size,100);
assert.equal(Object.keys(priorityRules).length,31);
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
 const lowConfidence=clip(rule);lowConfidence.frames.forEach(f=>f.poses[0].forEach(point=>{point.presence=.2}));assert.equal(run(lowConfidence).status,'unable');
 const cropped=clip(rule);cropped.frames.forEach(f=>{f.poses[0][23].x=0;f.poses[0][24].x=0});assert.equal(run(cropped).status,'unable');
 const invalidDimensions=clip(rule);invalidDimensions.width=Infinity;assert.equal(run(invalidDimensions).status,'unable');
 const rightMoving=clip(rule),resting=pose(rule,rule.profile==='ankle'?90:120);
 rightMoving.frames.forEach(f=>{for(const j of [11,13,15,23,25,27,29,31])f.poses[0][j]=rule.profile==='hip'?{...f.poses[0][j],visibility:.1}:{...resting[j]};});
 const rightResult=run(rightMoving);assert.equal(rightResult.reps.length,2,entry.name+' working right side');assert.ok(rightResult.reps.every(r=>r.side==='right'));
 const unfinished=clip(rule);unfinished.frames=unfinished.frames.filter(f=>f.time<=1.4);assert.equal(run(unfinished).reps.length,0,entry.name+' incomplete return');
 const jitter=clip(rule);jitter.frames.forEach((f,i)=>f.poses=[pose(rule,(rule.profile==='ankle'?105:115)+Math.sin(i)*3)]);assert.equal(run(jitter).reps.length,0,entry.name+' small pose jitter');
 const wrongView=clip(rule);wrongView.frames.forEach(f=>{
  if(rule.view==='front'){f.poses[0][12].x=f.poses[0][11].x;f.poses[0][12].y=f.poses[0][11].y;}
  else {f.poses[0][11].x=.05;f.poses[0][12].x=.95;f.poses[0][23].x=.05;f.poses[0][24].x=.95;}
 });assert.equal(run(wrongView).status,'unable',entry.name+' wrong view');
}
// Independent adversarial setup fixtures exercise the new distinctions, not just catalog registration.
for(const family of ['pullup','dip','chestPress','seatedLegCurl','standingLegCurl','calfRaise','seatedCalfRaise']){
 const entry=priorityProfiles.find(e=>e.family===family),rule=priorityRules[family],wrong=clip(rule);
 wrong.frames.forEach(f=>{for(const o of [0,1]){
  const points=f.poses[0];
  if(family==='pullup')points[15+o].y=.8;
  if(family==='dip')points[15+o].y=.1;
  if(family==='chestPress')points[15+o].y=.9;
  if(family==='seatedLegCurl')points[23+o].x=points[25+o].x;
  if(family==='standingLegCurl')points[23+o].y=points[25+o].y;
  if(family==='calfRaise')points[23+o]=p(.2+o*.02,.58); // seated knee while standing calf raise selected
  if(family==='seatedCalfRaise')points[23+o]=p(points[25+o].x,.36); // straight knee while seated calf raise selected
 }});
 scenarios++;assert.equal(getAnalyzer(entry.id).analyze(wrong).status,'unable',family+' mismatched setup');
}
for(const family of ['calfRaise','seatedCalfRaise']){
 const entry=priorityProfiles.find(e=>e.family===family),rule=priorityRules[family],missingFoot=clip(rule);
 missingFoot.frames.forEach(f=>{f.poses[0][31].visibility=0;f.poses[0][32].visibility=0});
 scenarios++;assert.equal(getAnalyzer(entry.id).analyze(missingFoot).status,'unable',family+' missing toes');
 const kneeOnly=clip(rule);kneeOnly.frames.forEach(f=>f.poses=[pose(rule,90)]);
 scenarios++;assert.equal(getAnalyzer(entry.id).analyze(kneeOnly).reps.length,0,family+' no ankle excursion');
}
assert.ok(listAnalyzers().every(a=>a.spec.validation==='beta'),'No real-video evidence has established verification, including squat');
console.log(`${priorityProfiles.length} exercise profiles / ${Object.keys(priorityRules).length} families passed ${scenarios} synthetic scenarios. Registry total: ${listAnalyzers().length}. Real-video validation: pending.`);
