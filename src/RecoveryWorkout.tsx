import {useEffect,useState} from 'react';
import {Check,Clock3,Leaf} from 'lucide-react';
import type {Session} from './types';
import './recovery-workout.css';
import SessionNavigation from './SessionNavigation';

export default function RecoveryWorkout({session,onFinish,onBack,onCancel}:{session:Session;onFinish:()=>void;onBack:()=>void;onCancel:()=>void}){
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[]);
  const minutes=session.recovery?.minutes??0;
  const duration=Math.max(0,minutes*60);
  const remaining=Math.max(0,Math.ceil((session.startedAt+duration*1000-now)/1000));
  const steps=session.recovery?.steps||[];
  return <div className="recovery-workout">
    <SessionNavigation onBack={onBack} onCancel={onCancel}/>
    <div className="page-heading"><div><p className="eyebrow">ROOM TO RECOVER{session.scheduledDay?` · ${session.scheduledDay.toUpperCase()}`:''}</p><h1>{session.name}</h1><p className="muted">A lighter day is part of your plan. Give your working muscles time to recover.</p></div><span className="tag lime-tag"><Leaf size={16}/>RECOVERY</span></div>
    <div className="recovery-session-grid">
      <section className="panel recovery-activities" aria-labelledby="recovery-activities-heading"><span className="recovery-leaf"><Leaf size={27} aria-hidden="true"/></span><h2 id="recovery-activities-heading">Keep it easy today.</h2><p className="muted">Choose comfortable movement at a conversational pace. Full rest is okay if that feels better.</p>{steps.length>0&&<ol>{steps.map((step,index)=><li key={`${index}-${step}`}><span aria-hidden="true">{String(index+1).padStart(2,'0')}</span><p>{step}</p></li>)}</ol>}<p className="recovery-comfort">Skip anything that causes pain. You can shorten the session or rest instead.</p></section>
      <aside className="panel recovery-session-timer" aria-labelledby="recovery-timer-heading"><Clock3 size={24} aria-hidden="true"/><h2 id="recovery-timer-heading">Your recovery time</h2>{duration>0?<><p className="muted">An optional {minutes}-minute window for easy movement.</p><div className="recovery-clock" role="timer" aria-label={`${Math.floor(remaining/60)} minutes ${remaining%60} seconds remaining`}>{String(Math.floor(remaining/60)).padStart(2,'0')}<span>:</span>{String(remaining%60).padStart(2,'0')}</div><progress aria-label="Recovery timer progress" max={duration} value={Math.min(duration,Math.max(0,duration-remaining))}/><p className="recovery-timer-note" role="status">{remaining?'The timer keeps running if you leave this screen. Finish whenever you’re ready.':'Your suggested movement time is complete. Finish when you’re ready.'}</p></>:<p className="muted">Take the rest you need. Mark this day complete when you’re ready.</p>}<button className="btn primary" onClick={onFinish}><Check size={18}/>Complete recovery session</button><p className="settings-note">Saves the elapsed time in your activity history.</p></aside>
    </div>
  </div>;
}
