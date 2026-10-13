import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, Check, CheckCircle2, ChevronDown, CircleAlert, Flag, Focus, Lightbulb, LoaderCircle, Maximize, Mic, Pause, Play, RotateCcw, ShieldCheck, Upload, Video, X } from 'lucide-react';
import type { Exercise } from './types';
import './recording.css';

type Stage = 'setup' | 'countdown' | 'recording' | 'review' | 'pending' | 'results' | 'unable';
type PreviewState = 'normal' | 'denied' | 'frame' | 'people' | 'light' | 'unsupported' | 'interrupted' | 'upload' | 'analysis' | 'unable';
const retained = new Map<string, { stage: 'pending' | 'results' | 'unable'; readyAt: number }>();
const warnings: Record<Exclude<PreviewState, 'normal'>, { title: string; copy: string; action: string }> = {
  denied: { title: 'Camera access is off', copy: 'In the full app, allow camera access in your browser settings or choose a video instead. This prototype does not request camera access.', action: 'Try sample camera again' },
  frame: { title: 'Your feet are outside the frame', copy: 'Move the camera farther away. Keep your head, hips, knees, and feet visible through the whole movement.', action: 'Recheck framing' },
  people: { title: 'More than one person is visible', copy: 'Choose a clear spot with only you in frame. We need to know which movement to follow.', action: 'Recheck framing' },
  light: { title: 'Some joints are hard to see', copy: 'Face a light source and avoid loose clothing that obscures your joints. Move the camera away from a bright window behind you.', action: 'Recheck lighting' },
  unsupported: { title: 'Video feedback is not available for this exercise', copy: 'You can still log every set. Sample video feedback is available for bodyweight squats, push-ups, and standing biceps curls.', action: 'Return to workout' },
  interrupted: { title: 'The recording was interrupted', copy: 'The sample recording stopped before it was complete. Your logged sets are safe. Set up your camera and try again.', action: 'Record again' },
  upload: { title: 'Couldn’t prepare this clip', copy: 'Choose another video or retry. This is a simulated failure; no video was sent anywhere.', action: 'Try again' },
  analysis: { title: 'Feedback could not be prepared', copy: 'Your workout can continue. Retry the sample analysis when you are ready. This is a simulated error.', action: 'Retry sample analysis' },
  unable: { title: 'Unable to assess reliably', copy: 'In this example, the lower body leaves the frame and key joints are obscured. There is not enough visible movement to give useful feedback.', action: 'Record a better clip' },
};

