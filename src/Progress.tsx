import type {ReactNode} from 'react';
import { useMemo, useState } from 'react';
import {clamp,MAX_REPS,MAX_WEIGHT_KG,toDisplayWeight,toKilograms} from './units';
import { ArrowUpRight, CalendarDays, Check, ChevronDown, Clock3, Dumbbell, Info, Pencil, Play, Save, Trash2, Trophy, Video, X } from 'lucide-react';
import type { Exercise, HistoryEntry, ToastFn } from './types';
import {localWorkoutDate,updateHistorySet} from './domain/workout';
import {isTimedExercise} from './exercise-logging';
import './progress-profile.css';

type Props = { history: HistoryEntry[]; exercises:Exercise[]; units: 'kg' | 'lb'; onFeedback: (exerciseId?: string, resultOnly?:boolean) => void; onUpdateHistory: (entry: HistoryEntry) => void; onDeleteHistory: (id: string) => void; toast: ToastFn; deviceContent?:ReactNode };
const dateLabel = (date: string, long = false) => new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: long ? 'long' : 'short', day: 'numeric' });
const weightValue = (weight: number, units: 'kg' | 'lb') => Math.round(toDisplayWeight(weight,units) * 10) / 10;
const number = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 1 });

function SampleRecording({ label, set, rep, onRep }: { label: string; set: string; rep: number; onRep: (n: number) => void }) {
  const [overlay, setOverlay] = useState(true);
  return <section className="comparison-recording" aria-label={`${label} illustrative recording`}>
    <div className="comparison-stage">
      <span className="clip-label">ILLUSTRATION · NO VIDEO</span>
      <svg viewBox="0 0 300 260" role="img" aria-label="Illustrative side view of a person performing a squat. This illustration is not a measured recording.">
        <path d="M20 222H280M35 25V222M265 25V222" stroke="#343a31" fill="none" />
        <path d="M43 58V39H64M235 39H255V59M43 185V205H64M235 205H255V185" stroke="#59644e" strokeWidth="2" fill="none" />
        <ellipse cx="153" cy="224" rx="58" ry="6" fill="#11140f" />
        <circle cx="171" cy="68" r="18" fill="#a9b0a1" />
        <path d="M162 94L139 139L180 165L164 206M146 139L104 167L129 208M162 95L193 120L222 115" stroke="#67705e" strokeWidth="23" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M127 213L143 215M163 213L184 216" stroke="#afb6a6" strokeWidth="12" strokeLinecap="round" />
        {overlay && <g stroke="#c6f36b" fill="#c6f36b" strokeWidth="2.2"><path d="M169 71L162 96L142 139L180 165L166 208M142 139L104 167L129 208M162 96L192 119L220 115" fill="none" />{[[169,71],[162,96],[142,139],[180,165],[166,208],[104,167],[129,208],[192,119],[220,115]].map(([x,y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="3" />)}</g>}
      </svg>
      <span className="rep-indicator">Rep {rep} of 8</span>
      <button className="overlay-button" aria-pressed={overlay} onClick={() => setOverlay(!overlay)}>{overlay ? 'Hide' : 'Show'} overlay</button>
    </div>
    <div className="comparison-caption"><strong>{label}</strong><span className="muted">{set} · side view</span></div>
    <div className="rep-select" aria-label={`Select illustrative rep for ${label}`}>
      {Array.from({ length: 8 }, (_, i) => <button key={i} onClick={() => onRep(i + 1)} aria-pressed={rep === i + 1} aria-label={`${label}, rep ${i + 1}`}>{i + 1}</button>)}
    </div>
  </section>;
}

export default function Progress({ history, exercises, units, onFeedback, onUpdateHistory, onDeleteHistory, toast, deviceContent }: Props) {
  const [source, setSource] = useState('all');
  const [exerciseChoice, setExerciseChoice] = useState('');
  const [metric, setMetric] = useState('reps');
  const [compare, setCompare] = useState(false);
  const [repA, setRepA] = useState(7);
  const [repB, setRepB] = useState(7);
  const [editing, setEditing] = useState<HistoryEntry | null>(null);
  const entries = useMemo(() => [...history].filter(entry => source === 'all' || (source === 'sample' ? entry.sample : !entry.sample)).sort((a, b) => (b.completedAt || b.date).localeCompare(a.completedAt || a.date)), [history, source]);
  const exerciseIdentity = useMemo(() => {
    const currentNameById=new Map(exercises.map(exercise=>[exercise.id,exercise.name]));
    const idByName = new Map(exercises.map(exercise=>[exercise.name,exercise.id]));
    const resistanceEntries=entries.filter(entry=>entry.kind!=='recovery');
    resistanceEntries.forEach(entry => entry.exercises.forEach(exercise => { if (exercise.exerciseId && !idByName.has(exercise.name)) idByName.set(exercise.name, exercise.exerciseId); }));
    const options = new Map<string, string>();
    resistanceEntries.forEach(entry => entry.exercises.filter(exercise=>exercise.sets.some(set=>set.done)).forEach(exercise => {const key=exercise.exerciseId || idByName.get(exercise.name) || `name:${exercise.name}`;if(!options.has(key))options.set(key,currentNameById.get(key)||exercise.name);}));
    return {options:[...options].map(([key, label]) => ({ key, label })),idByName};
  }, [entries,exercises]);
  const exerciseOptions=exerciseIdentity.options;
  const exerciseKey = exerciseOptions.some(option => option.key === exerciseChoice) ? exerciseChoice : exerciseOptions[0]?.key || '';
  const exercise = exerciseOptions.find(option => option.key === exerciseKey)?.label || '';
  const idByName = exerciseIdentity.idByName;
  const exerciseRecords = entries.filter(entry=>entry.kind!=='recovery').reverse().flatMap(entry => {
    const sets = entry.exercises.filter(e => (e.exerciseId || idByName.get(e.name) || `name:${e.name}`) === exerciseKey).flatMap(e => e.sets).filter(set => set.done);
    return sets.length ? [{ entry, reps: sets.reduce((sum, set) => sum + set.reps, 0), load: Math.max(...sets.map(set => set.weight)), bestReps: Math.max(...sets.map(set => set.reps)), volume: sets.reduce((sum, set) => sum + set.reps * set.weight, 0) }] : [];
  });
  const trend = exerciseRecords.slice(-8);
  const weighted = exerciseRecords.some(point => point.load > 0);
  const timeBased = isTimedExercise({id:exerciseKey.startsWith('name:')?undefined:exerciseKey,name:exercise});
  const effectiveMetric = !weighted && metric === 'load' ? 'reps' : metric;
  const metricValues = trend.map(point => effectiveMetric === 'load' ? weightValue(point.load, units) : point.reps);
  const maximum = Math.max(1, ...metricValues);
  const best = Math.max(0, ...exerciseRecords.map(point => weighted ? weightValue(point.load, units) : point.bestReps));
  const totalSets = entries.reduce((sum, entry) => sum + entry.sets, 0);
  const totalVolume = weightValue(entries.reduce((sum, entry) => sum + entry.volume, 0), units);
  const sampleCount = entries.filter(entry => entry.sample).length;
  const localCount = entries.length - sampleCount;
  const today = new Date();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  const weekDates = Array.from({ length: 7 }, (_, index) => localWorkoutDate(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index)));
  const weekLabel = `${dateLabel(weekDates[0])}–${dateLabel(weekDates[6])}`;
  const trainingDays = weekDates.filter(date => entries.some(entry => entry.date.slice(0, 10) === date)).length;
  function editSet(exerciseIndex: number, setId: string, field: 'weight' | 'reps', displayedValue: number) {
    if (!Number.isFinite(displayedValue)) return;
    const value=field==='weight'?toKilograms(clamp(displayedValue,0,toDisplayWeight(MAX_WEIGHT_KG,units)),units):clamp(Math.round(displayedValue),1,MAX_REPS);
    setEditing(current=>current?updateHistorySet(current,exerciseIndex,setId,field,value):null);
  }
  function saveEdit() {
    if (!editing) return;
    const completed = editing.exercises.flatMap(exercise => exercise.sets).filter(set => set.done);
    onUpdateHistory({ ...editing, sets: completed.length, volume: completed.reduce((total, set) => total + set.weight * set.reps, 0) });
    setEditing(null);
  }
  return <div className="progress-page">
    <header className="page-heading"><div><p className="eyebrow">YOUR TRAINING, OVER TIME</p><h1>Keep showing up.</h1><p className="muted">The work adds up. See where you’ve been.</p></div><span className="badge"><CalendarDays size={14} aria-hidden="true" /> {today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span></header>
    <div className="progress-source"><div className="source-segments" aria-label="Filter history source">{[['all', 'All sessions'], ['local', 'Your sessions'], ['sample', 'Sample data']].map(([value, label]) => <button key={value} aria-pressed={source === value} onClick={() => setSource(value)}>{label}</button>)}</div><span className="muted">{sampleCount > 0 ? `${sampleCount} sample · ${localCount} locally logged` : `${localCount} locally logged`}</span></div>
    {entries.length === 0 ? <section className="panel empty-state"><Dumbbell size={32} aria-hidden="true" /><h2>{source === 'sample' ? 'No sample sessions to show.' : 'Your next session is the start.'}</h2><p className="muted">Finish a workout in Today to see completed sets, history, and exercise trends here.</p>{source !== 'all' && <button className="btn secondary" onClick={() => setSource('all')}>Show all sessions</button>}</section> : <>
      <section className="progress-summary" aria-label="Training summary">
        <div className="panel summary-stat"><span className="muted">Completed sessions</span><strong>{entries.length.toString().padStart(2, '0')}<span>sessions</span></strong><span>{totalSets} completed sets</span></div>
        <div className="panel summary-stat"><span className="muted">Logged volume</span><strong>{number(totalVolume)}<span>{units}</span></strong><span>External load × reps</span></div>
        <div className="panel consistency-card"><div className="consistency-heading"><span className="muted">Days active</span><strong>{trainingDays}<span> / 7</span></strong></div><div className="consistency-days">{weekDates.map(date => { const done = entries.some(entry => entry.date.slice(0,10) === date); return <div key={date}><span>{new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'narrow' })}</span><span role="img" className={done ? 'day-dot trained' : 'day-dot'} aria-label={`${dateLabel(date)}: ${done ? 'session completed' : 'no session logged'}`}>{done ? <Check size={15} aria-hidden="true" /> : '·'}</span></div>; })}</div><span className="muted">{weekLabel} · current week</span></div>
      </section>
      <p className="progress-footnote"><Info size={14} aria-hidden="true" /> {sampleCount > 0 ? 'Includes labeled sample workouts. Some samples contain a partial set breakdown.' : 'Based on sessions completed in this browser.'} Volume excludes body weight; recorded load conventions affect totals.</p>
      {exerciseOptions.length>0?<div className="progress-main-grid">
        <section className="panel trend-panel">
          <div className="section-heading"><div><p className="eyebrow">ONE EXERCISE AT A TIME</p><h2>Performance</h2></div><ArrowUpRight size={21} aria-hidden="true" /></div>
          <label className="field trend-exercise" htmlFor="progress-exercise-choice"><span id="progress-exercise-label">Exercise</span><select id="progress-exercise-choice" aria-labelledby="progress-exercise-label" value={exerciseKey} onChange={e => setExerciseChoice(e.target.value)}>{exerciseOptions.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
          <div className="trend-metric"><div className="source-segments" aria-label="Trend metric"><button aria-pressed={effectiveMetric === 'reps'} onClick={() => setMetric('reps')}>{timeBased ? 'Seconds logged' : 'Reps logged'}</button><button aria-pressed={effectiveMetric === 'load'} disabled={!weighted} onClick={() => setMetric('load')}>Highest load</button></div><span className="muted">Last {trend.length} sessions</span></div>
          {trend.length ? <><div className="trend-chart" role="img" aria-label={`${exercise}, ${effectiveMetric === 'load' ? `highest load in ${units}` : timeBased ? 'total seconds' : 'total reps'}: ${trend.map((p, i) => `${dateLabel(p.entry.date)}, ${metricValues[i]}${p.entry.sample ? ' (sample)' : ''}`).join('; ')}. Exact values in the table below.`}><span className="chart-axis-label">{effectiveMetric === 'load' ? units : timeBased ? 'SECONDS' : 'REPS'}</span><div className="chart-grid"><span /><span /><span /></div><div className="chart-bars">{trend.map((point, i) => <div className="chart-column" key={point.entry.id}><span className="bar-value">{number(metricValues[i])}</span><span className={`chart-bar${point.entry.sample ? ' sample-bar' : ''}`} style={{ height: `${Math.max(3, (metricValues[i] / maximum) * 105)}px` }} /><span className="chart-date">{dateLabel(point.entry.date)}</span></div>)}</div></div><p className="trend-caution">{trend.length < 3 ? 'A starting point, not a trend yet.' : 'A snapshot of logged work.'} {sampleCount > 0 ? 'Sample sessions demonstrate the view; they do not establish your progress.' : 'Load, reps, and conditions vary. More comparable sessions will add context.'}</p><details className="trend-data"><summary>View exact data <ChevronDown size={15} aria-hidden="true" /></summary><div className="table-container"><table><caption>{exercise} · completed detailed sets</caption><thead><tr><th scope="col">Session</th><th scope="col">{timeBased ? 'Seconds' : 'Reps'}</th><th scope="col">Top load</th></tr></thead><tbody>{trend.map(point => <tr key={point.entry.id}><th scope="row">{dateLabel(point.entry.date)} <small>{point.entry.sample ? 'Sample' : 'Local'}</small></th><td>{point.reps}</td><td>{point.load ? `${number(weightValue(point.load, units))} ${units}` : 'Bodyweight'}</td></tr>)}</tbody></table></div></details></> : <p className="muted">Complete a set of this exercise to see your first data point.</p>}
        </section>
        <section className="panel record-panel"><div className="record-icon"><Trophy size={24} aria-hidden="true" /></div><p className="eyebrow">LOGGED PERSONAL RECORD</p><h2>{exercise || 'Your first record awaits'}</h2><p className="record-number">{number(best)} <span>{weighted ? units : timeBased ? 'sec' : 'reps'}</span></p><strong>{weighted ? 'Highest external load' : timeBased ? 'Longest logged hold' : 'Most reps in one set'}</strong><p className="muted">{weighted ? 'The heaviest load in a completed, detailed set for this exercise.' : timeBased ? 'The longest duration in one completed, detailed hold for this exercise.' : 'The highest rep count in one completed, detailed bodyweight set for this exercise.'} Compared within the selected history; no estimated one-rep max.</p>{sampleCount > 0 && <span className="badge">Includes sample data</span>}<p className="record-definition">A record of what was logged. It does not rate technique or establish a meaningful improvement.</p></section>
      </div>:<section className="panel empty-state"><Dumbbell size={30} aria-hidden="true"/><h2>No strength sets logged yet.</h2><p className="muted">Your completed activity sessions are saved below. Log a resistance exercise set to see exercise trends and personal records.</p></section>}
      <section className="history-section"><div className="section-heading"><div><p className="eyebrow">THE WORK YOU PUT IN</p><h2>Workout history</h2></div><span className="muted">{entries.length} sessions</span></div><div className="history-list">{entries.map(entry => {
        const detailedCount = entry.exercises.reduce((sum, e) => sum + e.sets.filter(set => set.done).length, 0);
        const draft = editing?.id === entry.id ? editing : null;
        return <details className="panel history-entry" key={entry.id}><summary><span className="history-date"><strong>{new Date(`${entry.date.slice(0,10)}T12:00:00`).getDate().toString().padStart(2, '0')}</strong><span>{new Date(`${entry.date.slice(0,10)}T12:00:00`).toLocaleDateString('en-US', { month: 'short' })}</span></span><span className="history-title"><span><strong>{entry.name}</strong><span className="history-source">{entry.kind==='recovery'?'Recovery':entry.sample ? 'Sample' : 'Your log'}</span></span><span className="history-meta"><span><Clock3 size={13} aria-hidden="true" />{entry.duration} min</span>{entry.kind!=='recovery'&&<><span>{entry.sets} sets</span><span>{number(weightValue(entry.volume, units))} {units} volume</span></>}</span></span><ChevronDown className="history-chevron" size={19} aria-hidden="true" /></summary><div className="history-detail">{entry.kind==='recovery'&&<p className="muted">Easy recovery activity completed. No resistance sets or lifting volume recorded.</p>}{!entry.sample && <div className="history-actions">{draft ? <><button className="btn primary" onClick={saveEdit}><Save size={15} aria-hidden="true" />Save corrections</button><button className="btn ghost" onClick={() => setEditing(null)}><X size={15} aria-hidden="true" />Cancel</button></> : <>{entry.kind!=='recovery'&&<button className="btn secondary" onClick={() => setEditing(structuredClone(entry))}><Pencil size={15} aria-hidden="true" />Edit sets</button>}<button className="btn ghost danger-action" onClick={() => onDeleteHistory(entry.id)}><Trash2 size={15} aria-hidden="true" />Delete workout</button></>}</div>}{detailedCount !== entry.sets && <p className="partial-notice"><Info size={15} aria-hidden="true" />Partial sample breakdown: {detailedCount} of {entry.sets} summarized sets are shown. Trends and records use only the detailed sets.</p>}{(draft || entry).exercises.map((exercise, exerciseIndex) => <div className="history-exercise" key={`${exercise.exerciseId || exercise.name}-${exerciseIndex}`}><h3>{exercise.name}</h3>{exercise.notes&&<p className="history-note">{exercise.notes}</p>}{draft ? <div className="history-set-editor">{exercise.sets.filter(set => set.done).map((set, setIndex) => <div className="history-set-row" key={set.id}><span>Set {setIndex + 1}</span><label>Load ({units})<input type="number" inputMode="decimal" min="0" max={weightValue(MAX_WEIGHT_KG,units)} step="0.5" value={weightValue(set.weight, units)} onFocus={event=>event.currentTarget.select()} onChange={event => editSet(exerciseIndex, set.id, 'weight', event.target.valueAsNumber)} /></label><label>{isTimedExercise(exercise) ? 'Seconds' : 'Reps'}<input type="number" inputMode="numeric" min="1" max={MAX_REPS} step="1" value={set.reps} onFocus={event=>event.currentTarget.select()} onChange={event => editSet(exerciseIndex, set.id, 'reps', event.target.valueAsNumber)} /></label></div>)}</div> : <div>{exercise.sets.filter(set => set.done).map((set, i) => <span className="set-pill" key={set.id}>Set {i+1}<strong>{set.weight ? `${number(weightValue(set.weight, units))} ${units} × ` : ''}{set.reps} {isTimedExercise(exercise) ? 'sec' : 'reps'}</strong></span>)}</div>}</div>)}{entry.feedback && !draft && <button className="btn secondary" onClick={() => { const real=entry.feedbackKind==='analysis';toast(real?'Detailed AI results were cleared after the check. You can run another local analysis.':'Opening an illustrative sample. No real movement analysis was saved.'); onFeedback(entry.feedbackExerciseId,!real); }}><Video size={17} aria-hidden="true" />{entry.feedbackKind==='analysis'?'Run another form check':'View sample feedback'}<ArrowUpRight size={16} aria-hidden="true" /></button>}</div></details>;
      })}</div></section>
    </>}
    {deviceContent}<section className="panel compare-panel"><div className="compare-intro"><div className="comparison-icon"><Video size={23} aria-hidden="true" /></div><div><p className="eyebrow">A CLOSER LOOK</p><h2>Put two sets side by side.</h2><p className="muted">Compare the same exercise, one rep at a time.</p><span className="badge">Illustrative sample recordings</span></div><button className="btn secondary" aria-expanded={compare} aria-controls="recording-comparison" onClick={() => setCompare(!compare)}>{compare ? 'Close comparison' : 'Compare recordings'}<ArrowUpRight size={17} aria-hidden="true" /></button></div>{compare && <div id="recording-comparison"><div className="comparison-description"><h3>Bodyweight squat · side view</h3><p className="muted">Both panels use a static, illustrative pose. Selecting a rep demonstrates navigation; it does not show measured changes in movement or technique.</p></div><div className="comparison-grid"><SampleRecording label="October 7" set="Sample · Set 1" rep={repA} onRep={setRepA} /><SampleRecording label="October 12" set="Sample · Set 3" rep={repB} onRep={setRepB} /></div><p className="comparison-tip"><Info size={16} aria-hidden="true" />In a future video comparison, use a similar angle and load. No improvement claim can be made from these illustrations.</p><button className="btn ghost" onClick={() => onFeedback('squat')}><Play size={16} aria-hidden="true" />Explore sample coaching feedback</button></div>}</section>
  </div>;
}
