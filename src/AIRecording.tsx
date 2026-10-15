import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CircleAlert, Film, Focus, LoaderCircle, Maximize, Play, RotateCcw, ScanLine, ShieldCheck, Upload, X } from 'lucide-react';
import { analyzeVideo } from './ai/analyzeVideo';
import { getAnalyzer } from './ai/registry';
import type { AnalysisProgress, AnalyzedFrame, SquatAnalysis } from './ai/types';
import type {Exercise} from './types';
import {ExerciseDemo} from './ExerciseDemo';
import './recording.css';
import './ai-recording.css';

type Clip = { name: string; url: string; size: number };
type Metadata = { duration: number; width: number; height: number };
const bones = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[27,29],[29,31],[24,26],[26,28],[28,30],[30,32]];
const time = (seconds: number) => `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
const decimal = (n: number) => n.toFixed(1);

function frameAt(frames: AnalyzedFrame[], seconds: number) {
  let low = 0, high = frames.length - 1;
  while (low < high) { const mid = Math.ceil((low + high) / 2); if (frames[mid].time <= seconds) low = mid; else high = mid - 1; }
  const frame = frames[low];
  return frame && Math.abs(frame.time - seconds) <= .22 ? frame : undefined;
}

function SetupIllustration({exercise,label}:{exercise:Exercise;label:string}) {
  return <div aria-label={label}><ExerciseDemo key={exercise.id} exercise={exercise}/></div>;
}

export default function AIRecording({ exercise, standalone, onClose, onComplete, onExample }: { exercise:Exercise; standalone: boolean; onClose: () => void; onComplete: () => void; onExample: () => void }) {
  const [clip, setClip] = useState<Clip | null>(null);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress>({ phase: 'model', completed: 0, total: 1 });
  const [result, setResult] = useState<SquatAnalysis | null>(null);
  const [position, setPosition] = useState(0);
  const [overlay, setOverlay] = useState(true);
  const [selectedRep, setSelectedRep] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const player = useRef<HTMLVideoElement>(null);
  const controller = useRef<AbortController | null>(null);
  const job = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const fileMode = window.location.protocol === 'file:';
  const poseSupported = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined';
  const analyzer = getAnalyzer(exercise.id)!;
  const isVerified = analyzer.spec.validation === 'verified';

  useEffect(() => () => { job.current++; controller.current?.abort(); }, []);
  useEffect(() => () => { if (clip) URL.revokeObjectURL(clip.url); }, [clip]);
  useEffect(() => {
    const video = player.current;
    if (!clip || !video) return;
    let probing = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const inspect = () => {
      if (video.readyState < 1) return;
      if (video.duration === Infinity && !probing) {
        probing = true; setNotice('Checking the clip duration…');
        timer = setTimeout(() => { setNotice(''); setMetadata(null); setError('This video has no readable duration. Export or trim it to a 2–60 second MP4 or WebM, then choose it again.'); }, 8000);
        // Some browser-recorded WebM files reveal their duration only after an end seek.
        video.currentTime = 1e7;
        return;
      }
      if (!Number.isFinite(video.duration)) return;
      clearTimeout(timer);
      if (probing) { probing = false; video.currentTime = 0; setNotice(''); }
      readMetadata(video);
    };
    const failed = () => clearTimeout(timer);
    video.addEventListener('loadedmetadata', inspect); video.addEventListener('durationchange', inspect); video.addEventListener('seeked', inspect); video.addEventListener('error', failed);
    inspect();
    return () => { clearTimeout(timer); video.removeEventListener('loadedmetadata', inspect); video.removeEventListener('durationchange', inspect); video.removeEventListener('seeked', inspect); video.removeEventListener('error', failed); };
  }, [clip]);
  useEffect(() => {
    const video = player.current;
    if (!video || !result || !video.requestVideoFrameCallback) return;
    let frameId = 0;
    const tick = () => { setPosition(video.currentTime); frameId = video.requestVideoFrameCallback(tick); };
    frameId = video.requestVideoFrameCallback(tick);
    return () => video.cancelVideoFrameCallback(frameId);
  }, [result, clip]);

  function cancel() {
    job.current++; controller.current?.abort(); controller.current = null;
    setRunning(false); setNotice('Analysis cancelled. Your clip is ready to try again.');
  }
  function choose(file?: File) {
    if (!file) return;
    if (!file.type.startsWith('video/') && !/\.(mp4|mov|m4v|webm)$/i.test(file.name)) { setError('Choose a video file, such as MP4, MOV, or WebM.'); return; }
    if (!file.size || file.size > 100 * 1024 * 1024) { setError('Choose a video between 1 byte and 100 MB.'); return; }
    job.current++; controller.current?.abort(); controller.current = null;
    setRunning(false); setResult(null); setMetadata(null); setConfirmed(false); setPosition(0); setSelectedRep(null); setError(''); setNotice('');
    setClip({ name: file.name, url: URL.createObjectURL(file), size: file.size });
  }
  function readMetadata(video: HTMLVideoElement) {
    const { duration, videoWidth: width, videoHeight: height } = video;
    if (!Number.isFinite(duration) || duration < 2 || duration > 60 || !width || !height) {
      setMetadata(null); setError('Choose a playable clip between 2 and 60 seconds long. Trim a longer set before trying again.'); return;
    }
    setMetadata({ duration, width, height }); setError('');
  }
  async function start() {
    if (!clip || !metadata || !confirmed || fileMode || !poseSupported || running) return;
    const runId = ++job.current;
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort;
    player.current?.pause(); setError(''); setNotice(''); setResult(null); setSelectedRep(null); setRunning(true);
    setProgress({ phase: 'model', completed: 0, total: 1 });
    try {
      const measured = await analyzeVideo(clip.url, exercise.id, { signal: abort.signal, onProgress: next => { if (job.current === runId) setProgress(next); } });
      if (job.current !== runId || abort.signal.aborted) return;
      setResult(measured); setPosition(0); if (player.current) player.current.currentTime = 0;
      setNotice('Analysis complete. Review the tracked portions of your clip.');
      window.setTimeout(() => { if (job.current === runId) heading.current?.focus(); }, 0);
    } catch (cause) {
      if (job.current !== runId || abort.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : 'This clip could not be analyzed. Try another supported video.');
    } finally { if (job.current === runId) { setRunning(false); controller.current = null; } }
  }
  function seek(seconds: number, repIndex?: number) {
    if (player.current) { player.current.pause(); player.current.currentTime = seconds; }
    setPosition(seconds); setSelectedRep(repIndex ?? null);
  }
  const current = result ? frameAt(result.frames, position) : undefined;
  const percent = progress.phase === 'model' ? 0 : progress.phase === 'analysis' ? 100 : Math.min(100, Math.round(progress.completed / Math.max(1, progress.total) * 100));
  const meanDown = result?.reps.length ? result.reps.reduce((n,r) => n + r.descentSeconds, 0) / result.reps.length : null;
  const meanUp = result?.reps.length ? result.reps.reduce((n,r) => n + r.ascentSeconds, 0) / result.reps.length : null;
  const w = metadata?.width || 960, h = metadata?.height || 540;

  return <section className="recording ai-recording" aria-label={`${exercise.name} AI test`}>
    <button className="rec-back" onClick={onClose}><ArrowLeft size={17}/>{standalone ? 'Back to Today' : 'Back to workout'}</button>
    <div className="rec-heading"><div><span className="eyebrow">FROM YOUR VIDEO</span><h1>{result ? 'Your movement, in view.' : 'See your next rep clearly.'}</h1><p>A local AI test for {exercise.name.toLowerCase()}.</p></div><span className="rec-sample-pill ai-test-pill"><span/>Experimental · real pose tracking</span></div>
    <ol className="rec-steps" aria-label={`${exercise.name} analysis steps`}>{['Choose a clip','Analyze movement','Review your set'].map((label,i)=><li key={label} className={i===(result?2:running?1:0)?'current':i<(result?2:running?1:0)?'complete':''} aria-current={i===(result?2:running?1:0)?'step':undefined}><span>{i<(result?2:running?1:0)?<Check size={12}/>:i+1}</span>{label}</li>)}</ol>
    {!poseSupported && !fileMode && <div className="rec-alert"><CircleAlert size={22}/><div><h3>Local AI is unavailable in this browser.</h3><p>Update your browser or iOS and try again. Workout logging and the illustrated example are still available.</p></div></div>}
    {fileMode && <div className="rec-alert"><CircleAlert size={22}/><div><h3>Open the local preview to use AI.</h3><p>The downloadable HTML supports the illustrated demo. Real analysis needs the app’s local model files, served with the app.</p><a className="btn secondary" href="http://127.0.0.1:5173/#form-test">Open AI test in local preview <ArrowRight size={16}/></a></div></div>}
    <div className={`ai-layout ${!clip ? 'ai-empty-layout' : ''}`}>
      <div className="ai-media-column">
        {clip ? <div className="ai-player-panel"><div className="ai-player-heading"><span><Film size={15}/>YOUR LOCAL CLIP</span><span>{metadata ? `${decimal(metadata.duration)} seconds` : 'Reading video…'}</span></div><div className="ai-video-stage" style={{ aspectRatio: `${w}/${h}`, maxWidth: `${460*w/h}px` }}>
          <video ref={player} src={clip.url} controls playsInline muted preload="metadata" aria-label={`Your ${exercise.name} video replay`} onTimeUpdate={e=>setPosition(e.currentTarget.currentTime)} onError={()=>{setMetadata(null);setError('This browser cannot decode this video. Try an MP4 with H.264 video or a WebM file.');}}/>
          {result && overlay && current?.valid && <svg className="ai-pose-overlay" viewBox={`0 0 ${w} ${h}`} aria-hidden="true"><g stroke="#c6f36b" strokeWidth={Math.max(w/280,2)} fill="#15200e">{bones.map(([a,b])=>{const p=current.landmarks[a],q=current.landmarks[b];return p&&q&&p.visibility>=.5&&q.visibility>=.5?<line key={`${a}-${b}`} x1={p.x*w} y1={p.y*h} x2={q.x*w} y2={q.y*h}/>:null;})}{current.landmarks.map((p,i)=>i>=11&&p.visibility>=.5?<circle key={i} cx={p.x*w} cy={p.y*h} r={Math.max(w/180,3)}/>:null)}</g></svg>}
        </div><div className="ai-video-caption"><span>{clip.name}</span>{result && <label><input type="checkbox" checked={overlay} onChange={e=>setOverlay(e.target.checked)}/>Show tracked joints</label>}</div>{result && <div className="ai-tracking-caption"><span className={current?.valid?'ai-tracking-dot':'ai-tracking-dot unavailable'}/>{current?.valid ? `Tracked frame · projected ${result.metricLabel||analyzer.spec.metricLabel} ${current.angle===null?'unavailable':`${Math.round(current.angle)}°`}` : 'Tracking unavailable at this moment'}</div>}</div> : <div className="ai-guide-panel"><div className="ai-player-heading"><span><Focus size={15}/>A CLEARER VIEW</span><span>CAMERA GUIDE</span></div><SetupIllustration exercise={exercise} label={`${analyzer.spec.camera.requiredView.replaceAll('_',' ')} camera guide for ${exercise.name}`}/><div className="ai-guide-caption"><strong>{analyzer.spec.camera.requiredView==='side'?'Use a clear side view.':'Use a clear front or slight angle.'}</strong><p>{analyzer.spec.camera.setupInstructions} Hold still briefly before and after the set.</p></div></div>}
        <div className="ai-privacy"><ShieldCheck size={19}/><p><strong>Your video stays on this device.</strong><span>Processing happens in this browser. Your clip and results are cleared when you leave this screen. No upload, camera, or microphone access.</span></p></div>
        {result && <div className="ai-replay-tools"><label>Replay position <span>{time(position)} / {time(metadata?.duration||0)}</span><input type="range" min="0" max={metadata?.duration||1} step=".05" value={Math.min(position,metadata?.duration||0)} aria-label="Video replay position in seconds" onChange={e=>seek(Number(e.target.value))}/></label>{result.reps.length>0 && <div className="ai-rep-timeline" aria-label="Measured repetitions">{result.reps.map(rep=><button key={rep.index} onClick={()=>seek(rep.start,rep.index)} className={selectedRep===rep.index?'selected':''} aria-pressed={selectedRep===rep.index}><Play size={13}/><span>Rep {rep.index}<small>{time(rep.start)}–{time(rep.end)}</small></span></button>)}</div>}</div>}
      </div>
      <div className="ai-analysis-column">
        {!result && !running && <><span className="eyebrow">{isVerified?'TESTED MOTION ANALYZER':'BETA MOTION CHECK'}</span><h2>{exercise.name}</h2><p className="ai-intro">Choose a short video to measure {exercise.id==='plank'?'continuous hold time and visible body position':'complete reps, timing, and changes in visible '+analyzer.spec.metricLabel+' range'}.</p><button className="btn secondary ai-wide" onClick={()=>fileInput.current?.click()}><Upload size={17}/>{clip?'Choose another video':`Choose ${exercise.name.toLowerCase()} video`}<ArrowRight size={17}/></button><ul className="ai-setup-checks"><li><Maximize size={18}/><span>{analyzer.spec.camera.setupInstructions}</span></li><li><Focus size={18}/><span>You select the exercise. The app measures joint motion but does not identify the movement or grade technique.</span></li><li><Film size={18}/><span>2–60 seconds · up to 100 MB · a format your browser can play.</span></li></ul>{clip && <><label className="ai-confirm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>I confirm this clip shows one person doing {exercise.name.toLowerCase()} from the requested camera view.</span></label><button className="btn primary ai-wide" disabled={!confirmed||!metadata||fileMode||!poseSupported} onClick={start}><ScanLine size={18}/>{error?'Retry local analysis':`Analyze ${exercise.name.toLowerCase()} video`}<ArrowRight size={17}/></button></>}<p className="ai-experimental-note">{isVerified?'This analyzer has deterministic movement-specific tests.':['0.2.0','0.3.0'].includes(analyzer.spec.version)?'Exercise-specific beta rules check setup visibility, movement phases, and within-set consistency.':'This beta profile measures repeating projected joint motion.'} Real-world accuracy has not been validated. Counts and observations are experimental estimates, not medical, injury-risk, or safety advice.</p></>}
        {running && <div className="ai-progress-panel"><div className="ai-loading-mark"><LoaderCircle size={27}/></div><span className="eyebrow">WORKING ON YOUR DEVICE</span><h2 role="status">{progress.phase==='model'?'Preparing the pose model':progress.phase==='analysis'?'Reviewing tracked movement':'Tracking your movement'}</h2><p>{progress.phase==='model'?'Loading the model from this app. The first analysis may take a moment.':progress.phase==='analysis'?'Finding complete repetitions in the visible portions of the clip.':`${progress.completed} of ${progress.total} frames processed. Your video stays here.`}</p><progress max="100" value={progress.phase==='model'?undefined:percent} aria-label="Video analysis progress"/><div className="ai-progress-label">{progress.phase==='model'?'Loading model…':`${percent}%`}</div><button className="btn secondary ai-wide" onClick={cancel}><X size={17}/>Cancel analysis</button></div>}
        {result && <><div className="ai-result-heading"><span className="eyebrow">MEASURED FROM THIS CLIP</span><h2 ref={heading} tabIndex={-1}>{result.status==='unable'?'Unable to assess this set.':result.status==='partial'?'A partial view of your set.':'Here’s what we could track.'}</h2><p>{result.status==='unable'?'There wasn’t enough suitable movement to count complete cycles reliably. Try the requested view with a brief still hold before and after your set.':result.status==='partial'?'These measurements cover the usable segments only. Some movement was not assessed.':'Experimental measurements of the visible movement in this video.'}</p></div><div className="ai-result-stats"><div><span>{result.holdSeconds!==undefined?'Longest tracked hold':'Complete reps detected'}</span><strong>{result.status==='unable'?'—':result.holdSeconds!==undefined?result.holdSeconds.toFixed(1)+'s':result.reps.length}</strong></div><div><span>Usable sampled frames</span><strong>{Math.round(result.validFraction*100)}<small>%</small></strong></div><div><span>Avg. {result.phaseLabels?.[0]?.toLowerCase()||'lowering time'}</span><strong>{meanDown===null?'—':decimal(meanDown)}{meanDown!==null&&<small>s</small>}</strong></div><div><span>Avg. {result.phaseLabels?.[1]?.toLowerCase()||'rising time'}</span><strong>{meanUp===null?'—':decimal(meanUp)}{meanUp!==null&&<small>s</small>}</strong></div></div><p className="ai-metric-note">Visibility coverage describes usable frames. It is not a technique score. Angles and timings are estimates from this camera view.</p>{result.issues.length>0 && <div className="ai-quality-notes"><h3><CircleAlert size={17}/>What limited this assessment</h3><ul>{result.issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul></div>}{result.observations.map(observation=><article className="ai-observation" key={observation.id}><span className="eyebrow">{observation.tone==='notice'?'A MOMENT TO REVIEW':'MOVEMENT OBSERVATION'}</span><h3>{observation.title}</h3><p>{observation.detail}</p>{observation.time!==undefined&&<button className="rec-text-button" onClick={()=>seek(observation.time!,observation.repIndexes[0])}><Play size={15}/>Review at {time(observation.time)}<ArrowRight size={15}/></button>}</article>)}<div className="ai-result-actions"><button className="btn secondary" onClick={()=>{setResult(null);setNotice('');setSelectedRep(null);}}><RotateCcw size={16}/>Try again</button><button className="btn primary" onClick={onComplete}>{standalone?'Back to Today':'Back to workout'}<ArrowRight size={17}/></button></div></>}
        {error && <div className="ai-error" role="alert"><CircleAlert size={19}/><p>{error}</p></div>}
        <p className="ai-status" role="status">{notice}</p>
      </div>
    </div>
    {result && result.reps.length>0 && <details className="ai-measurement-details"><summary>Measurements by repetition</summary><div className="ai-table-scroll" tabIndex={0} role="region" aria-label="Rep measurements table"><table><caption>Experimental projected movement measurements. Range is the visible change in {result.metricLabel||analyzer.spec.metricLabel}.</caption><thead><tr><th scope="col">Rep</th><th scope="col">Start</th><th scope="col">{result.phaseLabels?.[0]||'Lowering'}</th><th scope="col">{result.phaseLabels?.[1]||'Rising'}</th><th scope="col">Angle range</th></tr></thead><tbody>{result.reps.map(rep=><tr key={rep.index}><th scope="row">{rep.index}</th><td>{decimal(rep.start)}s</td><td>{decimal(rep.descentSeconds)}s</td><td>{decimal(rep.ascentSeconds)}s</td><td>{Math.round(rep.rangeDegrees)}°</td></tr>)}</tbody></table></div></details>}
    <div className="ai-footnote"><p><ScanLine size={16}/>Real pose tracking · experimental movement rules · no overall form score</p><button className="rec-text-button" onClick={onExample}>View illustrated example <ArrowRight size={16}/></button></div>
    <input ref={fileInput} type="file" accept="video/mp4,video/webm,video/quicktime,video/x-m4v,video/*" className="rec-hidden-input" tabIndex={-1} aria-label={`Choose a ${exercise.name} video for local AI analysis`} onChange={e=>{choose(e.target.files?.[0]);e.target.value='';}}/>
  </section>;
}



