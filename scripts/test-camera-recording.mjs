import assert from 'node:assert/strict';
import {build} from 'esbuild';

const compiled=await build({entryPoints:['src/ai/camera-recording.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {CameraRecordingController,CAMERA_LIMITS,selectRecordingMimeType}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const flush=async()=>{await Promise.resolve();await Promise.resolve()};
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}};

class Clock{
  value=10000;
  next=1;
  timers=new Map();
  now=()=>this.value;
  setTimer=(callback,delay)=>{const id=this.next++;this.timers.set(id,{callback,at:this.value+Math.max(0,delay)});return id};
  clearTimer=id=>this.timers.delete(id);
  advance(milliseconds){
    const target=this.value+milliseconds;
    let callbacks=0;
    while(true){
      const next=[...this.timers].filter(([,timer])=>timer.at<=target).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];
      if(!next)break;
      assert.ok(++callbacks<10000,'The camera timer must not spin without advancing time.');
      this.value=next[1].at;this.timers.delete(next[0]);next[1].callback();
    }
    this.value=target;
  }
}

function stream(){
  const listeners=new Map();
  const track={kind:'video',readyState:'live',stops:0,onended:null,stop(){this.stops++;this.readyState='ended'},addEventListener(type,listener){const set=listeners.get(type)||new Set();set.add(listener);listeners.set(type,set)},removeEventListener(type,listener){listeners.get(type)?.delete(listener)}};
  return {track,getTracks:()=>[track],getVideoTracks:()=>[track],getAudioTracks:()=>[],active:true,end(){track.readyState='ended';for(const listener of [...(listeners.get('ended')||[])])listener()}};
}

function harness(options={}){
  const clock=new Clock(),media=stream(),requests=[],recorders=[],changes=[],files=[];
  const controller=new CameraRecordingController({
    getUserMedia:async constraints=>{requests.push(constraints);return options.media?options.media(constraints):media},
    createRecorder:(input,settings)=>{
      if(options.createError)throw options.createError;
      const recorder={stream:input,settings,state:'inactive',mimeType:settings?.mimeType||'video/webm',starts:0,stops:0,ondataavailable:null,onerror:null,onstop:null,
        start(timeslice){if(options.startError)throw options.startError;this.starts++;this.timeslice=timeslice;this.state='recording'},
        stop(){assert.notEqual(this.state,'inactive','Only an active recorder may be stopped.');this.stops++;this.state='inactive';if(options.noStopEvent)return;queueMicrotask(()=>{const data=options.chunk??new Blob([new Uint8Array(32)],{type:this.mimeType});if(data.size)this.ondataavailable?.({data});this.onstop?.()})},
      };
      recorders.push(recorder);return recorder;
    },
    isTypeSupported:options.isTypeSupported||(()=>true),
    now:clock.now,setTimer:clock.setTimer,clearTimer:clock.clearTimer,
    createFile:options.createFile||((parts,name,settings)=>new File(parts,name,settings)),
    onChange:state=>changes.push({...state}),onComplete:file=>files.push(file),
  });
  return {controller,clock,media,requests,recorders,changes,files};
}

let passed=0;
async function test(name,run){await run();passed++;console.log(`PASS ${name}`)}

await test('Browser-supported MIME selection prefers MP4, then compatible WebM, then the browser default',async()=>{
  assert.match(selectRecordingMimeType(()=>true),/^video\/mp4/i);
  assert.match(selectRecordingMimeType(type=>/video\/webm/i.test(type)),/^video\/webm.*vp8/i);
  assert.match(selectRecordingMimeType(type=>/vp9/i.test(type)),/vp9/i);
  assert.equal(selectRecordingMimeType(type=>type==='video/webm'),'video/webm');
  assert.equal(selectRecordingMimeType(()=>false),undefined);
  assert.equal(CAMERA_LIMITS.minSeconds,2);
  assert.equal(CAMERA_LIMITS.maxSeconds,60);
  assert.equal(CAMERA_LIMITS.maxBytes,100*1024*1024);
});

