import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

// Synthetic coordinates exercise the feedback rules; these are not labelled
// human clips and do not validate real-world recognition or coaching accuracy.
export function makeFeedbackFixture({exerciseId='curl',metric='elbow',ranges=[100,100,100,100],durations=ranges.map(()=>2),sides=ranges.map(()=>'left'),gapAfter=-1,torsoChange=false,bodyChange=false,hold=false}={}){
  const dimensions={width:600,height:800},frames=[],reps=[];
  const point=(x,y)=>({x,y,z:0,visibility:.99,presence:.99});
  const rotate=(origin,start,length,degrees)=>{
    const angle=Math.atan2((start.y-origin.y)*800,(start.x-origin.x)*600)+degrees*Math.PI/180;
    return point(origin.x+Math.cos(angle)*length/600,origin.y+Math.sin(angle)*length/800);
  };
  function pose(phase,range,seconds){
    const pose=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:0,presence:0}));
    const angle=170-range*Math.sin(Math.PI*phase)**2;
    const lean=torsoChange?28*Math.sin(Math.PI*phase)**2:0;
    const hip=point(.48,.65),radians=lean*Math.PI/180;
    const shoulder=point(hip.x+Math.sin(radians)*240/600,hip.y-Math.cos(radians)*240/800);
    pose[11]=shoulder;pose[23]=hip;
    pose[25]=point(.49,.79);pose[27]=point(.49,.94);
    if(metric==='elbow'){
      const elbow=point(shoulder.x+(hip.x-shoulder.x)*.48,shoulder.y+(hip.y-shoulder.y)*.48);
      pose[13]=elbow;pose[15]=rotate(elbow,shoulder,100,angle);
    }else if(metric==='knee'){
      pose[11]=point(.48,.2);pose[23]=point(.48,.4);pose[25]=point(.48,.6);pose[27]=rotate(pose[25],pose[23],150,angle);
    }else if(metric==='hip'){
      pose[11]=point(.48,.25);pose[23]=point(.48,.5);pose[25]=rotate(pose[23],pose[11],160,angle);pose[27]=point(pose[25].x,Math.min(.95,pose[25].y+.15));
    }else if(metric==='shoulder'){
      pose[11]=shoulder;pose[23]=hip;pose[13]=rotate(pose[11],pose[23],140,30+range*Math.sin(Math.PI*phase)**2);pose[15]=point(pose[13].x,Math.max(.04,pose[13].y-.08));
    }else if(metric==='ankle'){
      pose[11]=point(.48,.2);pose[23]=point(.48,.45);pose[25]=point(.48,.65);pose[27]=point(.48,.85);pose[29]=point(.41,.86);pose[31]=rotate(pose[27],pose[25],70,80+range*Math.sin(Math.PI*phase)**2);
    }
    if(bodyChange||hold||exerciseId==='pushup'){
      const delta=hold?(bodyChange&&seconds>1.8?.12:0):(bodyChange?.12*Math.sin(Math.PI*phase)**2:0);
      pose[11]=point(.22,.4);pose[23]=point(.5,.4+delta);pose[27]=point(.8,.4);
      pose[13]=point(.22,.55);pose[15]=rotate(pose[13],pose[11],100,angle);
    }
    for(const id of [11,13,15,23,25,27,29,31])if(pose[id].visibility)pose[id+1]={...pose[id],x:pose[id].x+.015};
    return pose;
  }
  let start=0;
  if(hold){
    for(let frame=0;frame<=50;frame++){const time=frame/10;frames.push({time,valid:true,angle:180,landmarks:pose(0,100,time)});}
    return {exerciseId:'plank',dimensions,result:{status:'assessed',reps:[],frames,duration:5,validFraction:1,issues:[],observations:[],holdSeconds:5}};
  }
  for(let index=0;index<ranges.length;index++){
    const duration=durations[index],end=start+duration;
    for(let step=0;step<=Math.round(duration*10);step++){
      const time=Number((start+step/10).toFixed(5));
      if(frames.at(-1)?.time===time)continue;
      frames.push({time,valid:true,angle:170-ranges[index]*Math.sin(Math.PI*step/(duration*10))**2,landmarks:pose(step/(duration*10),ranges[index],time)});
    }
    reps.push({index:index+1,start,bottom:start+duration/2,end,descentSeconds:duration/2,ascentSeconds:duration/2,rangeDegrees:ranges[index],minKneeAngle:170-ranges[index],side:sides[index]});
    start=end+(index===gapAfter?1:0);
  }
  return {exerciseId,dimensions,result:{status:'assessed',reps,frames,duration:frames.at(-1)?.time||0,validFraction:1,issues:[],observations:[]}};
}

