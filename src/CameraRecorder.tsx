import {forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';
import {ArrowLeft,Camera,CameraOff,CircleAlert,LoaderCircle,RefreshCw,Square,Upload,X} from 'lucide-react';
import {CameraRecordingController,type CameraCountdown,type CameraState} from './ai/camera-recording';
import './camera-recording.css';

export type CameraRecorderHandle={open:()=>void;close:()=>void};
type Props={exerciseName:string;setup:string;onCaptured:(file:File)=>void;onUpload:()=>void;onActiveChange:(active:boolean)=>void};
const initialState:CameraState={status:'idle',stream:null,countdown:null,elapsed:0,message:''};
const elapsedLabel=(seconds:number)=>`${Math.floor(seconds/60)}:${Math.floor(seconds%60).toString().padStart(2,'0')}`;

export const CameraRecorder=forwardRef<CameraRecorderHandle,Props>(function CameraRecorder(props,ref){
  const [state,setState]=useState<CameraState>(initialState);
  const [delay,setDelay]=useState<CameraCountdown>(5);
  const [facing,setFacing]=useState<'environment'|'user'>('environment');
  const [previewReady,setPreviewReady]=useState(false);
  const [previewError,setPreviewError]=useState('');
  const preview=useRef<HTMLVideoElement>(null);
  const previewStage=useRef<HTMLDivElement>(null);
  const heading=useRef<HTMLHeadingElement>(null);
  const opener=useRef<HTMLElement|null>(null);
  const controller=useRef<CameraRecordingController|null>(null);
  const latest=useRef(props);latest.current=props;
  const active=!['idle','closed','complete'].includes(state.status);

  // Created only by an explicit Open camera action. StrictMode's mount cleanup
  // therefore cannot leave a permanently disposed controller behind.
  function getController(){
    return controller.current??=new CameraRecordingController({
      getUserMedia:constraints=>navigator.mediaDevices.getUserMedia(constraints),
      createRecorder:(stream,options)=>new MediaRecorder(stream,options),
      isTypeSupported:type=>typeof MediaRecorder.isTypeSupported==='function'&&MediaRecorder.isTypeSupported(type),
      now:()=>performance.now(),setTimer:(callback,ms)=>setTimeout(callback,ms),clearTimer:timer=>clearTimeout(timer),
      onChange:next=>{setState(next);latest.current.onActiveChange(!['idle','closed','complete'].includes(next.status));},
      onComplete:file=>latest.current.onCaptured(file),
    });
  }
  function open(nextFacing:'environment'|'user'=facing){
    if(!active)opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
    setPreviewReady(false);setPreviewError('');
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){
      const message=!window.isSecureContext?'Camera recording needs a secure HTTPS connection. Open the live app or choose a video instead.':'This browser does not support in-app camera recording. Use an updated Safari or Chrome browser, or choose a video instead.';
      setState({...initialState,status:'error',message});latest.current.onActiveChange(true);return;
    }
    void getController().open(nextFacing);
  }
  function close(){
    controller.current?.cancel();setState({...initialState,status:'closed'});latest.current.onActiveChange(false);
    requestAnimationFrame(()=>{if(opener.current?.isConnected)opener.current.focus();});
  }
  useImperativeHandle(ref,()=>({open:()=>open(),close}));
  useEffect(()=>{
    const hidden=()=>{if(document.visibilityState==='hidden')controller.current?.interrupt();};
    const leave=()=>controller.current?.interrupt();
    document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',leave);
    return ()=>{document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',leave);controller.current?.dispose();controller.current=null;};
  },[]);
  useEffect(()=>{
    if(state.status==='opening'||state.status==='error')heading.current?.focus();
  },[state.status]);
  useEffect(()=>{
    if(state.status==='countdown'||state.status==='recording'&&delay===0)previewStage.current?.scrollIntoView({block:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  },[state.status,delay]);
  useEffect(()=>{
    const video=preview.current;setPreviewReady(false);setPreviewError('');
    if(!video||!state.stream)return;
    let mounted=true;
    const ready=()=>{if(mounted&&video.videoWidth>0&&video.videoHeight>0&&video.readyState>=2&&!video.paused){setPreviewReady(true);setPreviewError('');}};
    video.srcObject=state.stream;video.muted=true;
    video.addEventListener('loadeddata',ready);video.addEventListener('playing',ready);
    void video.play().then(ready).catch(()=>{if(mounted)setPreviewError('The live preview could not start. Tap Start preview, or choose a video instead.');});
    return ()=>{mounted=false;video.removeEventListener('loadeddata',ready);video.removeEventListener('playing',ready);video.pause();video.srcObject=null;};
  },[state.stream]);
  function retryPreview(){
    const video=preview.current;if(!video)return;
    void video.play().then(()=>{if(video===preview.current&&video.videoWidth>0&&video.videoHeight>0&&video.readyState>=2&&!video.paused){setPreviewReady(true);setPreviewError('');}}).catch(()=>{if(video===preview.current)setPreviewError('The live preview is unavailable. Close the camera and retry, or choose a video instead.');});
  }
  function upload(){controller.current?.cancel();setState({...initialState,status:'closed'});latest.current.onActiveChange(false);latest.current.onUpload();}
  if(!active)return null;
  const busy=['countdown','recording','stopping'].includes(state.status);
  return <section className="camera-recorder" aria-label={`Record ${props.exerciseName}`}>
    <div className="camera-topline"><button type="button" className="btn ghost" onClick={close}><ArrowLeft size={17}/>Close camera</button><span>Video only · stays on this device</span></div>
    <h2 ref={heading} tabIndex={-1}>Record {props.exerciseName.toLowerCase()}</h2>
    <p className="camera-setup">{props.setup} Set your phone on a stable surface and keep this screen open.</p>
    {state.status==='error'?<div className="camera-error" role="alert"><CameraOff size={26}/><p>{state.message}</p><div className="camera-actions"><button className="btn primary" type="button" onClick={()=>open()}><RefreshCw size={17}/>Try camera again</button><button className="btn secondary" type="button" onClick={upload}><Upload size={17}/>Choose a video instead</button></div></div>:<>
      <div className="camera-preview-stage" ref={previewStage}>
        <video ref={preview} autoPlay playsInline muted aria-label="Live camera preview" onError={()=>{setPreviewReady(false);controller.current?.interrupt('The live camera preview stopped. Record again or choose a video instead; the interrupted take was discarded.');}}/>
        {state.status==='opening'&&<div className="camera-preview-overlay"><LoaderCircle size={28}/><span>Waiting for camera permission…</span><small>You can cancel while the browser is asking.</small></div>}
        {state.status==='preview'&&!previewReady&&!previewError&&<div className="camera-preview-overlay"><LoaderCircle size={28}/><span>Preparing your preview…</span></div>}
        {state.status==='countdown'&&<div className="camera-preview-overlay camera-countdown" aria-hidden="true"><span>Get into position</span><strong>{state.countdown}</strong></div>}
        {state.status==='recording'&&<div className="camera-recording-clock"><span className="camera-recording-dot" aria-hidden="true"/>Recording <strong>{elapsedLabel(state.elapsed)}</strong><span>/ 0:59</span></div>}
        {state.status==='stopping'&&<div className="camera-preview-overlay"><LoaderCircle size={28}/><span>Finishing recording…</span></div>}
      </div>
      {previewError&&<div className="camera-preview-error" role="alert"><CircleAlert size={19}/><p>{previewError}</p><button type="button" className="btn secondary" onClick={retryPreview}>Start preview</button></div>}
      <div className="camera-controls">
        <label>Start delay<select aria-label="Recording countdown" value={delay} disabled={busy} onChange={event=>setDelay(Number(event.target.value) as CameraCountdown)}><option value={0}>No countdown</option><option value={3}>3 seconds</option><option value={5}>5 seconds</option><option value={10}>10 seconds</option></select></label>
        <button type="button" className="btn secondary camera-switch" disabled={state.status!=='preview'} onClick={()=>{const next=facing==='environment'?'user':'environment';setFacing(next);open(next);}}><RefreshCw size={17}/>Use {facing==='environment'?'front':'rear'} camera</button>
        {state.status==='recording'?<button type="button" className="btn primary camera-stop" disabled={state.elapsed<2} onClick={()=>controller.current?.stop()}><Square size={17}/>Stop recording</button>:<button type="button" className="btn primary" disabled={state.status!=='preview'||!previewReady} onClick={()=>controller.current?.start(delay)}><Camera size={18}/>{delay?`Start ${delay}-second countdown`:'Start recording'}</button>}
      </div>
      <p className="camera-status" role="status" aria-live="polite" aria-atomic="true">{state.message}</p>
      <div className="camera-footer"><p>Record at least 2 seconds. Stops at 59 seconds · maximum 100 MB · no microphone.</p><div><button type="button" className="btn ghost" onClick={close}><X size={17}/>{busy?'Cancel & discard':'Cancel'}</button><button type="button" className="btn ghost" onClick={upload}><Upload size={17}/>Choose a video instead</button></div></div>
    </>}
  </section>;
});
