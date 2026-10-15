import type {Exercise} from './types';
import {exerciseDescription,exerciseSteps} from './exercise-guide';
import {MuscleMap} from './MuscleMap';
import {ExerciseDemo} from './ExerciseDemo';
import {muscleEmphasis} from './muscle-emphasis';
import './train.css';

/** One source of instruction content for the library and an active session. */
export function ExerciseGuide({exercise}:{exercise:Exercise}) {
  const emphasis=muscleEmphasis(exercise);
  return <div className="exercise-guide">
    <div className="train-guide-copy"><h3>About this movement</h3><p>{exerciseDescription(exercise)}</p>
      <h3>Step by step</h3><ol>{exerciseSteps(exercise).map((step,index)=><li key={step}><span>{index+1}</span><p>{step}</p></li>)}</ol>
    </div>
    <details className="movement-instructions"><summary>See this movement</summary><ExerciseDemo key={exercise.id} exercise={exercise}/></details>
    <details className="movement-instructions"><summary>Target muscles, grip &amp; movement path</summary>
      <div className="train-movement-guide"><MuscleMap exercise={exercise}/><section className="muscle-emphasis"><h3>What this movement emphasizes</h3><p>{emphasis.detail}</p><h3>Grip, angle &amp; movement path</h3><p>{emphasis.variation}</p><small>{emphasis.basis}</small>{emphasis.source&&<a href={emphasis.source} target="_blank" rel="noopener noreferrer">Read the supporting study ↗</a>}</section></div>
    </details>
  </div>;
}
