import assert from 'node:assert/strict';
import {build} from 'esbuild';

const bundle=await build({stdin:{contents:"export {analyzeGenericMotion} from './src/ai/generic-motion.ts'; export {listAnalyzers,getExerciseSupportLevel} from './src/ai/registry.ts'; export {popularExerciseProfiles} from './src/ai/popular-profiles.ts';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false});
const {analyzeGenericMotion,listAnalyzers,getExerciseSupportLevel,popularExerciseProfiles}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
assert.equal(popularExerciseProfiles.length,95);
assert.equal(new Set(popularExerciseProfiles.map(e=>e.id)).size,95);
assert.equal(listAnalyzers().length,136);
assert.equal(listAnalyzers().filter(a=>a.spec.validation==='verified').length,1);
assert.equal(listAnalyzers().filter(a=>a.spec.validation==='beta').length,135);
for(const entry of popularExerciseProfiles)assert.equal(getExerciseSupportLevel({id:entry.id,supported:false}),'experimental_ai');
for(const id of ['pushup','curl','rdl','row','press'])assert.equal(getExerciseSupportLevel({id,supported:false}),'experimental_ai');

const triples={knee:[[23,25,27],[24,26,28]],hip:[[11,23,25],[12,24,26]],elbow:[[11,13,15],[12,14,16]],shoulder:[[13,11,23],[14,12,24]]};
function pose(profile,degrees){const points=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:.99,presence:.99}));const radians=degrees*Math.PI/180;for(const [offset,ids] of triples[profile].entries()){const b={x:.45+offset*.08,y:.5},a={x:b.x,y:b.y-.18},c={x:b.x+Math.sin(radians)*.18,y:b.y-Math.cos(radians)*.18};[a,b,c].forEach((p,i)=>points[ids[i]]={...p,z:0,visibility:.99-offset*.01,presence:.99});}return points;}
function clip(profile){const keys=[[0,160],[.5,160],[1.3,75],[2.1,160],[2.6,160],[3.4,75],[4.2,160],[4.7,160]];const frames=[];for(let i=0;i<=47;i++){const time=i/10;let k=0;while(k<keys.length-2&&time>keys[k+1][0])k++;const [ta,a]=keys[k],[tb,b]=keys[k+1];const value=a+(b-a)*Math.max(0,Math.min(1,(time-ta)/(tb-ta)));frames.push({time,poses:[pose(profile,value)]});}return {frames,duration:4.7,width:1000,height:1000,sampleRate:10};}
for(const profile of Object.keys(triples)){const result=analyzeGenericMotion(clip(profile),profile,'Test exercise');assert.equal(result.reps.length,2,`${profile} should find two cycles`);assert.equal(result.metricLabel,`${profile} angle`);assert.ok(result.validFraction>.99);}
const crowded=clip('elbow');crowded.frames=crowded.frames.map(frame=>({...frame,poses:[frame.poses[0],frame.poses[0]]}));const refused=analyzeGenericMotion(crowded,'elbow','Curl');assert.equal(refused.status,'unable');assert.equal(refused.reps.length,0);assert.ok(refused.issues.some(issue=>issue.includes('withheld')));
console.log('Generic AI checks passed: 135 beta profiles, four joint metrics, cycle measurement, and multi-person abstention.');
