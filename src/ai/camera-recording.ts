export const CAMERA_LIMITS={minSeconds:2,maxSeconds:60,maxBytes:100*1024*1024} as const;
// Leave room for encoder finalization before the existing 60-second decode limit.
const AUTO_STOP_SECONDS=59;
export type CameraStatus='idle'|'opening'|'preview'|'countdown'|'recording'|'stopping'|'complete'|'error'|'closed';
export type CameraState={status:CameraStatus;stream:MediaStream|null;countdown:number|null;elapsed:number;message:string};
export type CameraCountdown=0|3|5|10;
type Timer=ReturnType<typeof setTimeout>;
export type CameraDependencies={
  getUserMedia:(constraints:MediaStreamConstraints)=>Promise<MediaStream>;
  createRecorder:(stream:MediaStream,options:MediaRecorderOptions)=>MediaRecorder;
  isTypeSupported:(type:string)=>boolean;
  now:()=>number;
  setTimer:(callback:()=>void,delay:number)=>Timer;
  clearTimer:(timer:Timer)=>void;
  createFile?:(parts:BlobPart[],name:string,options:FilePropertyBag)=>File;
  onChange:(state:CameraState)=>void;
  onComplete:(file:File)=>void;
};

export function selectRecordingMimeType(isTypeSupported:(type:string)=>boolean):string|undefined{
  return ['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp8','video/webm;codecs=vp9','video/webm'].find(type=>{
    try{return isTypeSupported(type);}catch{return false;}
  });
}

export function cameraErrorMessage(cause:unknown):string{
  const name=cause&&typeof cause==='object'&&'name' in cause?String(cause.name):'';
  if(name==='NotAllowedError'||name==='SecurityError')return 'Camera access was not allowed. Enable camera permission for this site in your browser settings, or choose a video instead.';
  if(name==='NotFoundError'||name==='DevicesNotFoundError')return 'No camera was found. Connect a camera or choose a video instead.';
  if(name==='NotReadableError'||name==='TrackStartError')return 'The camera could not be opened. Close other apps using it, then retry or choose a video instead.';
  if(name==='OverconstrainedError')return 'This camera could not use the requested settings. Try another camera or choose a video instead.';
  return 'Camera recording is unavailable in this browser. Retry, use an updated browser, or choose a video instead.';
}