await test('Opening the camera is explicit and requests video without microphone access',async()=>{
  const h=harness();assert.equal(h.requests.length,0);assert.equal(h.controller.state.status,'idle');
  await h.controller.open();
  assert.equal(h.requests.length,1);assert.equal(h.requests[0].audio,false);
  assert.equal(h.requests[0].video.facingMode.ideal,'environment');
  assert.equal(h.controller.state.status,'preview');assert.equal(h.controller.state.stream,h.media);
  h.controller.cancel();assert.ok(h.media.track.stops>0);assert.equal(h.controller.state.stream,null);
  const front=harness();await front.controller.open('user');assert.equal(front.requests[0].video.facingMode.ideal,'user');front.controller.dispose();
});

await test('Cancelling a pending camera request closes tracks that arrive late',async()=>{
  const request=deferred(),late=stream(),h=harness({media:()=>request.promise});
  const opening=h.controller.open();assert.equal(h.controller.state.status,'opening');
  h.controller.cancel();request.resolve(late);await opening;await flush();
  assert.ok(late.track.stops>0);assert.equal(h.controller.state.stream,null);assert.equal(h.files.length,0);
  assert.notEqual(h.controller.state.status,'preview');assert.equal(h.clock.timers.size,0);
});

await test('Unmounting while permission is pending stops late tracks without later callbacks',async()=>{
  const request=deferred(),late=stream(),h=harness({media:()=>request.promise});
  const opening=h.controller.open();h.controller.dispose();const notifications=h.changes.length;
  request.resolve(late);await opening;await flush();h.clock.advance(10000);await flush();
  assert.ok(late.track.stops>0);assert.equal(h.files.length,0);assert.equal(h.changes.length,notifications);assert.equal(h.clock.timers.size,0);
});

await test('Countdown cancellation never starts a recording',async()=>{
  const h=harness();await h.controller.open();h.controller.start(3);
  assert.equal(h.controller.state.status,'countdown');h.clock.advance(1000);h.controller.cancel();h.clock.advance(10000);await flush();
  assert.equal(h.recorders.reduce((sum,recorder)=>sum+recorder.starts,0),0);assert.equal(h.files.length,0);assert.ok(h.media.track.stops>0);assert.equal(h.clock.timers.size,0);
});

await test('Countdown time is excluded from clip duration',async()=>{
  const h=harness();await h.controller.open();h.controller.start(3);h.clock.advance(3000);
  assert.equal(h.controller.state.status,'recording');assert.equal(h.recorders[0].starts,1);
  h.clock.advance(1000);h.controller.stop();await flush();
  assert.equal(h.files.length,0,'A three-second countdown must not make a one-second clip acceptable.');
  assert.equal(h.controller.state.status,'error');assert.match(h.controller.state.message,/2|short|longer|seconds/i);h.controller.dispose();
});

