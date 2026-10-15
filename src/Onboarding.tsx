import {useEffect,useRef,useState} from 'react';
import {ArrowRight,ArrowLeft,X} from 'lucide-react';
import type {Preferences} from './types';
import {getCoaching} from '../shared/coaching';
import CoachingIntake,{coachingSteps,coachingStepError} from './CoachingIntake';

export default function Onboarding({preferences,onSave,onClose}:{preferences:Preferences;onSave:(preferences:Preferences)=>void;onClose:()=>void}){
  const [step,setStep]=useState(0);
  const [draft,setDraft]=useState<Preferences>(()=>({...preferences,coaching:getCoaching(preferences)}));
  const [error,setError]=useState('');
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{dialog.current?.showModal()},[]);
  function next(){
    const problem=coachingStepError(step,draft);
    if(problem){setError(problem);return}
    setError('');
    if(step===coachingSteps.length-1)onSave({...draft,onboarded:true,firstTime:true});
    else{setStep(step+1);dialog.current?.scrollTo(0,0)}
  }
  return <dialog ref={dialog} className="dialog onboarding-dialog coaching-dialog" aria-label="Your personal training plan" onCancel={onClose}>
    <div className="dialog-heading"><span className="eyebrow">A PLAN THAT FEELS LIKE YOU</span><button type="button" className="icon-button" aria-label="Close training preferences" onClick={onClose}><X size={20}/></button></div>
    <p className="coach-step-indicator">TRAINING PREFERENCES · {step+1} OF {coachingSteps.length}</p>
    <div className="onboarding-progress" aria-hidden="true">{coachingSteps.map((_,index)=><span key={index} className={index<=step?'filled':''}/>)}</div>
    <CoachingIntake step={step} preferences={draft} onChange={value=>{setDraft(value);setError('')}}/>
    {error&&<p className="coach-dialog-error" role="alert">{error}</p>}
    <div className="dialog-actions"><button type="button" className="btn ghost" onClick={()=>{setError('');if(step){setStep(step-1);dialog.current?.scrollTo(0,0)}else onClose()}}>{step?<><ArrowLeft size={16}/>Back</>:'Skip for now'}</button><button type="button" className="btn primary" onClick={next}>{step===coachingSteps.length-1?'Use my plan':step===coachingSteps.length-2?'Preview my plan':'Continue'}<ArrowRight size={17}/></button></div>
  </dialog>;
}
