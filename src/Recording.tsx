import { useState } from 'react';
import type { Exercise } from './types';
import { getExerciseSupportLevel } from './ai/registry';
import {ExerciseDemo} from './ExerciseDemo';
import {exerciseSteps} from './exercise-guide';
import AIRecording from './AIRecording';
import './ai-recording.css';

export default function Recording({ exercise, onClose, onComplete, initialResult = false, standalone = false }: {
  exercise: Exercise; onClose: () => void; onComplete: (kind?: 'sample' | 'analysis') => void; initialResult?: boolean; standalone?: boolean;
}) {
  const level = getExerciseSupportLevel(exercise);
  const supported = level === 'real_ai' || level === 'experimental_ai';
  const [example, setExample] = useState(initialResult || !supported);
  if (!example && supported) return <AIRecording exercise={exercise} standalone={standalone} onClose={onClose} onComplete={() => onComplete('analysis')} onExample={() => setExample(true)} />;
  return <section className="reference-screen"><button className="btn ghost" onClick={onClose}>← {standalone?'Back to Today':'Back to workout'}</button><div className="page-heading"><div><p className="eyebrow">YOUR MOVEMENT REFERENCE</p><h1>{exercise.name}</h1><p className="muted">{exercise.variation} · {exercise.equipment}</p></div></div><div className="reference-layout"><ExerciseDemo key={exercise.id} exercise={exercise}/><div className="reference-copy panel"><h2>Set up this exercise</h2><ol>{exerciseSteps(exercise).map(step=><li key={step}>{step}</li>)}</ol><p className="muted">The demonstration is a movement guide. Feedback requires analysis of your own video.</p>{supported&&<button className="btn primary" onClick={()=>setExample(false)}>Try {level==='real_ai'?'motion':'beta motion'} check</button>}<button className="btn secondary" onClick={onClose}>Return to training</button></div></div></section>;
}
