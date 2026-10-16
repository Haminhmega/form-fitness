import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

// Synthetic articulated body, not a trainer-labelled validation dataset.
export function squatAttemptInput({kind='hinge',cycles=3,mirror=false}={}){
  const width=600,height=800,frames=[];
  for(let i=0;i<=cycles*30;i++){
    const time=i/10,t=time%3;
    const p=t<.4?0:t<1.2?(t-.4)/.8:t<1.7?1:t<2.5?(2.5-t)/.8:0;
    let lean=(kind==='leaning-squat'?55:kind==='squat'?30:45)*p;
    let thigh=(kind==='squat'||kind==='leaning-squat'?65:10)*p,shin=(kind==='squat'||kind==='leaning-squat'?25:5)*p;
    if(kind==='late-knee-bend'&&t>1.1&&t<1.9){thigh=65;shin=25;}
    if(kind==='spike'){lean=t===1.3?45:15;thigh=10*p;shin=5*p;}
    const rad=v=>v*Math.PI/180;
    const ankle={x:290,y:740},knee={x:ankle.x-160*Math.sin(rad(shin)),y:ankle.y-160*Math.cos(rad(shin))};
    const hip={x:knee.x+160*Math.sin(rad(thigh)),y:knee.y-160*Math.cos(rad(thigh))};
    const shoulder={x:hip.x-200*Math.sin(rad(lean)),y:hip.y-200*Math.cos(rad(lean))};
    const pose=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:0,presence:0}));
    for(const [id,pixel] of [[11,shoulder],[23,hip],[25,knee],[27,ankle],[29,{x:310,y:745}],[31,{x:240,y:745}]]){
      pose[id]={x:pixel.x/width,y:pixel.y/height,z:0,visibility:.99,presence:.99};
      pose[id+1]={...pose[id],x:pose[id].x+.012};
    }
    if(mirror)for(const point of pose)point.x=1-point.x;
    frames.push({time,poses:[pose]});
  }
  return {frames,duration:cycles*3,width,height,sampleRate:10};
}

export async function coachingTestTools(){
  const b=await build({stdin:{contents:"export {analyzeSquat} from './src/ai/squat';export {smoothPoseInput} from './src/ai/pose-signal';export {buildFormFeedback} from './src/ai/form-feedback';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
  return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
}

async function run(){
  const {analyzeSquat,smoothPoseInput,buildFormFeedback}=await coachingTestTools();
  const review=(input,id='squat')=>{const result=analyzeSquat(smoothPoseInput(input));return {result,feedback:buildFormFeedback(id,result,input)}};
  const has=feedback=>feedback.cards.some(c=>c.id==='squat-knee-participation');
  for(const mirror of [false,true]){
    const {result,feedback}=review(squatAttemptInput({mirror}));
    assert.equal(result.reps.length,0,'Do not turn shallow hinges into completed squat counts');
    assert.equal(result.status,'unable','The rep counter and coaching assessment have independent outcomes');
    assert.equal(feedback.status,'limited');assert.ok(has(feedback));assert.ok(!feedback.positive);
    assert.equal(feedback.coverage.attempts,3);
    const card=feedback.cards[0];assert.deepEqual(card.repIndexes,[]);
    assert.match(card.action,/knees.*hips together/);assert.match(card.action,/knees to travel forward/);
    assert.match(card.experiment,/optional setup experiment/);assert.equal(card.steps.length,3);
    assert.ok(card.time>0&&card.time<result.duration);
    assert.equal(feedback.checks.find(c=>c.id==='squat-stance-width').status,'unsupported');
    for(const kind of ['squat','leaning-squat','late-knee-bend']){
      const good=review(squatAttemptInput({kind,mirror}));
      assert.ok(!has(good.feedback),`${kind}: forward lean or early descent alone is not a fault`);
      if(kind!=='late-knee-bend'){
        assert.equal(good.result.reps.length,3);assert.equal(good.feedback.status,'ready');
        assert.equal(good.feedback.positive,true,'Full visible no-finding set receives positive closure');
        assert.match(good.feedback.summary,/Nice work.*movement checks/);
        assert.equal(good.feedback.cards[0].title,'What went well');
      }
    }
  }
  assert.ok(!has(review(squatAttemptInput({kind:'spike'})).feedback),'A single pose spike must not trigger coaching');
  const single=review(squatAttemptInput({cycles:1}));assert.match(single.feedback.cards[0].observed,/one continuous movement attempt/);
  const interrupted=squatAttemptInput({cycles:1});interrupted.frames[13].poses=[];
  assert.ok(!has(review(interrupted).feedback),'Do not join a shallow attempt across missing tracking');
  const hidden=squatAttemptInput();for(const f of hidden.frames)for(const p of f.poses[0])p.visibility=.1;
  const unavailable=review(hidden).feedback;assert.equal(unavailable.status,'retake');assert.ok(!unavailable.positive);
  const crowd=squatAttemptInput();crowd.frames[9].poses.push(structuredClone(crowd.frames[9].poses[0]));
  assert.equal(review(crowd).feedback.status,'retake');
  const frontal=squatAttemptInput();for(const f of frontal.frames)for(const id of [12,24])f.poses[0][id].x+=.5;
  assert.equal(review(frontal).feedback.status,'retake');
  const sparse=squatAttemptInput();sparse.frames=sparse.frames.filter((_,i)=>i%4===0);
  assert.equal(review(sparse).feedback.status,'retake');
  const noReference=squatAttemptInput({cycles:1});noReference.frames=noReference.frames.filter(f=>f.time>.9&&f.time<1.9).map((f,i)=>({...f,time:i/10}));
  assert.ok(!has(review(noReference).feedback),'Static folded pose without a complete attempt is not judged');
  assert.ok(!has(review(squatAttemptInput(),'rdl').feedback),'Intentional hinge selection must not get squat corrections');
  const correctShort=review(squatAttemptInput({kind:'squat',cycles:1}));assert.ok(!correctShort.feedback.positive,'Short clip gets limited assessment, not full-set praise');
  console.log('Squat coaching regressions passed: shallow attempts independent of rep counts; mirrored views; deep/forward-leaning/late-knee squats; positive closure; gaps, crowds, visibility, wrong view, sparse frames and exercise context. Synthetic tests, not clinical validation.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await run();