function Movement({ exercise, progress = 0, skeleton = false, framing = false, shortRange = false }: { exercise: Exercise; progress?: number; skeleton?: boolean; framing?: boolean; shortRange?: boolean }) {
  const push = exercise.name.toLowerCase().includes('push');
  const curl = exercise.name.toLowerCase().includes('curl');
  const bend = framing ? 0.72 : (1 - Math.cos(progress * Math.PI * 2)) / 2 * (shortRange ? .72 : 1);
  const head = push ? [105, 157 + bend * 26] : curl ? [205, 87] : [205 - bend * 31, 82 + bend * 65];
  const shoulder = push ? [133, 181 + bend * 24] : curl ? [201, 118] : [201 - bend * 30, 116 + bend * 55];
  const hip = push ? [228, 203 + bend * 15] : curl ? [207, 204] : [209 + bend * 30, 209 + bend * 22];
  const knee = push ? [292, 233] : curl ? [205, 271] : [205 - bend * 38, 267 - bend * 24];
  const ankle = push ? [338, 257] : [205, 320];
  const elbow = push ? [124 + bend * 29, 226] : curl ? [222, 181] : [171 - bend * 42, 168 + bend * 32];
  const hand = push ? [111, 265] : curl ? [246 - bend * 22, 235 - bend * 100] : [161 - bend * 45, 214 + bend * 5];
  const p = (point: number[]) => point.join(',');
  return <svg className="movement-art" viewBox="0 0 440 370" role="img" aria-label={`Illustration of ${exercise.name.toLowerCase()} from the side${skeleton ? ' with illustrative joint overlay' : ''}`}>
    <defs><pattern id="form-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#a6aea0" strokeOpacity=".045" /></pattern></defs>
    <rect width="440" height="370" fill="url(#form-grid)" />
    <ellipse cx="224" cy="337" rx="116" ry="9" fill="#080b08" opacity=".48" />
    <path d="M65 335 H375" stroke="#68735f" strokeWidth="1" />
    {framing && <g stroke="#c6f36b" strokeWidth="2" fill="none" opacity=".75"><path d="M105 76 V52 H129 M311 52 H335 V76 M105 292 V316 H129 M311 316 H335 V292" /><path d="M55 164 L85 164 M70 154 L85 164 L70 174" strokeDasharray="3 3" /></g>}
    <g stroke="#4b5845" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity=".55" transform="translate(15 0)"><polyline points={`${p(hip)} ${p(knee)} ${p(ankle)}`} /></g>
    <polyline points={`${p(shoulder)} ${p(hip)}`} stroke="#96a889" strokeWidth="43" strokeLinecap="round" />
    <polyline points={`${p(hip)} ${p(knee)} ${p(ankle)}`} stroke="#394333" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d={`M${ankle[0] - 4} ${ankle[1] + 9} h34`} stroke="#b6bdae" strokeWidth="14" strokeLinecap="round" />
    <path d={`M${shoulder[0]} ${shoulder[1] - 1} L${head[0]} ${head[1] + 15}`} stroke="#bdc6b3" strokeWidth="16" strokeLinecap="round" />
    <ellipse cx={head[0]} cy={head[1]} rx="19" ry="23" fill="#bdc6b3" />
    <path d={`M${head[0] - 18} ${head[1] - 3} Q${head[0] - 20} ${head[1] - 28} ${head[0] + 3} ${head[1] - 25} Q${head[0] + 20} ${head[1] - 25} ${head[0] + 19} ${head[1] - 12}`} fill="#424b39" />
    <polyline points={`${p(shoulder)} ${p(elbow)} ${p(hand)}`} stroke="#bdc6b3" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    {curl && <g stroke="#87927d" strokeWidth="7"><path d={`M${hand[0] - 17} ${hand[1]} h34`} /><path d={`M${hand[0] - 16} ${hand[1] - 10} v20 M${hand[0] + 16} ${hand[1] - 10} v20`} /></g>}
    {skeleton && <g stroke="#c6f36b" strokeWidth="2" fill="#182013"><polyline points={`${p(head)} ${p(shoulder)} ${p(hip)} ${p(knee)} ${p(ankle)}`} fill="none" /><polyline points={`${p(shoulder)} ${p(elbow)} ${p(hand)}`} fill="none" />{[head, shoulder, hip, knee, ankle, elbow, hand].map((point, i) => <circle key={i} cx={point[0]} cy={point[1]} r="4.5" />)}</g>}
    {framing && <><text x="354" y="65" fill="#a6aea0" fontSize="10" letterSpacing="1">{curl ? '3/4' : 'SIDE'}</text><text x="354" y="80" fill="#a6aea0" fontSize="10" letterSpacing="1">VIEW</text><text x="219" y="360" fill="#a6aea0" fontSize="10" textAnchor="middle" letterSpacing="1">KEEP YOUR WHOLE BODY VISIBLE</text></>}
  </svg>;
}

