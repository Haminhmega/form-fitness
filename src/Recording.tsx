import { useState } from 'react';
import type { Exercise } from './types';
import SampleRecording from './SampleRecording';
import AIRecording from './AIRecording';
import './ai-recording.css';

export default function Recording({ exercise, onClose, onComplete, initialResult = false, standalone = false }: {
  exercise: Exercise; onClose: () => void; onComplete: (kind?: 'sample' | 'analysis') => void; initialResult?: boolean; standalone?: boolean;
}) {
  const supported = exercise.id === 'squat' && exercise.equipment === 'Bodyweight';
  const [example, setExample] = useState(initialResult || !supported);
  if (!example && supported) return <AIRecording standalone={standalone} onClose={onClose} onComplete={() => onComplete('analysis')} onExample={() => setExample(true)} />;
  return <><div className="ai-example-bar"><span>Illustrated example · no video analysis on this screen</span>{supported ? <button className="btn secondary" onClick={() => setExample(false)}>Try real squat analysis</button> : <span>The real AI test currently supports bodyweight squats.</span>}</div><SampleRecording exercise={exercise} initialResult={initialResult} standalone={standalone} onClose={onClose} onComplete={() => onComplete('sample')} /></>;
}