/** Local capture lifecycle, with injected browser APIs and clock for regression tests. */
export class CameraRecordingController{
  private snapshot:CameraState={status:'idle',stream:null,countdown:null,elapsed:0,message:''};
  private generation=0;
  private disposed=false;
  private recorder:MediaRecorder|null=null;
  private stream:MediaStream|null=null;
  private timers=new Set<Timer>();
  private removeTrackListeners:Array<()=>void>=[];
  private startedAt:number|null=null;
  private stoppedAfter=0;
  private chunks:Blob[]=[];
  private bytes=0;
  constructor(private deps:CameraDependencies){}
  get state(){return {...this.snapshot};}
  private publish(changes:Partial<CameraState>){
    this.snapshot={...this.snapshot,...changes};
    if(!this.disposed)this.deps.onChange(this.state);
  }
  private schedule(callback:()=>void,delay:number){
    const handle=this.deps.setTimer(()=>{this.timers.delete(handle);callback();},delay);
    this.timers.add(handle);
  }
  private clearTimers(){for(const timer of this.timers)this.deps.clearTimer(timer);this.timers.clear();}
  private releaseStream(){
    this.removeTrackListeners.forEach(remove=>remove());this.removeTrackListeners=[];
    this.stream?.getTracks().forEach(track=>track.stop());this.stream=null;
  }
  private detachRecorder(){
    const recorder=this.recorder;this.recorder=null;
    if(recorder){recorder.ondataavailable=null;recorder.onstop=null;recorder.onerror=null;if(recorder.state!=='inactive'){try{recorder.stop();}catch{/* Track cleanup below still releases the camera. */}}}
  }
  private reset(){
    this.generation++;this.clearTimers();this.detachRecorder();this.releaseStream();
    this.chunks=[];this.bytes=0;this.startedAt=null;this.stoppedAfter=0;
  }
  private fail(message:string){this.reset();this.publish({status:'error',stream:null,countdown:null,elapsed:0,message});}
  async open(facing:'environment'|'user'='environment'){
    if(this.disposed)return;
    this.reset();const generation=this.generation;
    this.publish({status:'opening',stream:null,countdown:null,elapsed:0,message:'Allow camera access to see your preview. Recording has not started.'});
    try{
      const stream=await this.deps.getUserMedia({audio:false,video:{facingMode:{ideal:facing},width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}}});
      if(this.disposed||generation!==this.generation){stream.getTracks().forEach(track=>track.stop());return;}
      this.stream=stream;
      // Audio is never requested or included, even if an unusual provider returns it.
      stream.getTracks().filter(track=>track.kind==='audio').forEach(track=>{track.stop();stream.removeTrack(track);});
      const videoTracks=stream.getTracks().filter(track=>track.kind==='video'&&track.readyState!=='ended');
      if(!videoTracks.length){this.fail('The camera returned no usable video. Retry or choose a video instead.');return;}
      for(const track of videoTracks){
        const ended=()=>{if(generation===this.generation&&!this.disposed)this.fail('The camera disconnected. Reconnect it and record again, or choose a video instead.');};
        track.addEventListener('ended',ended);this.removeTrackListeners.push(()=>track.removeEventListener('ended',ended));
      }
      this.publish({status:'preview',stream,countdown:null,elapsed:0,message:'Camera ready. Set your phone down, choose your delay, then start recording.'});
    }catch(cause){if(!this.disposed&&generation===this.generation)this.fail(cameraErrorMessage(cause));}
  }
  start(countdownSeconds:CameraCountdown){
    if(this.disposed||this.snapshot.status!=='preview'||!this.stream)return;
    if(![0,3,5,10].includes(countdownSeconds))return;
    const generation=this.generation,deadline=this.deps.now()+countdownSeconds*1000;
    if(!countdownSeconds){this.beginRecording(generation);return;}
    this.publish({status:'countdown',countdown:countdownSeconds,message:`Recording starts in ${countdownSeconds} seconds.`});
    const tick=()=>{
      if(this.disposed||generation!==this.generation||this.snapshot.status!=='countdown')return;
      const remaining=Math.max(0,Math.ceil((deadline-this.deps.now())/1000));
      if(!remaining){this.beginRecording(generation);return;}
      if(remaining!==this.snapshot.countdown)this.publish({countdown:remaining,message:`Recording starts in ${remaining} ${remaining===1?'second':'seconds'}.`});
      this.schedule(tick,100);
    };
    this.schedule(tick,100);
  }
  private beginRecording(generation:number){
    if(!this.stream||this.disposed||generation!==this.generation)return;
    try{
      const mimeType=selectRecordingMimeType(this.deps.isTypeSupported);
      const recorder=this.deps.createRecorder(this.stream,{...(mimeType?{mimeType}:{}),videoBitsPerSecond:2_500_000});
      this.recorder=recorder;this.chunks=[];this.bytes=0;
      recorder.ondataavailable=event=>{
        if(this.disposed||generation!==this.generation||!event.data.size)return;
        this.bytes+=event.data.size;
        if(this.bytes>CAMERA_LIMITS.maxBytes){this.fail('Recording exceeded 100 MB and was discarded. Record a shorter set or choose a smaller video.');return;}
        this.chunks.push(event.data);
      };
      recorder.onerror=()=>{if(!this.disposed&&generation===this.generation)this.fail('The browser could not finish this recording. Record again or choose a video instead.');};
      recorder.onstop=()=>{
        if(this.disposed||generation!==this.generation)return;
        // An unexpected recorder stop is not silently treated as a complete take.
        if(this.snapshot.status!=='stopping'){this.fail('Recording was interrupted. Keep the app visible and record your set again.');return;}
        const duration=this.stoppedAfter;
        if(duration<CAMERA_LIMITS.minSeconds||duration>CAMERA_LIMITS.maxSeconds){this.fail(`Record at least ${CAMERA_LIMITS.minSeconds} seconds and no more than ${CAMERA_LIMITS.maxSeconds} seconds. This take was discarded.`);return;}
        const type=recorder.mimeType||this.chunks.find(chunk=>chunk.type)?.type||mimeType;
        if(!this.bytes||!type?.startsWith('video/')){this.fail('The browser returned an empty or unsupported recording. Record again or choose a video instead.');return;}
        try{
          const extension=/mp4/i.test(type)?'mp4':/webm/i.test(type)?'webm':'mov';
          const file=(this.deps.createFile||((parts,name,options)=>new File(parts,name,options)))(this.chunks,`form-recording-${Date.now()}.${extension}`,{type,lastModified:Date.now()});
          if(!file.size||file.size>CAMERA_LIMITS.maxBytes){this.fail('Recording exceeded the 100 MB limit or was empty. Record a shorter set or choose a video instead.');return;}
          this.clearTimers();recorder.ondataavailable=null;recorder.onerror=null;recorder.onstop=null;this.recorder=null;this.releaseStream();this.chunks=[];this.bytes=0;
          this.publish({status:'complete',stream:null,countdown:null,elapsed:duration,message:'Recording ready. Review the clip and confirm the exercise before analysis.'});
          this.deps.onComplete(file);
        }catch{this.fail('This browser could not save the recording locally. Record again or choose a video instead.');}
      };
      this.startedAt=this.deps.now();
      recorder.start(250);
      this.publish({status:'recording',countdown:null,elapsed:0,message:'Recording. Complete your set, then stop. The camera stops automatically before 60 seconds.'});
      const tick=()=>{
        if(this.disposed||generation!==this.generation||this.snapshot.status!=='recording'||this.startedAt===null)return;
        const elapsed=(this.deps.now()-this.startedAt)/1000;
        if(elapsed>=AUTO_STOP_SECONDS){this.stop();return;}
        this.publish({elapsed});this.schedule(tick,100);
      };
      this.schedule(tick,100);
    }catch(cause){this.fail(cameraErrorMessage(cause));}
  }
  stop(){
    if(this.disposed||this.snapshot.status!=='recording'||!this.recorder||this.startedAt===null)return;
    this.clearTimers();this.stoppedAfter=(this.deps.now()-this.startedAt)/1000;
    this.publish({status:'stopping',elapsed:this.stoppedAfter,message:'Finishing your local recording…'});
    try{
      this.recorder.stop();
      if(this.state.status==='stopping')this.schedule(()=>this.fail('The browser could not finish the recording. Please record again or choose a video instead.'),5000);
    }catch{this.fail('The recording could not be stopped cleanly. Please record again or choose a video instead.');}
  }
  cancel(){if(this.disposed)return;this.reset();this.publish({status:'closed',stream:null,countdown:null,elapsed:0,message:'Camera closed. No recording was kept.'});}
  interrupt(message='Camera closed because the app was hidden. Keep this screen visible and record again; the interrupted take was discarded.'){if(!['opening','preview','countdown','recording','stopping'].includes(this.snapshot.status)||this.disposed)return;this.fail(message);}
  dispose(){if(this.disposed)return;this.disposed=true;this.reset();this.snapshot={...this.snapshot,status:'closed',stream:null,countdown:null};}
}
