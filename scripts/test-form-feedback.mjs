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
  const compiled=await build({stdin:{contents:"export * from './src/ai/form-feedback.ts'; export {priorityProfiles} from './src/ai/priority-profiles.ts'; export * from './src/ai/feedback-kinematics.ts'; export * from './src/ai/one-euro.ts'; export * from './src/ai/pose-signal.ts'; export {analyzeGenericMotion} from './src/ai/generic-motion.ts'; export {analyzeSpecificMovement} from './src/ai/specific-movements.ts'; export {analyzeSquat} from './src/ai/squat.ts';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false});
  const {buildFormFeedback,priorityProfiles,extractKinematics,eccentricHalf,OneEuroFilter,smoothPoseInput,analyzeGenericMotion,analyzeSpecificMovement,analyzeSquat}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
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
  // Direction is independent of which way the lifter faces, and never inferred
  // from the old unsigned body-line observation.
  const has=(fixture,id)=>feedback(fixture).cards.find(card=>card.id===id);
  for(const source of [pushup,plank])for(const mirror of [false,true]){
    const sag=clone(source),pike=clone(source);
    for(const f of pike.result.frames)for(const id of [23,24])f.landmarks[id].y=.8-f.landmarks[id].y;
    if(mirror)for(const fixture of [sag,pike])for(const f of fixture.result.frames)for(const p of f.landmarks)p.x=1-p.x;
    assert.match(has(sag,'hip-sag-change')?.observed||'',/below.*sag/);
    assert.match(has(pike,'hip-pike-change')?.observed||'',/above.*pike/);
    assert.notEqual(has(sag,'hip-sag-change').cue,has(pike,'hip-pike-change').cue);
    assert.ok(!has(sag,'hip-pike-change')&&!has(pike,'hip-sag-change'));
  }
  // Constant deviations must not disappear merely because the first frame
  // already contains them. These are synthetic direction/persistence checks.
  for(const hold of [false,true])for(const direction of [1,-1])for(const mirror of [false,true]){
    const constant=makeFeedbackFixture({exerciseId:'pushup',hold});
    for(const frame of constant.result.frames){
      for(const id of [23,24])frame.landmarks[id].y=.4+direction*.09;
      if(mirror)for(const p of frame.landmarks)p.x=1-p.x;
    }
    const assessment=feedback(constant),id=direction===1?'hip-sag-change':'hip-pike-change';
    assert.match(assessment.cards.find(c=>c.id===id)?.observed||'',/stayed/,'Persistent starting position receives a scoped observation');
    assert.equal(assessment.checks.find(c=>c.id==='body-position').status,'finding');
  }
  assert.equal(steady.coverage.percent,100);
  assert.ok(steady.checks.some(check=>check.status==='not_detected'));
  const singlePushup=makeFeedbackFixture({exerciseId:'pushup',bodyChange:true,ranges:[100]});
  assert.match(has(singlePushup,'hip-sag-change')?.observed||'',/one rep/);
  assert.equal(feedback(singlePushup).checks.find(c=>c.id==='range-change').status,'unable');
  assert.ok(feedback(shortCoverage).checks.every(check=>check.status==='unable'||check.status==='unsupported'),'Retake never reports passing checks');
  const phaseAt=(fixture,time)=>{const r=fixture.result.reps.find(r=>time>=r.start&&time<=r.end)||fixture.result.reps.at(-1);return (time-r.start)/(r.end-r.start);};
  const rotateArm=(fixture,drift,extension=false)=>{
    for(const frame of fixture.result.frames){
      const phase=phaseAt(fixture,frame.time),bend=Math.sin(Math.PI*phase)**2;
      for(const o of [0,1]){
        const p=frame.landmarks,s=p[11+o],e=p[13+o];
        if(extension){const a=(70+100*bend)*Math.PI/180;p[15+o]={...p[15+o],x:e.x+Math.sin(a)*100/600,y:e.y-Math.cos(a)*100/800};}
        const theta=drift*bend*Math.PI/180;
        for(const id of [13+o,15+o]){const v=p[id],x=(v.x-s.x)*600,y=(v.y-s.y)*800;p[id]={...v,x:s.x+(x*Math.cos(theta)+y*Math.sin(theta))/600,y:s.y+(-x*Math.sin(theta)+y*Math.cos(theta))/800};}
      }
    }
    return fixture;
  };
  for(const id of ['curl',exerciseFor('pushdown')]){
    const stable=rotateArm(makeFeedbackFixture({exerciseId:id}),0,id!=='curl');
    const drift=rotateArm(makeFeedbackFixture({exerciseId:id}),45,id!=='curl');
    assert.ok(!has(stable,'elbow-drift-change'));
    assert.ok(has(drift,'elbow-drift-change'),`${id} spatial drift is detected even with unchanged elbow excursion`);
    assert.deepEqual(drift.result.reps.map(r=>r.rangeDegrees),stable.result.reps.map(r=>r.rangeDegrees));
    const hidden=clone(drift);for(const frame of hidden.result.frames)for(const j of [13,14])if(phaseAt(hidden,frame.time)>.18&&phaseAt(hidden,frame.time)<.9)frame.landmarks[j].visibility=.2;
    assert.ok(!has(hidden,'elbow-drift-change'),'Occluded elbows do not generate drift corrections');
  }
  const retime=(fixture,first,second)=>{
    const old=clone(fixture.result.reps);let end=0;
    const mapped=old.map((r,i)=>{const a=Array.isArray(first)?first[i]:first,b=Array.isArray(second)?second[i]:second;const n={...r,start:end,bottom:end+a,end:end+a+b,descentSeconds:a,ascentSeconds:b};end=n.end;return n;});
    fixture.result.frames.forEach(frame=>{const i=old.findIndex(r=>frame.time>=r.start-1e-7&&frame.time<=r.end+1e-7),r=old[i],n=mapped[i];frame.time=frame.time<=r.bottom?n.start+(frame.time-r.start)/(r.bottom-r.start)*(n.bottom-n.start):n.bottom+(frame.time-r.bottom)/(r.end-r.bottom)*(n.end-n.bottom);});
    fixture.result.reps=mapped;fixture.result.duration=end;return fixture;
  };
  const fastSquat=retime(makeFeedbackFixture({exerciseId:'squat',metric:'knee'}),.55,1.8);
  assert.ok(has(fastSquat,'tempo-eccentric-control'));
  assert.match(has(fastSquat,'tempo-eccentric-control').observed,/0.55 s.*1.80 s/);
  const fastCurl=retime(makeFeedbackFixture(),1.8,.55);
  assert.ok(has(fastCurl,'tempo-eccentric-control'),'Curl lowering is the SECOND phase');
  assert.ok(!has(retime(makeFeedbackFixture(),.55,1.8),'tempo-eccentric-control'),'Fast curl concentric is not labelled rushed eccentric');
  assert.equal(eccentricHalf(['Pulling down','Returning overhead']),1);
  assert.equal(eccentricHalf(['First phase','Return phase']),undefined,'Unknown generic cycles do not invent muscle-action phases');
  const slowLift=retime(makeFeedbackFixture(),[1,1,1.8,1.8],1);
  assert.ok(has(slowLift,'concentric-slowing'));
  assert.ok(!has(retime(makeFeedbackFixture(),1,[1,1,1.8,1.8]),'concentric-slowing'),'Slow lowering alone is not a concentric grind');

  const hipShoot=makeFeedbackFixture({exerciseId:'squat',metric:'knee'});
  for(const f of hipShoot.result.frames){
    const phase=phaseAt(hipShoot,f.time),rise=phase>.5?Math.min(1,(phase-.5)/.07,(1-phase)/.15):0;
    const lean=(10+32*Math.max(0,rise))*Math.PI/180;
    for(const o of [0,1]){const h=f.landmarks[23+o];f.landmarks[11+o]={...f.landmarks[11+o],x:h.x+Math.sin(lean)*160/600,y:h.y-Math.cos(lean)*160/800};}
  }
  assert.ok(has(hipShoot,'hip-shoot-change'),'Early ascent lean at matched knee angles detects hip shoot');
  const symmetricLean=clone(hipShoot);
  for(const f of symmetricLean.result.frames){const phase=phaseAt(symmetricLean,f.time),lean=(10+25*Math.sin(Math.PI*phase)**2)*Math.PI/180;for(const o of [0,1]){const h=f.landmarks[23+o];f.landmarks[11+o]={...f.landmarks[11+o],x:h.x+Math.sin(lean)*160/600,y:h.y-Math.cos(lean)*160/800};}}
  assert.ok(!has(symmetricLean,'hip-shoot-change'),'Normal matched descent/ascent torso motion is not hip shoot');

  const heelRise=makeFeedbackFixture({exerciseId:'squat',metric:'knee'});
  for(const f of heelRise.result.frames)for(const o of [0,1]){
    const a=f.landmarks[27+o],lift=.12*Math.sin(Math.PI*phaseAt(heelRise,f.time))**2;
    f.landmarks[29+o]={...a,x:a.x-.035,y:a.y-lift*160/800};f.landmarks[31+o]={...a,x:a.x+.035};
  }
  assert.ok(has(heelRise,'heel-rise-change'));
  const hiddenHeel=clone(heelRise);for(const f of hiddenHeel.result.frames)for(const j of [29,30])f.landmarks[j].visibility=.5;
  assert.ok(!has(hiddenHeel,'heel-rise-change'),'Hidden optional foot points abstain independently');

  assert.equal(feedback(hiddenHeel).checks.find(c=>c.id==='heel-rise-change').status,'unable');
  const brieflyHiddenHeel=clone(heelRise);
  for(const frame of brieflyHiddenHeel.result.frames)if(Math.abs(frame.time-.5)<.01)for(const id of [29,30])frame.landmarks[id].visibility=.1;
  assert.ok(has(brieflyHiddenHeel,'heel-rise-change'),'An optional landmark gap outside a sustained evidence window does not erase the entire check');
  assert.equal(feedback(brieflyHiddenHeel).checks.find(c=>c.id==='heel-rise-change').status,'finding');
  const handDrift=makeFeedbackFixture({exerciseId:'rdl',metric:'hip'});
  for(const f of handDrift.result.frames)for(const o of [0,1]){const k=f.landmarks[25+o],amount=.35*Math.sin(Math.PI*phaseAt(handDrift,f.time))**2;f.landmarks[15+o]={...k,x:k.x+amount*200/600};}
  assert.ok(has(handDrift,'hinge-hand-drift'));
  assert.match(has(handDrift,'hinge-hand-drift').observed,/not tracked/);
  const shrug=makeFeedbackFixture({exerciseId:exerciseFor('frontRaise'),metric:'shoulder'});
  for(const f of shrug.result.frames)for(const o of [0,1]){const s=f.landmarks[11+o],compression=.5*Math.sin(Math.PI*phaseAt(shrug,f.time))**2;f.landmarks[7+o]={...s,y:s.y-.18*(1-compression)};}
  assert.ok(has(shrug,'shoulder-shrug-change'));
  assert.match(has(shrug,'shoulder-shrug-change').action,/normal.*upward rotation/);
  const hiddenHead=clone(shrug);for(const f of hiddenHead.result.frames)for(const j of [7,8])f.landmarks[j].visibility=.1;
  assert.ok(!has(hiddenHead,'shoulder-shrug-change'));

  const cut=clone(hipShoot);for(const frame of cut.result.frames)if(frame.time>=3)for(const p of frame.landmarks)p.x+=.18;
  assert.equal(feedback(cut).status,'retake','Coherent camera/person jumps withhold movement corrections');
  const interrupted=clone(hipShoot);for(const f of interrupted.result.frames)if([.6,2.6,4.6,6.6].some(t=>Math.abs(t-f.time)<.01))f.valid=false;
  assert.ok(!has(interrupted,'hip-shoot-change'),'No hip-shoot claim across per-rep tracking gaps');
  const mixed=clone(hipShoot);mixed.result.reps.forEach((r,i)=>r.side=i%2?'right':'left');
  assert.ok(!has(mixed,'hip-shoot-change'),'No repeated compensation assembled across switching sides');
  for(const fixture of [hipShoot,heelRise,handDrift,shrug,fastCurl,plank]){
    const f=feedback(fixture);assert.ok(f.cards.length<=3);
    const order={capture:0,technique:1,consistency:2,practice:3};assert.deepEqual(f.cards.map(c=>order[c.kind]),f.cards.map(c=>order[c.kind]).sort());
    for(const card of f.cards.filter(c=>c.highlight)){assert.ok(card.time>=0&&card.time<=fixture.result.duration);assert.ok(card.highlight.joints.length>=2);}
  }
  const limited=clone(hipShoot);limited.result.validFraction=.75;assert.equal(feedback(limited).cards[0].kind,'capture');
  assert.match(steady.cards[0].observed,/Median lowering\/lifting.*rep-range spread.*torso-angle variance/);

  // Pixel units and torso normalization preserve spatial metrics when the same
  // projected body is embedded in a different video aspect ratio or distance.
  const original=pushup.result.frames[10].landmarks,kin=extractKinematics(original,'left',pushup.dimensions);
  const resized=original.map(p=>({...p,x:p.x*600/1200,y:p.y*800/1000}));
  const scaled=original.map(p=>({...p,x:.2+p.x*.6,y:.2+p.y*.6}));
  assert.ok(Math.abs(extractKinematics(resized,'left',{width:1200,height:1000}).hipOffset-kin.hipOffset)<1e-10);
  assert.ok(Math.abs(extractKinematics(scaled,'left',pushup.dimensions).hipOffset-kin.hipOffset)<1e-10);

  const filter=new OneEuroFilter(),same=new OneEuroFilter(),signal=Array.from({length:40},(_,i)=>100+(i%2?1:-1));
  const output=signal.map((v,i)=>filter.filter(v,i/10));
  assert.deepEqual(output,signal.map((v,i)=>same.filter(v,i/10)),'One Euro is deterministic');
  assert.ok(Math.max(...output.slice(10))-Math.min(...output.slice(10))<1.2,'Stationary jitter is attenuated');
  assert.equal(filter.filter(5,10),5,'Long gaps reset filter history');
  assert.ok(Number.isNaN(filter.filter(NaN,10.1)));assert.equal(filter.filter(7,10.2),7,'Invalid input never bleeds into the next segment');
  const adaptive=new OneEuroFilter(),fixed=new OneEuroFilter(1.2,0,1);
  for(let i=0;i<10;i++){adaptive.filter(0,i/10);fixed.filter(0,i/10);}
  assert.ok(adaptive.filter(90,1)>fixed.filter(90,1),'Fast movement raises cutoff to reduce lag');
  const raw={...base.dimensions,duration:base.result.duration,sampleRate:10,frames:base.result.frames.map(f=>({time:f.time,poses:[f.landmarks],worldLandmarks:[f.landmarks.map(p=>({...p,x:p.x-.5,y:p.y-.5}))]}))};
  const rawBefore=JSON.stringify(raw),filtered=smoothPoseInput(raw);
  assert.equal(JSON.stringify(raw),rawBefore,'Landmark filtering does not mutate source data');
  assert.deepEqual(filtered.frames[5].worldLandmarks,raw.frames[5].worldLandmarks);
  const withOcclusion=clone(raw);withOcclusion.frames[8].poses[0][13].visibility=0;
  assert.equal(smoothPoseInput(withOcclusion).frames[8].poses[0][13].visibility,0,'Filtering never raises missing-joint confidence');
  for(const analyze of [input=>analyzeGenericMotion(input,'elbow','Curl'),input=>analyzeSpecificMovement(input,'curl'),analyzeSquat]){
    const result=analyze(filtered);assert.deepEqual(result.frames[0].worldLandmarks,raw.frames[0].worldLandmarks[0],'Analyzers retain optional world landmarks');
  }
  const twoD=clone(raw);twoD.frames.forEach(f=>delete f.worldLandmarks);
  assert.equal(analyzeGenericMotion(smoothPoseInput(twoD),'elbow','Curl').frames[0].worldLandmarks,undefined);
  for(const [fixture,id] of [[pushup,'hip-sag-change'],[rotateArm(makeFeedbackFixture(),45),'elbow-drift-change'],[hipShoot,'hip-shoot-change']]){
    const input=smoothPoseInput({...fixture.dimensions,duration:fixture.result.duration,sampleRate:10,frames:fixture.result.frames.map(f=>({time:f.time,poses:[f.landmarks]}))});
    const measured=fixture.exerciseId==='squat'?analyzeSquat(input):analyzeSpecificMovement(input,fixture.exerciseId,fixture.exerciseId);
    assert.ok(has({...fixture,result:measured},id),`${id} survives the live smoothing and rep-segmentation pipeline`);
  }
  console.log('Form feedback checks passed: legacy regressions plus signed body line, elbow drift, phase-aware tempo, hip shoot, heel/hand/head checks, persistence, cut/occlusion/side gates, scale invariance, deterministic adaptive filtering and optional world landmarks. Synthetic checks do not validate real-video accuracy.');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await run();
