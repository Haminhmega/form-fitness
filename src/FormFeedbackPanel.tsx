import {ArrowRight,Focus,ScanLine} from 'lucide-react';
import type {FormFeedback} from './ai/form-feedback';
import './form-feedback.css';

const timestamp=(seconds:number)=>`${Math.floor(seconds/60)}:${Math.floor(seconds%60).toString().padStart(2,'0')}`;

export function FormFeedbackPanel({feedback,onReview}:{feedback:FormFeedback;onReview:(time:number,repIndex?:number)=>void}){
  return <section className="form-feedback" aria-labelledby="form-feedback-heading">
    <div className="form-feedback-heading"><span className="form-feedback-icon">{feedback.status==='retake'?<Focus size={23}/>:<ScanLine size={23}/>}</span><div><p className="eyebrow">YOUR NEXT STEP</p><h3 id="form-feedback-heading">{feedback.status==='retake'?'Get a clearer view.':'Make your next set count.'}</h3></div></div>
    <p className="form-feedback-summary">{feedback.summary}</p>
    <div className="form-feedback-cards">{feedback.cards.map((card,index)=><article className={`form-feedback-card feedback-${card.kind}`} key={card.id}>
      <div className="form-feedback-card-label"><span>{String(index+1).padStart(2,'0')}</span><strong>{card.kind==='capture'?'CAMERA ADJUSTMENT':card.kind==='practice'?'GENERAL PRACTICE CUE':card.kind==='consistency'?'WITHIN-SET PATTERN':'CLIP-BASED SUGGESTION'}</strong></div>
      <h4>{card.title}</h4><p className="feedback-observed">{card.observed}</p>
      <div className="feedback-action"><span>{card.kind==='capture'?'Before filming again':'Try on your next set'}</span><p>{card.action}</p></div>
      <details className="feedback-why"><summary>Why this may help</summary><p>{card.why}</p></details>
      {card.time!==undefined&&<button className="btn secondary feedback-review" onClick={()=>onReview(card.time!,card.repIndexes[0])}><Focus size={16}/>Review frame at {timestamp(card.time)}<ArrowRight size={16}/></button>}
    </article>)}</div>
    <details className="feedback-limits"><summary>What this video can and can’t tell us</summary><ul>{feedback.limitations.map((limitation,index)=><li key={index}>{limitation}</li>)}</ul><p>Suggestions combine visible movement estimates with exercise teaching cues. They are experimental, not a form grade or a safety clearance.</p><a href="https://www.acefitness.org/resources/everyone/exercise-library/" target="_blank" rel="noopener noreferrer">Exercise teaching reference ↗</a><a href="https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker" target="_blank" rel="noopener noreferrer">How pose tracking works ↗</a></details>
  </section>;
}
