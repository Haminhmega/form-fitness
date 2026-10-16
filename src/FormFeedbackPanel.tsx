import {ArrowRight,Focus,ScanLine} from 'lucide-react';
import type {FormFeedback,FormFeedbackCard} from './ai/form-feedback';
import './form-feedback.css';

const timestamp=(seconds:number)=>{const tenths=Math.round(seconds*10);return `${Math.floor(tenths/600)}:${(Math.floor(tenths/10)%60).toString().padStart(2,'0')}.${tenths%10}`;};

export function FormFeedbackPanel({feedback,onReview}:{feedback:FormFeedback;onReview:(time:number,repIndex?:number,card?:FormFeedbackCard)=>void}){
  const adjustment=feedback.cards.some(card=>card.kind==='technique');
  return <section className="form-feedback" aria-labelledby="form-feedback-heading">
    <div className="form-feedback-heading"><span className="form-feedback-icon">{feedback.status==='retake'?<Focus size={23}/>:<ScanLine size={23}/>}</span><div><p className="eyebrow">AI COACHING ASSESSMENT</p><h3 id="form-feedback-heading">{feedback.status==='retake'?'I need a clearer view.':adjustment?'Adjustment recommended.':feedback.positive?'Nice work—no issues detected.':feedback.cards.some(card=>card.kind==='consistency')?'A pattern to improve.':'Here’s what I could assess.'}</h3></div></div>
    <p className="form-feedback-summary">{feedback.summary}</p>
    <div className="form-feedback-cards">{feedback.cards.map((card,index)=><article className={`form-feedback-card feedback-${card.kind}`} key={card.id}>
      <div className="form-feedback-card-label"><span>{String(index+1).padStart(2,'0')}</span><strong>{card.kind==='capture'?'CAMERA ADJUSTMENT':card.kind==='practice'?feedback.positive?'WHAT LOOKED CONSISTENT':'GENERAL PRACTICE CUE':card.kind==='consistency'?'WITHIN-SET PATTERN':'TECHNIQUE TO ADJUST'}</strong></div>
      <h4>{card.title}</h4><p className="feedback-observed">{card.observed}</p>
      {card.phase&&<span className="feedback-phase">{({setup:'Setup',eccentric:'Lowering phase',bottom:'Bottom / turnaround',concentric:'Lifting phase',hold:'Hold'})[card.phase]}</span>}
      {card.cue&&<div className="feedback-cue"><strong>Your focus cue</strong><p>{card.cue}</p></div>}
      <div className="feedback-action"><span>{card.kind==='capture'?'Before filming again':'Try on your next set'}</span><p>{card.action}</p></div>
      {card.steps&&<ol className="feedback-steps" aria-label="Practice steps">{card.steps.map(step=><li key={step}>{step}</li>)}</ol>}
      {card.experiment&&<details className="feedback-why"><summary>Another setup to try</summary><p>{card.experiment}</p></details>}
      <details className="feedback-why"><summary>Why this may help</summary>{card.biomechanics&&<p>{card.biomechanics}</p>}<p>{card.why}</p></details>
      {card.time!==undefined&&<button className="btn secondary feedback-review" onClick={()=>onReview(card.time!,card.repIndexes[0],card)}><Focus size={16}/>Review moment at {timestamp(card.time)}<ArrowRight size={16}/></button>}
    </article>)}</div>
    <section className="feedback-assessment" aria-label="What was assessed">
      <h4>What I could assess</h4>
      {feedback.coverage&&<p>{feedback.coverage.percent}% usable tracking · {feedback.coverage.holdSeconds!==undefined?`${feedback.coverage.holdSeconds.toFixed(1)} seconds of continuous hold`:feedback.coverage.attempts?`${feedback.coverage.attempts} movement attempt${feedback.coverage.attempts===1?'':'s'} reviewed · ${feedback.coverage.reps} full reps counted`:`${feedback.coverage.reps} complete comparable reps`}</p>}
      <p>“No finding” applies only to the named check and visible footage. It is not a form pass.</p>
      <ul>{feedback.checks.map(check=><li key={check.id} className={`assessment-${check.status}`}><div><strong>{check.label}</strong><span>{({finding:'Observed finding',not_detected:'No finding in checked footage',unable:'Could not assess',unsupported:'Not supported yet'})[check.status]}</span></div><p>{check.detail}</p></li>)}</ul>
      <p><strong>Cannot assess from this video:</strong> spinal curvature, muscle activation, exact load or grip, pain, injury risk, or whether the exercise is safe for you.</p>
    </section>
    <details className="feedback-limits"><summary>What this video can and can’t tell us</summary><ul>{feedback.limitations.map((limitation,index)=><li key={index}>{limitation}</li>)}</ul><p>Suggestions combine visible movement estimates with exercise teaching cues. They are experimental, not a form grade or a safety clearance.</p><a href="https://www.acefitness.org/resources/everyone/exercise-library/" target="_blank" rel="noopener noreferrer">Exercise teaching reference ↗</a><a href="https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker" target="_blank" rel="noopener noreferrer">How pose tracking works ↗</a></details>
  </section>;
}
