import {useState} from 'react';
import type {HistoryEntry,Preferences,Routine} from './types';
import {strengthCheckId,strengthCheckRoutine} from './strength-check';
import {POUNDS_PER_KILOGRAM} from './units';
export default function StrengthCheck({preferences,history,onStart}:{preferences:Preferences;history:HistoryEntry[];onStart:(routine:Routine)=>void}){
 const [open,setOpen]=useState(false);
 const latest=[...history].filter(h=>!h.sample&&h.routineId===strengthCheckId).sort((a,b)=>(b.completedAt||b.date).localeCompare(a.completedAt||a.date))[0];
 const routine=strengthCheckRoutine(preferences);
 return <section className="panel strength-check" aria-labelledby="strength-check-title">
 <span className="eyebrow">OPTIONAL · BEGINNER BASELINE</span><h2 id="strength-check-title">Find your starting point.</h2>
 <p className="muted">Try a short strength check before your first training day. Learn what feels manageable and keep a baseline to compare later.</p>
 <p className="small muted">{routine.exercises.length} movements · about 15–20 min · warm-up included</p>
 <button className="btn secondary" aria-expanded={open} onClick={()=>setOpen(!open)}>{open?'Maybe later':'Explore strength check'}</button>
 {open&&<div className="strength-check-guide"><h3>How the test day works</h3><ol>
 <li>Complete the targeted warm-up. Begin squats and bridges with bodyweight at an easy depth. If using dumbbells, start with the lightest comfortable pair.</li>
 <li>Do one easy practice set, rest two minutes, then repeat for a comfortable baseline set. Stop with about three good reps left. For planks, stop before your position changes.</li>
 <li>Log actual reps (seconds for planks), load, and whether it felt easy, manageable, or too hard. Skip movements that cause pain or feel unfamiliar.</li>
 <li>Save to Progress. Compare the same variation and range next time; this is a personal baseline, not a maximum-strength score.</li></ol>
 <p className="small muted">Starting-load guide: keep a load only if your reps feel controlled. Reduce the load or use an easier variation if technique breaks.</p>
 <div className="dialog-actions"><button className="btn ghost" onClick={()=>setOpen(false)}>Skip for now</button><button className="btn primary" onClick={()=>onStart(routine)}>Start optional strength check</button></div></div>}
 {latest&&<details className="strength-check-results"><summary>Latest baseline · {latest.date} · {latest.exercises.length} movements logged</summary>
 <p className="small muted">Only completed sets are shown. A skipped or unlogged movement has no baseline.</p>
 {latest.exercises.map((exercise,i)=><div key={i}><strong>{exercise.name}</strong><p>{exercise.sets.map((set,j)=>'Set '+(j+1)+': '+(+(set.weight*(preferences.units==='lb'?POUNDS_PER_KILOGRAM:1)).toFixed(1))+' '+preferences.units+' × '+set.reps+(exercise.exerciseId==='plank'?' sec':' reps')).join(' · ')}</p><p className="small muted">{exercise.notes||'Effort not recorded.'}</p></div>)}
 <p className="small muted">Use a manageable baseline as a reference, not an automatic instruction to increase weight.</p></details>}
 </section>;
}
