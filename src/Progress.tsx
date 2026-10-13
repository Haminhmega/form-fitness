import type {ReactNode} from 'react';
import { useMemo, useState } from 'react';
import { ArrowUpRight, CalendarDays, Check, ChevronDown, Clock3, Dumbbell, Info, Play, Trophy, Video } from 'lucide-react';
import type { HistoryEntry, ToastFn } from './types';
import './progress-profile.css';

type Props = { history: HistoryEntry[]; units: 'kg' | 'lb'; onFeedback: (exerciseId?: string) => void; toast: ToastFn; deviceContent?:ReactNode };
const dateLabel = (date: string, long = false) => new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: long ? 'long' : 'short', day: 'numeric' });
const weightValue = (weight: number, units: 'kg' | 'lb') => Math.round(weight * (units === 'lb' ? 2.2046226218 : 1) * 10) / 10;
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

export default function Progress({ history, units, onFeedback, toast, deviceContent }: Props) {
  const [source, setSource] = useState('all');
  const [exerciseChoice, setExerciseChoice] = useState('');
  const [metric, setMetric] = useState('reps');
  const [compare, setCompare] = useState(false);
  const [repA, setRepA] = useState(7);
  const [repB, setRepB] = useState(7);
  const entries = useMemo(() => [...history].filter(entry => source === 'all' || (source === 'sample' ? entry.sample : !entry.sample)).sort((a, b) => b.date.localeCompare(a.date)), [history, source]);
  const names = [...new Set(entries.flatMap(entry => entry.exercises.map(exercise => exercise.name)))];
  const exercise = names.includes(exerciseChoice) ? exerciseChoice : names[0] || '';
  const exerciseRecords = [...entries].reverse().flatMap(entry => {
    const sets = entry.exercises.filter(e => e.name === exercise).flatMap(e => e.sets).filter(set => set.done);
    return sets.length ? [{ entry, reps: sets.reduce((sum, set) => sum + set.reps, 0), load: Math.max(...sets.map(set => set.weight)), bestReps: Math.max(...sets.map(set => set.reps)), volume: sets.reduce((sum, set) => sum + set.reps * set.weight, 0) }] : [];
  });
  const trend = exerciseRecords.slice(-8);
  const weighted = exerciseRecords.some(point => point.load > 0);
  const timeBased = exercise === 'Forearm plank';
  const effectiveMetric = !weighted && metric === 'load' ? 'reps' : metric;
  const metricValues = trend.map(point => effectiveMetric === 'load' ? weightValue(point.load, units) : point.reps);
  const maximum = Math.max(1, ...metricValues);
  const best = Math.max(0, ...exerciseRecords.map(point => weighted ? weightValue(point.load, units) : point.bestReps));
  const totalSets = entries.reduce((sum, entry) => sum + entry.sets, 0);
  const totalVolume = weightValue(entries.reduce((sum, entry) => sum + entry.volume, 0), units);
  const sampleCount = entries.filter(entry => entry.sample).length;
  const localCount = entries.length - sampleCount;
  const weekDates = ['2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13'];
  const trainingDays = weekDates.filter(date => entries.some(entry => entry.date.slice(0, 10) === date)).length;
  return <div className="progress-page">
    <header className="page-heading"><div><p className="eyebrow">YOUR TRAINING, OVER TIME</p><h1>Keep showing up.</h1><p className="muted">The work adds up. See where you’ve been.</p></div><span className="badge"><CalendarDays size={14} aria-hidden="true" /> October 2026</span></header>
    <div className="progress-source"><div className="source-segments" aria-label="Filter history source">{[['all', 'All sessions'], ['local', 'Your sessions'], ['sample', 'Sample data']].map(([value, label]) => <button key={value} aria-pressed={source === value} onClick={() => setSource(value)}>{label}</button>)}</div><span className="muted">{sampleCount > 0 ? `${sampleCount} sample · ${localCount} locally logged` : `${localCount} locally logged`}</span></div>
    {entries.length === 0 ? <section className="panel empty-state"><Dumbbell size={32} aria-hidden="true" /><h2>{source === 'sample' ? 'No sample sessions to show.' : 'Your next session is the start.'}</h2><p className="muted">Finish a workout in Today to see completed sets, history, and exercise trends here.</p>{source !== 'all' && <button className="btn secondary" onClick={() => setSource('all')}>Show all sessions</button>}</section> : <>
      <section className="progress-summary" aria-label="Training summary">
        <div className="panel summary-stat"><span className="muted">Completed sessions</span><strong>{entries.length.toString().padStart(2, '0')}<span>sessions</span></strong><span>{totalSets} completed sets</span></div>
        <div className="panel summary-stat"><span className="muted">Logged volume</span><strong>{number(totalVolume)}<span>{units}</span></strong><span>External load × reps</span></div>
        <div className="panel consistency-card"><div className="consistency-heading"><span className="muted">Days trained</span><strong>{trainingDays}<span> / 7</span></strong></div><div className="consistency-days">{weekDates.map(date => { const done = entries.some(entry => entry.date.slice(0,10) === date); return <div key={date}><span>{new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'narrow' })}</span><span role="img" className={done ? 'day-dot trained' : 'day-dot'} aria-label={`${dateLabel(date)}: ${done ? 'workout completed' : 'no workout logged'}`}>{done ? <Check size={15} aria-hidden="true" /> : '·'}</span></div>; })}</div><span className="muted">October 7–13 · sample week</span></div>
      </section>
      <p className="progress-footnote"><Info size={14} aria-hidden="true" /> {sampleCount > 0 ? 'Includes labeled sample workouts. Some samples contain a partial set breakdown.' : 'Based on sessions completed in this browser.'} Volume excludes body weight; recorded load conventions affect totals.</p>
      <div className="progress-main-grid">
        <section className="panel trend-panel">
          <div className="section-heading"><div><p className="eyebrow">ONE EXERCISE AT A TIME</p><h2>Performance</h2></div><ArrowUpRight size={21} aria-hidden="true" /></div>
          <label className="field trend-exercise" htmlFor="progress-exercise-choice"><span id="progress-exercise-label">Exercise</span><select id="progress-exercise-choice" aria-labelledby="progress-exercise-label" value={exercise} onChange={e => setExerciseChoice(e.target.value)}>{names.map(name => <option key={name}>{name}</option>)}</select></label>
          <div className="trend-metric"><div className="source-segments" aria-label="Trend metric"><button aria-pressed={effectiveMetric === 'reps'} onClick={() => setMetric('reps')}>{timeBased ? 'Seconds logged' : 'Reps logged'}</button><button aria-pressed={effectiveMetric === 'load'} disabled={!weighted} onClick={() => setMetric('load')}>Highest load</button></div><span className="muted">Last {trend.length} sessions</span></div>
          {trend.length ? <><div className="trend-chart" role="img" aria-label={`${exercise}, ${effectiveMetric === 'load' ? `highest load in ${units}` : timeBased ? 'total seconds' : 'total reps'}: ${trend.map((p, i) => `${dateLabel(p.entry.date)}, ${metricValues[i]}${p.entry.sample ? ' (sample)' : ''}`).join('; ')}. Exact values in the table below.`}><span className="chart-axis-label">{effectiveMetric === 'load' ? units : timeBased ? 'SECONDS' : 'REPS'}</span><div className="chart-grid"><span /><span /><span /></div><div className="chart-bars">{trend.map((point, i) => <div className="chart-column" key={point.entry.id}><span className="bar-value">{number(metricValues[i])}</span><span className={`chart-bar${point.entry.sample ? ' sample-bar' : ''}`} style={{ height: `${Math.max(3, (metricValues[i] / maximum) * 105)}px` }} /><span className="chart-date">{dateLabel(point.entry.date)}</span></div>)}</div></div><p className="trend-caution">{trend.length < 3 ? 'A starting point, not a trend yet.' : 'A snapshot of logged work.'} {sampleCount > 0 ? 'Sample sessions demonstrate the view; they do not establish your progress.' : 'Load, reps, and conditions vary. More comparable sessions will add context.'}</p><details className="trend-data"><summary>View exact data <ChevronDown size={15} aria-hidden="true" /></summary><div className="table-container"><table><caption>{exercise} · completed detailed sets</caption><thead><tr><th scope="col">Session</th><th scope="col">{timeBased ? 'Seconds' : 'Reps'}</th><th scope="col">Top load</th></tr></thead><tbody>{trend.map(point => <tr key={point.entry.id}><th scope="row">{dateLabel(point.entry.date)} <small>{point.entry.sample ? 'Sample' : 'Local'}</small></th><td>{point.reps}</td><td>{point.load ? `${number(weightValue(point.load, units))} ${units}` : 'Bodyweight'}</td></tr>)}</tbody></table></div></details></> : <p className="muted">Complete a set of this exercise to see your first data point.</p>}
        </section>
        <section className="panel record-panel"><div className="record-icon"><Trophy size={24} aria-hidden="true" /></div><p className="eyebrow">LOGGED PERSONAL RECORD</p><h2>{exercise || 'Your first record awaits'}</h2><p className="record-number">{number(best)} <span>{weighted ? units : timeBased ? 'sec' : 'reps'}</span></p><strong>{weighted ? 'Highest external load' : timeBased ? 'Longest logged hold' : 'Most reps in one set'}</strong><p className="muted">{weighted ? 'The heaviest load in a completed, detailed set for this exercise.' : timeBased ? 'The longest duration in one completed, detailed hold for this exercise.' : 'The highest rep count in one completed, detailed bodyweight set for this exercise.'} Compared within the selected history; no estimated one-rep max.</p>{sampleCount > 0 && <span className="badge">Includes sample data</span>}<p className="record-definition">A record of what was logged. It does not rate technique or establish a meaningful improvement.</p></section>
      </div>
      <section className="history-section"><div className="section-heading"><div><p className="eyebrow">THE WORK YOU PUT IN</p><h2>Workout history</h2></div><span className="muted">{entries.length} sessions</span></div><div className="history-list">{entries.map(entry => {
        const detailedCount = entry.exercises.reduce((sum, e) => sum + e.sets.filter(set => set.done).length, 0);
        return <details className="panel history-entry" key={entry.id}><summary><span className="history-date"><strong>{new Date(`${entry.date.slice(0,10)}T12:00:00`).getDate().toString().padStart(2, '0')}</strong><span>{new Date(`${entry.date.slice(0,10)}T12:00:00`).toLocaleDateString('en-US', { month: 'short' })}</span></span><span className="history-title"><span><strong>{entry.name}</strong><span className="history-source">{entry.sample ? 'Sample' : 'Local'}</span></span><span className="history-meta"><span><Clock3 size={13} aria-hidden="true" />{entry.duration} min</span><span>{entry.sets} sets</span><span>{number(weightValue(entry.volume, units))} {units} volume</span></span></span><ChevronDown className="history-chevron" size={19} aria-hidden="true" /></summary><div className="history-detail">{detailedCount !== entry.sets && <p className="partial-notice"><Info size={15} aria-hidden="true" />Partial sample breakdown: {detailedCount} of {entry.sets} summarized sets are shown. Trends and records use only the detailed sets.</p>}{entry.exercises.map((exercise, i) => <div className="history-exercise" key={`${exercise.name}-${i}`}><h3>{exercise.name}</h3><div>{exercise.sets.filter(set => set.done).map((set, i) => <span className="set-pill" key={set.id}>Set {i+1}<strong>{set.weight ? `${number(weightValue(set.weight, units))} ${units} × ` : ''}{set.reps} {exercise.name === 'Forearm plank' ? 'sec' : 'reps'}</strong></span>)}</div></div>)}{entry.feedback && <button className="btn secondary" onClick={() => { toast('Opening illustrative sample feedback. No real movement analysis was performed.'); onFeedback(entry.feedbackExerciseId); }}><Video size={17} aria-hidden="true" />View saved sample feedback<ArrowUpRight size={16} aria-hidden="true" /></button>}</div></details>;
      })}</div></section>
    </>}
    {deviceContent}<section className="panel compare-panel"><div className="compare-intro"><div className="comparison-icon"><Video size={23} aria-hidden="true" /></div><div><p className="eyebrow">A CLOSER LOOK</p><h2>Put two sets side by side.</h2><p className="muted">Compare the same exercise, one rep at a time.</p><span className="badge">Illustrative sample recordings</span></div><button className="btn secondary" aria-expanded={compare} aria-controls="recording-comparison" onClick={() => setCompare(!compare)}>{compare ? 'Close comparison' : 'Compare recordings'}<ArrowUpRight size={17} aria-hidden="true" /></button></div>{compare && <div id="recording-comparison"><div className="comparison-description"><h3>Bodyweight squat · side view</h3><p className="muted">Both panels use a static, illustrative pose. Selecting a rep demonstrates navigation; it does not show measured changes in movement or technique.</p></div><div className="comparison-grid"><SampleRecording label="October 7" set="Sample · Set 1" rep={repA} onRep={setRepA} /><SampleRecording label="October 12" set="Sample · Set 3" rep={repB} onRep={setRepB} /></div><p className="comparison-tip"><Info size={16} aria-hidden="true" />In a future video comparison, use a similar angle and load. No improvement claim can be made from these illustrations.</p><button className="btn ghost" onClick={() => onFeedback('squat')}><Play size={16} aria-hidden="true" />Explore sample coaching feedback</button></div>}</section>
  </div>;
}