async function run(){
  const compiled=await build({stdin:{contents:"export * from './src/ai/form-feedback.ts'; export {priorityProfiles} from './src/ai/priority-profiles.ts';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false});
  const {buildFormFeedback,priorityProfiles}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
  const feedback=fixture=>buildFormFeedback(fixture.exerciseId,fixture.result,fixture.dimensions);
  const changed=fixture=>feedback(fixture).cards.filter(card=>card.kind==='technique'||card.kind==='consistency');
  const clone=fixture=>structuredClone(fixture);
  const base=makeFeedbackFixture(),before=JSON.stringify(base),steady=feedback(base);
  assert.equal(steady.status,'ready');
  assert.equal(steady.cards[0].kind,'practice');
  assert.match(steady.cards[0].observed,/not a fault detected/);
  assert.match(steady.summary,/does not establish that your form is correct/);
  assert.equal(JSON.stringify(base),before,'The analysis input is never mutated');

  const torso=makeFeedbackFixture({torsoChange:true});
  const torsoFeedback=feedback(torso);
  assert.ok(torsoFeedback.cards.some(card=>card.id==='torso-change'));
  assert.ok(torsoFeedback.cards.every(card=>card.time===undefined||card.time>=0&&card.time<=torso.result.duration));
  assert.match(torsoFeedback.cards.find(card=>card.id==='torso-change').observed,/could be intentional|projected/i);
  const range=makeFeedbackFixture({ranges:[100,100,55,55]});
  assert.ok(feedback(range).cards.some(card=>card.id==='range-change'&&card.repIndexes.join(',')==='3,4'));
  const tempo=makeFeedbackFixture({durations:[2,2,3,3]});
  assert.ok(feedback(tempo).cards.some(card=>card.id==='tempo-change'&&/pauses/.test(card.observed)));
  const combined=makeFeedbackFixture({torsoChange:true,ranges:[100,100,55,55],durations:[2,2,3,3]});
  assert.equal(feedback(combined).cards.length,3,'Prioritized feedback has at most three actions');
  assert.equal(feedback(combined).cards[0].kind,'technique');

  const spike=clone(base);
  for(const index of [8,28,48,68])spike.result.frames[index].landmarks[11].x+=.24;
  assert.equal(changed(spike).length,0,'Isolated pose spikes do not become repeated torso or range faults');
  const falseObservation=clone(base);
  falseObservation.result.observations=[{id:'torso-motion',title:'Bad posture',detail:'Spine unsafe',tone:'notice',repIndexes:[1,2,3,4]}];
  assert.equal(changed(falseObservation).length,0,'Feedback independently derives metrics instead of trusting old observation IDs');
  const gap=makeFeedbackFixture({ranges:[100,100,55,55],gapAfter:1});
  assert.ok(!feedback(gap).cards.some(card=>card.id==='range-change'),'Separate tracking segments are not compared');
  assert.equal(feedback(gap).status,'limited');
  const sides=makeFeedbackFixture({ranges:[100,100,55,55],sides:['left','left','right','right']});
  assert.ok(!feedback(sides).cards.some(card=>card.id==='range-change'),'Working sides are not compared');
  const alternating=makeFeedbackFixture({ranges:[100,55,55,100],sides:['left','right','left','right']});
  assert.ok(!feedback(alternating).cards.some(card=>card.id==='range-change'));
  const one=makeFeedbackFixture({ranges:[100]});
  assert.equal(feedback(one).status,'limited');
  assert.equal(changed(one).length,0,'One rep cannot produce a between-rep consistency claim');
  assert.ok(feedback(one).limitations.some(message=>/At least three/.test(message)));

  const corruptFrames=clone(base);
  corruptFrames.result.frames.forEach(frame=>frame.landmarks[11].x=NaN);
  assert.equal(feedback(corruptFrames).status,'retake');
  const invalidPresence=clone(base);
  invalidPresence.result.frames.forEach(frame=>{frame.landmarks[11].presence=NaN;frame.landmarks[12].presence=NaN;});
  assert.equal(feedback(invalidPresence).status,'retake');
  const invalidBothSides=clone(base);
  invalidBothSides.result.frames.forEach(frame=>{frame.landmarks[11].x=NaN;frame.landmarks[12].x=NaN;});
  assert.equal(feedback(invalidBothSides).status,'retake');
  const cropped=clone(base);
  cropped.result.frames.forEach(frame=>{frame.landmarks[15].x=1.2;frame.landmarks[16].x=1.2;});
  assert.equal(feedback(cropped).status,'retake');
  const crowd=clone(base);crowd.result.issues=['More than one person was detected.'];
  assert.equal(feedback(crowd).status,'retake');
  const lowCoverage=clone(base);lowCoverage.result.validFraction=.5;
  assert.ok(feedback(lowCoverage).cards.every(card=>card.kind==='capture'));
  const midCoverage=clone(base);midCoverage.result.validFraction=.75;
  assert.equal(feedback(midCoverage).status,'limited');
  assert.equal(feedback(midCoverage).cards[0].kind,'capture');
  const absent=clone(base);absent.result.frames.forEach(frame=>frame.landmarks=[]);
  assert.equal(feedback(absent).status,'retake');
  const broken=clone(base);broken.result.frames[10].valid=false;
  broken.result.reps=broken.result.reps.slice(0,1);
  assert.equal(feedback(broken).status,'retake','A rep crossing an invalid frame is not assessed');
  const empty=clone(base);empty.result.reps=[];
  assert.equal(feedback(empty).status,'retake');
  const invalidDimensions=clone(base);invalidDimensions.dimensions.height=0;
  assert.equal(feedback(invalidDimensions).status,'retake');
  const unsupported=clone(base);unsupported.exerciseId='custom-unknown';
  assert.equal(feedback(unsupported).status,'retake');
  const wrongSetup=makeFeedbackFixture({exerciseId:'row'});
  assert.equal(feedback(wrongSetup).status,'retake','An upright body is not treated as a horizontal supported row');
  const row=makeFeedbackFixture({exerciseId:'row',bodyChange:true});
  assert.ok(feedback(row).cards.some(card=>card.id==='torso-change'));
  const press=makeFeedbackFixture({exerciseId:'press',metric:'shoulder',torsoChange:true});
  assert.ok(feedback(press).cards.some(card=>card.id==='torso-change'));
  const hideHips=fixture=>{fixture.result.frames.forEach(frame=>{for(const id of [23,24])frame.landmarks[id]={x:NaN,y:NaN,z:NaN,visibility:0,presence:0};});return fixture;};
  const croppedArm=hideHips(makeFeedbackFixture({exerciseId:'gym-846-machine-bicep-curl',ranges:[100,100,55,55],durations:[2,2,3,3]}));
  const croppedArmFeedback=feedback(croppedArm);
  assert.equal(croppedArmFeedback.status,'ready','Generic elbow comparisons use the visible shoulder, elbow and wrist without requiring unused hips');
  assert.ok(croppedArmFeedback.cards.some(card=>card.id==='range-change'));
  assert.ok(croppedArmFeedback.cards.some(card=>card.id==='tempo-change'));
  assert.ok(!croppedArmFeedback.cards.some(card=>card.id==='torso-change'));
  const croppedCurl=feedback(hideHips(makeFeedbackFixture()));
  assert.equal(croppedCurl.status,'retake','Torso-based strict curl feedback still requires the hip');
  assert.match(croppedCurl.cards[0].action,/shoulder and hip visible/);
  croppedArm.result.validFraction=.5;
  assert.doesNotMatch(feedback(croppedArm).cards[0].action,/hip visible/,'Generic capture instructions do not request unused torso landmarks');
  const sparse=clone(base);sparse.result.frames=sparse.result.frames.filter((_,index)=>index%3===0);
  assert.equal(feedback(sparse).status,'retake','Too few sampled frames cannot support timing/posture comparisons');
  const shortCoverage=clone(base);shortCoverage.result.duration=60;
  assert.equal(feedback(shortCoverage).status,'retake','A few frames cannot claim full coverage of a much longer clip');

  const pushup=makeFeedbackFixture({exerciseId:'pushup',bodyChange:true});
  const pushupCard=feedback(pushup).cards.find(card=>card.id==='body-line-change');
  assert.ok(pushupCard);
  assert.match(pushupCard.action,/torso and hips together/);
  assert.doesNotMatch(pushupCard.observed,/sag|pike|spine|arch/i,'Unsigned body-line change is not assigned a direction or spinal diagnosis');
  const plank=makeFeedbackFixture({hold:true,bodyChange:true});
  assert.equal(feedback(plank).status,'ready');
  assert.ok(feedback(plank).cards.some(card=>card.id==='body-line-change'));
  const ambiguousHold=clone(plank);ambiguousHold.result.frames[10].landmarks=[];ambiguousHold.result.frames[10].valid=false;ambiguousHold.result.frames[10].reason='One person with the required joints must stay visible.';
  assert.equal(feedback(ambiguousHold).status,'retake','A hold with unresolved person identity cannot be graded as technique');
  assert.match(feedback(ambiguousHold).cards[0].action,/hold your setup for at least 2 uninterrupted seconds/);
  assert.doesNotMatch(feedback(ambiguousHold).cards[0].action,/complete repetitions/);
  const steadyHold=makeFeedbackFixture({hold:true});
  assert.equal(feedback(steadyHold).cards[0].kind,'practice');
  const holdGap=clone(plank);
  holdGap.result.frames.forEach(frame=>{if(frame.time>=1.5&&frame.time<=3.6)frame.valid=false;});
  assert.equal(feedback(holdGap).status,'retake','A long reported hold is not accepted across missing tracking');

  const exerciseFor=family=>priorityProfiles.find(profile=>profile.family===family).id;
  for(const [family,metric,pattern] of [['squat','knee',/feet settled/],['hinge','hip',/hips back/],['lunge','knee',/balanced stance/],['calfRaise','ankle',/knee position consistent/]]){
    const familyFixture=makeFeedbackFixture({exerciseId:exerciseFor(family),metric,ranges:metric==='ankle'?[30,30,30]:[100,100,100]});
    const practice=feedback(familyFixture).cards.find(card=>card.kind==='practice');
    assert.ok(practice,`${family} has a clearly labelled practice cue when no change is observed`);
    assert.match(practice.action,pattern);
  }
  console.log('Form feedback checks passed: quality/geometry gates, persistent posture, robust range/tempo, same-side uninterrupted segments, timestamps, holds, family cues, abstention and no input mutation. Synthetic checks do not validate real-video accuracy.');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await run();