await test('An eligible clip completes once and closes camera tracks',async()=>{
  const h=harness();await h.controller.open();h.controller.start(0);assert.equal(h.controller.state.status,'recording');
  h.clock.advance(2200);h.controller.stop();await flush();
  assert.equal(h.files.length,1);assert.ok(h.files[0] instanceof File);assert.ok(h.files[0].size>0);assert.match(h.files[0].type,/^video\//);
  assert.equal(h.controller.state.status,'complete');assert.equal(h.controller.state.stream,null);assert.ok(h.media.track.stops>0);assert.equal(h.clock.timers.size,0);
  h.controller.stop();await flush();assert.equal(h.files.length,1);h.controller.dispose();
});

await test('The maximum duration stops capture automatically',async()=>{
  const h=harness();await h.controller.open();h.controller.start(0);h.clock.advance(CAMERA_LIMITS.maxSeconds*1000);await flush();
  assert.equal(h.recorders[0].stops,1);assert.equal(h.files.length,1);assert.equal(h.controller.state.status,'complete');assert.ok(h.media.track.stops>0);assert.equal(h.clock.timers.size,0);h.controller.dispose();
});

await test('An oversized final file is rejected without allocating a large video',async()=>{
  const h=harness({createFile:(parts,name,options)=>{const file=new File(parts,name,options);Object.defineProperty(file,'size',{value:CAMERA_LIMITS.maxBytes+1});return file}});
  await h.controller.open();h.controller.start(0);h.clock.advance(2200);h.controller.stop();await flush();
  assert.equal(h.files.length,0);assert.equal(h.controller.state.status,'error');assert.match(h.controller.state.message,/100|large|size|limit/i);assert.ok(h.media.track.stops>0);h.controller.dispose();
});

await test('Oversized recorded data is discarded before delivery',async()=>{
  const chunk=new Blob(['small payload']);Object.defineProperty(chunk,'size',{value:CAMERA_LIMITS.maxBytes+1});
  const h=harness({chunk});await h.controller.open();h.controller.start(0);h.clock.advance(2200);h.controller.stop();await flush();
  assert.equal(h.files.length,0);assert.equal(h.controller.state.status,'error');assert.match(h.controller.state.message,/100|large|size|limit/i);assert.ok(h.media.track.stops>0);h.controller.dispose();
});

await test('Permission failure reports a recoverable camera error',async()=>{
  const h=harness({media:async()=>{throw new DOMException('Permission denied','NotAllowedError')}});await h.controller.open();
  assert.equal(h.controller.state.status,'error');assert.match(h.controller.state.message,/camera|permission|allow|denied/i);assert.equal(h.files.length,0);assert.equal(h.controller.state.stream,null);h.controller.dispose();
});

await test('Recorder construction and start failures release camera tracks',async()=>{
  for(const options of [{createError:new Error('Encoder unavailable')},{startError:new Error('Encoder failed to start')}]){
    const h=harness(options);await h.controller.open();h.controller.start(0);await flush();
    assert.equal(h.controller.state.status,'error');assert.ok(h.controller.state.message);assert.equal(h.files.length,0);assert.ok(h.media.track.stops>0);assert.equal(h.clock.timers.size,0);h.controller.dispose();
  }
});

await test('A recorder error discards partial data and clears capture resources',async()=>{
  const h=harness();await h.controller.open();h.controller.start(0);h.clock.advance(2200);h.recorders[0].onerror?.({error:new DOMException('Capture failed','NotReadableError')});await flush();
  assert.equal(h.files.length,0);assert.equal(h.controller.state.status,'error');assert.ok(h.controller.state.message);assert.ok(h.media.track.stops>0);assert.equal(h.clock.timers.size,0);h.controller.dispose();
});

await test('Empty recordings are rejected',async()=>{
  const h=harness({chunk:new Blob([])});await h.controller.open();h.controller.start(0);h.clock.advance(2200);h.controller.stop();await flush();
  assert.equal(h.files.length,0);assert.equal(h.controller.state.status,'error');assert.ok(h.controller.state.message);assert.ok(h.media.track.stops>0);h.controller.dispose();
});

await test('Leaving the foreground discards an in-progress recording',async()=>{
  const h=harness();await h.controller.open();h.controller.start(0);h.clock.advance(3000);h.controller.interrupt();await flush();h.clock.advance(60000);await flush();
  assert.equal(h.files.length,0);assert.equal(h.controller.state.status,'error');assert.match(h.controller.state.message,/background|interrupt|record|capture|tab/i);assert.ok(h.media.track.stops>0);assert.equal(h.clock.timers.size,0);h.controller.dispose();
});

await test('Cancelling while the recorder is stopping suppresses late completion',async()=>{
  const h=harness();await h.controller.open();h.controller.start(0);h.clock.advance(2200);h.controller.stop();h.controller.cancel();await flush();
  assert.equal(h.files.length,0);assert.ok(h.media.track.stops>0);assert.equal(h.controller.state.stream,null);assert.equal(h.clock.timers.size,0);
});

await test('Disposal suppresses late recorder events and all timers',async()=>{
  const h=harness();await h.controller.open();h.controller.start(0);h.clock.advance(2200);h.controller.dispose();const notifications=h.changes.length;
  await flush();h.clock.advance(60000);await flush();
  assert.equal(h.files.length,0);assert.equal(h.changes.length,notifications);assert.ok(h.media.track.stops>0);assert.equal(h.clock.timers.size,0);
});

await test('A superseded camera request cannot replace the newest preview',async()=>{
  const first=deferred(),second=deferred(),oldStream=stream(),newStream=stream();let requests=0;
  const h=harness({media:()=>requests++===0?first.promise:second.promise});
  const oldOpening=h.controller.open(),newOpening=h.controller.open('user');
  second.resolve(newStream);await newOpening;assert.equal(h.controller.state.stream,newStream);
  first.resolve(oldStream);await oldOpening;assert.ok(oldStream.track.stops>0);assert.equal(newStream.track.stops,0);assert.equal(h.controller.state.stream,newStream);h.controller.dispose();
});

await test('Unexpected audio tracks are stopped and removed before recording',async()=>{
  const input=stream(),audio={kind:'audio',stops:0,stop(){this.stops++}};let tracks=[input.track,audio];
  input.getTracks=()=>tracks;input.removeTrack=track=>{tracks=tracks.filter(candidate=>candidate!==track)};
  const h=harness({media:async()=>input});await h.controller.open();
  assert.equal(audio.stops,1);assert.deepEqual(input.getTracks(),[input.track]);h.controller.start(0);
  assert.ok(h.recorders[0].stream.getTracks().every(track=>track.kind==='video'));h.controller.cancel();await flush();assert.equal(h.files.length,0);
});

await test('A disconnected camera discards the take and releases timers',async()=>{
  const h=harness();await h.controller.open();h.controller.start(0);h.clock.advance(2200);h.media.end();await flush();
  assert.equal(h.files.length,0);assert.equal(h.controller.state.status,'error');assert.match(h.controller.state.message,/disconnect|camera/i);assert.ok(h.media.track.stops>0);assert.equal(h.clock.timers.size,0);h.controller.dispose();
});

await test('An unexpected recorder stop is not treated as successful capture',async()=>{
  const h=harness();await h.controller.open();h.controller.start(0);h.clock.advance(2200);h.recorders[0].onstop?.();await flush();
  assert.equal(h.files.length,0);assert.equal(h.controller.state.status,'error');assert.match(h.controller.state.message,/interrupt/i);assert.ok(h.media.track.stops>0);h.controller.dispose();
});

await test('A missing final recorder event times out instead of holding the camera open',async()=>{
  const h=harness({noStopEvent:true});await h.controller.open();h.controller.start(0);h.clock.advance(2200);h.controller.stop();
  assert.equal(h.controller.state.status,'stopping');h.clock.advance(5100);await flush();
  assert.equal(h.files.length,0);assert.equal(h.controller.state.status,'error');assert.ok(h.media.track.stops>0);assert.equal(h.clock.timers.size,0);h.controller.dispose();
});

await test('MIME probing errors and browser-default encoding remain usable',async()=>{
  assert.equal(selectRecordingMimeType(type=>{if(type.includes('codecs'))throw new Error('Probe failed');return type==='video/mp4'}),'video/mp4');
  const h=harness({isTypeSupported:()=>false});await h.controller.open();h.controller.start(0);
  assert.equal(h.recorders[0].settings.mimeType,undefined);h.clock.advance(2200);h.controller.stop();await flush();
  assert.equal(h.files.length,1);assert.equal(h.files[0].type,'video/webm');h.controller.dispose();
});

console.log(`Camera lifecycle checks passed: ${passed} cases, using injected streams, recorder events and timers; no browser or camera access.`);
