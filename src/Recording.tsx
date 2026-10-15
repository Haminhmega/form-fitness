import { useState } from 'react';
import type { Exercise } from './types';
import { getExerciseSupportLevel } from './ai/registry';
import SampleRecording from './SampleRecording';
import AIRecording from './AIRecording';
import './ai-recording.css';

export default function Recording({ exercise, onClose, onComplete, initialResult = false, standalone = false }: {
  exercise: Exercise; onClose: () => void; onComplete: (kind?: 'sample' | 'analysis') => void; initialResult?: boolean; standalone?: boolean;
}) {
  const supported = getExerciseSupportLevel(exercise) === 'real_ai';
  const [example, setExample] = useState(initialResult || !supported);
  if (!example && supported) return <AIRecording exercise={exercise} standalone={standalone} onClose={onClose} onComplete={() => onComplete('analysis')} onExample={() => setExample(true)} />;
  return <><div className="ai-example-bar"><span>Illustrated example · no video analysis on this screen</span>{supported ? <button className="btn secondary" onClick={() => setExample(false)}>Try real {exercise.name.toLowerCase()} analysis</button> : <span>Real AI analysis currently supports bodyweight squats only.</span>}</div><SampleRecording exercise={exercise} initialResult={initialResult} standalone={standalone} onClose={onClose} onComplete={() => onComplete('sample')} /></>;
}