export default function Recording({ exercise, onClose, onComplete, initialResult = false, standalone = false }: { exercise: Exercise; onClose: () => void; onComplete: () => void; initialResult?: boolean; standalone?: boolean }) {
  const saved = retained.get(exercise.id);
  const [stage, setStage] = useState<Stage>(initialResult ? 'results' : saved ? (saved.stage === 'pending' && saved.readyAt < Date.now() ? 'results' : saved.stage) : 'setup');
  const [preview, setPreview] = useState<PreviewState>(exercise.supported ? 'normal' : 'unsupported');
  const [variation, setVariation] = useState(exercise.variation || 'Standard');
  const [audio, setAudio] = useState(false);
  const [count, setCount] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(initialResult || saved?.stage === 'results' ? 18 : 0);
  const [skeleton, setSkeleton] = useState(true);
  const [selectedRep, setSelectedRep] = useState(7);
  const [flagged, setFlagged] = useState(false);
  const [localVideo, setLocalVideo] = useState<string | null>(null);
  const [filename, setFilename] = useState('');
  const [fileError, setFileError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const uploaded = useRef<HTMLVideoElement>(null);
  const pendingAt = useRef(saved?.readyAt ?? 0);
  const name = exercise.name.toLowerCase();
  const isCurl = name.includes('curl');
  const isPush = name.includes('push');
  const blocked = !exercise.supported || ['denied', 'frame', 'people', 'light', 'unsupported'].includes(preview);

  useEffect(() => () => { if (localVideo) URL.revokeObjectURL(localVideo); }, [localVideo]);
  useEffect(() => {
    if (stage !== 'countdown') return;
    const timeout = window.setTimeout(() => { if (count > 1) setCount(count - 1); else { setElapsed(0); setStage('recording'); } }, 1000);
    return () => window.clearTimeout(timeout);
  }, [stage, count]);
  useEffect(() => {
    if (stage !== 'recording') return;
    const timer = window.setInterval(() => setElapsed(t => t + 1), 1000);
    return () => window.clearInterval(timer);
  }, [stage]);
  useEffect(() => {
    if (stage !== 'pending') return;
    if (!pendingAt.current) pendingAt.current = Date.now() + 3500;
    retained.set(exercise.id, { stage: 'pending', readyAt: pendingAt.current });
    const timer = window.setTimeout(() => { setStage('results'); setPosition(18); retained.set(exercise.id, { stage: 'results', readyAt: 0 }); }, Math.max(0, pendingAt.current - Date.now()));
    return () => window.clearTimeout(timer);
  }, [stage, exercise.id]);
  useEffect(() => {
    if (!playing || localVideo) return;
    const timer = window.setInterval(() => setPosition(t => t >= 23.9 ? 0 : t + .1), 100);
    return () => window.clearInterval(timer);
  }, [playing, localVideo]);
  useEffect(() => { if (playing && stage === 'results') setSelectedRep(Math.min(8, Math.floor(position / 3) + 1)); }, [playing, position, stage]);

  const beginAnalysis = () => { setPlaying(false); pendingAt.current = Date.now() + 3500; setPreview('normal'); setStage('pending'); };
  const retry = () => { retained.delete(exercise.id); setLocalVideo(null); setFilename(''); setPosition(0); setFlagged(false); setPreview('normal'); setFileError(''); setStage('setup'); setElapsed(0); setCount(3); setPlaying(false); };
  const selectPreview = (value: PreviewState) => {
    setPreview(value); setPlaying(false);
    if (value === 'unable') setStage('unable');
    else if (value === 'analysis') setStage('review');
    else if (value === 'upload') setStage('setup');
    else setStage('setup');
  };
  const pickRep = (rep: number) => { setSelectedRep(rep); setPosition((rep - 1) * 3); setPlaying(false); };
  const receiveFile = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) { setFileError('Choose a video file such as MP4, MOV, or WebM.'); return; }
    if (file.size > 100 * 1024 * 1024) { setFileError('For this local preview, choose a video smaller than 100 MB.'); return; }
    setFileError(''); setFilename(file.name); setLocalVideo(URL.createObjectURL(file)); setPreview('normal'); setStage('review'); setPlaying(false);
  };
  const useSample = () => { setLocalVideo(null); setFilename(''); setPosition(0); setStage('review'); setPreview('normal'); setPlaying(!window.matchMedia('(prefers-reduced-motion: reduce)').matches); };
  const renderReplay = (results = false) => <div className="rec-replay">
    <div className="rec-player">
      <div className="rec-player-top"><span className="rec-dark-label"><Video size={13} />{localVideo ? 'LOCAL PREVIEW' : 'ILLUSTRATIVE SAMPLE'}</span><span className="rec-dark-label">{localVideo ? 'ON THIS DEVICE' : `REP ${Math.min(8, Math.floor(position / 3) + 1)} / 8`}</span></div>
      {localVideo ? <video ref={uploaded} src={localVideo} controls playsInline preload="metadata" onError={() => setFileError('This browser cannot play that video. Try an MP4 or use the sample clip.')} aria-label="Your selected video, previewed only on this device" /> : <Movement exercise={exercise} progress={(position % 3) / 3} shortRange={position >= 18 && !isCurl} skeleton={skeleton && results} />}
      {!localVideo && <button className="rec-play-button" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause sample replay' : 'Play sample replay'}>{playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}</button>}
      {results && !localVideo && <label className="rec-overlay-toggle"><input type="checkbox" checked={skeleton} onChange={e => setSkeleton(e.target.checked)} /> Illustrative overlay</label>}
    </div>
    {!localVideo && <div className="rec-scrubber"><span>{`0:${Math.floor(position).toString().padStart(2, '0')}`}</span><input aria-label="Sample replay position in seconds" type="range" min="0" max="23.9" step=".1" value={position} onChange={e => { setPosition(Number(e.target.value)); setPlaying(false); }} /><span>0:24</span></div>}
    {localVideo && <p className="rec-video-disclaimer">{filename} · Your clip is only a local preview. Example findings do not describe your video.</p>}
    {fileError && <p role="alert" className="rec-inline-error">{fileError}</p>}
  </div>;

  return <section className="recording" aria-label="Check your form">
    <button className="rec-back" onClick={onClose}><ArrowLeft size={17} /> {standalone ? 'Back to Today' : 'Back to workout'}</button>
    <div className="rec-heading"><div><span className="eyebrow">A LITTLE PERSPECTIVE</span><h1>{stage === 'results' ? 'Your set, a little clearer.' : stage === 'unable' ? 'Let’s get a clearer view.' : stage === 'pending' ? (standalone ? 'Your day can keep moving.' : 'Your workout can keep moving.') : stage === 'review' ? 'Take a second look.' : stage === 'recording' ? 'One rep at a time.' : stage === 'countdown' ? 'Find your starting position.' : 'Make every rep count.'}</h1><p>{stage === 'results' ? 'A few useful things to notice. One small thing to try next.' : stage === 'review' ? 'Review your clip before requesting sample feedback.' : 'A simple setup. A better view of your movement.'}</p></div><span className="rec-sample-pill"><span /> Simulated experience</span></div>
    <ol className="rec-steps" aria-label="Video feedback steps">{['Set up', 'Record & review', 'Your feedback'].map((label, i) => { const current = stage === 'setup' ? 0 : ['countdown', 'recording', 'review'].includes(stage) ? 1 : 2; return <li key={label} className={i === current ? 'current' : i < current ? 'complete' : ''} aria-current={i === current ? 'step' : undefined}><span>{i < current ? <Check size={12} /> : `0${i + 1}`}</span>{label}</li>; })}</ol>

    {preview !== 'normal' && preview !== 'unable' && <div className="rec-alert" role="alert"><CircleAlert size={21} /><div><span className="rec-state-label">SIMULATED STATE</span><h3>{warnings[preview].title}</h3><p>{warnings[preview].copy}</p><button className="rec-text-button" onClick={preview === 'unsupported' ? onClose : preview === 'analysis' ? beginAnalysis : retry}>{preview === 'unsupported' && standalone ? 'Return to Today' : warnings[preview].action}<ArrowRight size={15} /></button></div></div>}

    {stage === 'setup' && <div className="rec-setup-grid"><div className="rec-camera-card"><div className="rec-camera-caption"><span><Camera size={16} /> Your camera setup</span><span>ILLUSTRATION</span></div><Movement exercise={exercise} framing /><div className="rec-angle-note"><Focus size={20} /><div><strong>{isCurl ? 'Film from a front three-quarter angle' : 'Film from the side'}</strong><span>About 2–3 metres away, at hip height.</span></div></div><div className="rec-camera-bottom"><ShieldCheck size={15} /> No camera or microphone access in this prototype.</div></div><div className="rec-setup-controls"><div className="rec-section-number">01 <span>CONFIRM YOUR MOVEMENT</span></div><h2>{exercise.name}</h2><label className="rec-field">Variation<select aria-label="Variation" value={variation} onChange={e => setVariation(e.target.value)}><option value={exercise.variation || 'Standard'}>{exercise.variation || 'Standard'}</option><option value="Different variation">A different variation</option></select></label>{variation === 'Different variation' && <p className="rec-inline-note">This example supports the standard variation only. Choose it to try the sample, or return to logging.</p>}<div className="rec-section-number rec-second-section">02 <span>GIVE YOURSELF SOME ROOM</span></div><ul className="rec-checklist"><li><Maximize size={18} /><span>Keep your <strong>whole body in frame</strong>, from head to feet.</span></li><li><Lightbulb size={18} /><span>Choose a <strong>well-lit spot</strong> with your joints easy to see.</span></li><li><Focus size={18} /><span>Place your phone securely. Keep <strong>only you in the shot.</strong></span></li></ul><label className="rec-audio"><span><Mic size={18} /><span>Include audio <small>Optional · preference preview only</small></span></span><input type="checkbox" role="switch" checked={audio} onChange={e => setAudio(e.target.checked)} aria-label="Include audio preference" /></label><button className="btn primary rec-wide" disabled={blocked || variation === 'Different variation'} onClick={() => { setCount(3); setStage('countdown'); setLocalVideo(null); }}><Camera size={18} /> Start sample recording <ArrowRight size={18} /></button><button className="btn secondary rec-wide" onClick={() => fileInput.current?.click()}><Upload size={17} /> Choose a video instead</button><p className="rec-small-copy">3-second countdown. Framing checks and feedback are simulated. Your chosen video stays in this tab.</p>{fileError && <p role="alert" className="rec-inline-error">{fileError}</p>}</div></div>}

    {(stage === 'countdown' || stage === 'recording') && <div className="rec-capture"><div className="rec-live-label"><span className={stage === 'recording' ? 'rec-live-dot' : ''} />{stage === 'countdown' ? 'GET READY' : 'SIMULATED RECORDING'}<span>{Math.floor(elapsed / 60).toString().padStart(2, '0')}:{(elapsed % 60).toString().padStart(2, '0')}</span></div><Movement exercise={exercise} framing={stage === 'countdown'} progress={(elapsed % 3) / 3} /><div className="rec-capture-caption">{exercise.name} · {variation}</div>{stage === 'countdown' ? <div className="rec-countdown" aria-live="assertive" aria-label={`Recording starts in ${count}`}>{count}</div> : <button className="rec-stop" onClick={useSample} aria-label="Stop recording and review sample"><span /></button>}<p>{stage === 'recording' ? 'Tap to stop and review the sample clip.' : 'Set your phone down. You have a moment.'}</p><button className="rec-text-button" onClick={retry}><X size={16} /> Cancel {stage === 'countdown' ? 'countdown' : 'recording'}</button></div>}

    {stage === 'review' && <div className="rec-review-grid">{renderReplay()}<div className="rec-review-copy"><span className="eyebrow">READY WHEN YOU ARE</span><h2>A quick check before feedback.</h2><p>{localVideo ? 'Your video is ready to preview. The next step opens example feedback; no analysis is performed on your clip.' : 'This illustrated clip stands in for a recording. Play it, then explore what clear, useful feedback could look like.'}</p><div className="rec-review-detail"><Video size={20} /><div><strong>{exercise.name}</strong><span>{localVideo ? 'Local video · not uploaded' : '24-second illustrated sample · 8 sample reps'}</span></div></div><button className="btn primary rec-wide" disabled={!exercise.supported || variation === 'Different variation'} onClick={beginAnalysis}>See simulated feedback <ArrowRight size={18} /></button><button className="btn secondary rec-wide" onClick={retry}><RotateCcw size={17} /> Retake</button><button className="rec-text-button" onClick={() => fileInput.current?.click()}><Upload size={16} /> Choose another video</button>{localVideo && <button className="rec-text-button" onClick={useSample}>Use the illustrated sample instead</button>}<p className="rec-small-copy"><ShieldCheck size={14} /> Nothing is uploaded. Videos are not saved when this screen closes.</p></div></div>}

    {stage === 'pending' && <div className="rec-pending"><div className="rec-loading-icon"><LoaderCircle size={32} /></div><span className="eyebrow">SIMULATED ANALYSIS</span><h2>Preparing your example feedback.</h2><p>This short wait previews the analysis flow. No AI model is running and no video is being uploaded.</p><div className="rec-pending-row"><CheckCircle2 size={17} /><span>Illustrative sample ready</span></div><div className="rec-pending-row"><LoaderCircle size={17} /><span>Opening example observations</span></div><button className="btn primary" onClick={onClose}>{standalone ? 'Back to Today' : 'Continue my workout'} <ArrowRight size={17} /></button><p className="rec-small-copy">Return to “{standalone ? 'Check my form' : 'Record this set'}” to see the sample results.</p></div>}

    {stage === 'results' && <><div className="rec-results-context"><span><CheckCircle2 size={16} /> {exercise.name}</span><span>Example feedback · not a measurement of you</span></div><div className="rec-results-grid"><div><h2 className="rec-panel-title">A moment worth reviewing <span>REPS 7 & 8</span></h2>{renderReplay(true)}{localVideo && <div className="rec-upload-result-note"><p>Sample rep markers and observations below do not correspond to your clip.</p><button className="rec-text-button" onClick={() => { setLocalVideo(null); setFilename(''); setPosition(18); }}>Show the illustrated sample replay <ArrowRight size={14} /></button></div>}<div className="rec-timeline"><div><strong>Move through the set</strong><span>8 sample reps · 24 seconds</span></div><div className="rec-rep-buttons" aria-label="Select a sample repetition">{Array.from({ length: 8 }, (_, i) => i + 1).map(rep => <button key={rep} className={`${rep === selectedRep ? 'selected' : ''} ${rep >= 7 ? 'highlighted' : ''}`} onClick={() => pickRep(rep)} aria-label={`Review sample rep ${rep}${rep >= 7 ? ', feedback marker' : ''}`} aria-pressed={rep === selectedRep}>{rep}<span /></button>)}</div><p><span className="rec-marker-key" /> A moment to review <span className="rec-selected-label">Rep {selectedRep} selected</span></p></div><div className="rec-clip-facts"><div><span>REPETITIONS</span><strong>8 <small>sample reps</small></strong></div><div><span>TEMPO</span><strong>Not assessed</strong><small>Illustration, not measured movement</small></div></div><p className="rec-small-copy">The animation, joint overlay, rep count, and markers are illustrative. They are not generated from a real recording.</p></div><div className="rec-feedback-column"><article className="rec-observation"><div className="rec-feedback-heading"><span className="rec-number-badge">01</span><span>WHAT TO NOTICE</span><span className="rec-example-tag">EXAMPLE</span></div><h2>{isCurl ? 'Your last two reps appear to use more upper-body movement.' : isPush ? 'Your last two reps appear to have a shorter range of motion.' : 'Your last two reps appear to have a shorter range of motion.'}</h2><p>Review reps 7 and 8{isCurl ? ', and notice how the shoulders move as the weight rises.' : ', and compare the lowest point with the earlier reps.'}</p><div className="rec-confidence"><Focus size={16} /><div><strong>Example confidence: moderate</strong><span>{isCurl ? 'A front three-quarter view shows the upper body, but clothing could hide the elbow position.' : 'The side view helps, but the far-side joints are partly obscured. Camera position can change the impression.'}</span></div></div><div className="rec-next-cue"><span>ONE THING TO TRY NEXT</span><p>{isCurl ? 'Try a lighter weight and keep your upper arms comfortably still. Finish the set when you can no longer maintain the same movement.' : isPush ? 'Choose a repeatable depth you can control. An elevated surface may help you maintain that range through the set.' : 'Choose a comfortable depth you can repeat. Pause briefly at the bottom, then stand with control.'}</p><small>General coaching guidance, not a measured finding.</small></div><button className="rec-text-button" onClick={() => pickRep(selectedRep === 7 ? 8 : 7)}><Play size={15} /> Review rep {selectedRep === 7 ? 8 : 7}<ArrowRight size={14} /></button></article><div className="rec-positive"><CheckCircle2 size={20} /><div><strong>Something to build on</strong><p>In this example, the first six reps appear consistent. A steady start is useful context when reviewing the end of a set.</p><small>Sample observation · visibility appears sufficient early in the set.</small></div></div><button className={`rec-flag ${flagged ? 'flagged' : ''}`} onClick={() => setFlagged(!flagged)} aria-pressed={flagged}>{flagged ? <Check size={16} /> : <Flag size={16} />}{flagged ? 'Flag noted in this preview · Undo' : 'Something look off? Flag this feedback'}</button>{flagged && <p role="status" className="rec-small-copy">Saved for this preview only. No report was sent.</p>}</div></div><div className="rec-results-footer"><p><ShieldCheck size={17} /> A useful perspective, with room for uncertainty.</p><div className="rec-results-actions"><button className="btn secondary" onClick={retry}><RotateCcw size={17} /> Record another set</button><button className="btn primary" onClick={() => { retained.delete(exercise.id); onComplete(); }}>{standalone ? 'Back to Today' : 'Back to my workout'} <ArrowRight size={18} /></button></div></div></>}

    {stage === 'unable' && <div className="rec-unable"><div className="rec-unable-icon"><Focus size={34} /></div><span className="eyebrow">SIMULATED RESULT</span><h2>Unable to assess reliably.</h2><p>{warnings.unable.copy}</p><div className="rec-unable-tips"><h3>For a clearer next clip</h3><p><Maximize size={18} /> Move back until your whole body stays visible.</p><p><Lightbulb size={18} /> Face the light and keep your joints unobscured.</p><p><Camera size={18} /> {isCurl ? 'Film one person from a front three-quarter angle.' : 'Film one person from the side, with a steady phone.'}</p></div><p className="rec-small-copy">No rep count, tempo, or movement judgment is shown when visibility is insufficient.</p><div className="rec-unable-actions"><button className="btn primary" onClick={retry}><RotateCcw size={17} /> Record a better clip</button><button className="btn secondary" onClick={onClose}>{standalone ? 'Back to Today' : 'Continue workout'}</button></div></div>}

    <input ref={fileInput} type="file" accept="video/*" className="rec-hidden-input" tabIndex={-1} aria-label="Choose a video for local preview" onChange={e => { receiveFile(e.target.files?.[0]); e.target.value = ''; }} />
    <details className="rec-state-preview"><summary>Preview a state <ChevronDown size={15} /></summary><label>Prototype state<select aria-label="Prototype state" value={preview} onChange={e => selectPreview(e.target.value as PreviewState)}><option value="normal">Ready to record</option><option value="denied">Camera permission denied</option><option value="frame">Body partly outside frame</option><option value="people">Multiple people visible</option><option value="light">Poor lighting or obscured joints</option><option value="unsupported">Unsupported exercise</option><option value="interrupted">Recording interrupted</option><option value="upload">Upload failure</option><option value="analysis">Analysis failure</option><option value="unable">Unable to assess reliably</option></select></label><p>All checks and results on this screen are simulated. No camera, microphone, upload service, or AI model is connected.</p></details>
  </section>;
}
