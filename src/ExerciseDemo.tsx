import {useEffect,useRef,useState} from 'react';
import type {Exercise} from './types';
import {Pause,Play} from 'lucide-react';
import './exercise-demo.css';
import {ExerciseFigure} from './ExerciseFigure';
import {demos,demonstrationKey,demonstrationPose} from './exercise-demonstrations';
export {demonstrationKey,demonstrationPose} from './exercise-demonstrations';
export function ExerciseDemo({exercise}:{exercise:Exercise}){
 const key=demonstrationKey(exercise),demo=key?demos[key]:undefined;
 const [phase,setPhase]=useState(0),[playing,setPlaying]=useState(false);
 const figureRef=useRef<HTMLElement|null>(null),phaseRef=useRef(phase);
 phaseRef.current=phase;
 const [reducedMotion,setReducedMotion]=useState(()=>typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{const query=window.matchMedia('(prefers-reduced-motion: reduce)');const change=()=>{setReducedMotion(query.matches);if(query.matches)setPlaying(false)};query.addEventListener('change',change);return()=>query.removeEventListener('change',change)},[]);
 useEffect(()=>{setPhase(0);setPlaying(false)},[exercise.id]);
 useEffect(()=>{const element=figureRef.current;if(!element)return;const observer=new IntersectionObserver(([entry])=>{if(!entry.isIntersecting)setPlaying(false)});observer.observe(element);const hide=()=>{if(document.hidden)setPlaying(false)};document.addEventListener('visibilitychange',hide);return()=>{observer.disconnect();document.removeEventListener('visibilitychange',hide)}},[key]);
 useEffect(()=>{
  if(!playing||reducedMotion)return;
  let frame=0,last=0;const started=performance.now(),offset=Math.acos(1-2*phaseRef.current);
  const tick=(now:number)=>{if(now-last>=1000/24){setPhase((1-Math.cos(offset+(now-started)/3600*Math.PI*2))/2);last=now}frame=requestAnimationFrame(tick)};
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
 },[playing,reducedMotion]);
 if(!demo)return <div className="exercise-demo-empty"><span className="eyebrow">MOVEMENT REFERENCE</span><h3>{exercise.name}</h3><p>A matching demonstration for this exact variation is not available yet.</p><p>Use the step-by-step instructions for this exercise. No substitute exercise is shown.</p></div>;
 const pose=demonstrationPose(exercise,phase)!;
 return <figure className="exercise-demo" ref={figureRef}><div className="demo-title"><strong>{demo.title}</strong><span>{demo.view}</span></div>
 <div className="demo-stage"><ExerciseFigure demo={demo} pose={pose} demoKey={key!} phase={phase}/><span className="demo-stage-note">{key==='plank'?'STATIC HOLD':'MOVEMENT REFERENCE'}</span></div>
 <div className="demo-phase-controls"><button type="button" aria-pressed={!playing&&phase===0} onClick={()=>{setPlaying(false);setPhase(0)}}><span>01 / START</span>{demo.start}</button><button type="button" aria-pressed={!playing&&phase===1} onClick={()=>{setPlaying(false);setPhase(1)}}><span>02 / {key==='plank'?'HOLD':'FINISH'}</span>{demo.finish}</button></div>
 {key!=='plank'&&<><label className="demo-scrub"><span>Explore the movement</span><output aria-hidden="true">{Math.round(phase*100)}%</output><input type="range" min="0" max="100" step="1" value={Math.round(phase*100)} aria-label="Movement position" aria-valuetext={`${Math.round(phase*100)} percent toward ${demo.finish.toLowerCase()}`} onChange={event=>{setPlaying(false);setPhase(Number(event.target.value)/100)}}/></label>{reducedMotion?<p className="small muted">Reduced motion is on. Use the position buttons or slider to explore this movement.</p>:<button type="button" className="btn secondary demo-play" onClick={()=>setPlaying(!playing)}>{playing?<Pause size={16} aria-hidden="true"/>:<Play size={16} aria-hidden="true"/>} {playing?'Pause demonstration':'Play movement'}</button>}</>}
 <figcaption><ul>{demo.cues.map(cue=><li key={cue}>{cue}</li>)}</ul><small>Movement illustration · demonstrates the named variation, not a measurement of your technique.</small></figcaption>
 </figure>;
}

