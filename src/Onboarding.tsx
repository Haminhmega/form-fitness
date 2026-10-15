import {useEffect,useRef,useState} from 'react';
import {ArrowRight,ArrowLeft,Check,X,Sparkles} from 'lucide-react';
import type {Preferences} from './types';
import {equipmentOptions,experienceLevels,trainingDays,trainingGoals} from './data';
const goalDetails:Record<string,string>={
 'Learn the basics':'Technique-first sessions with controlled, higher-rep practice.',
 'Grow glutes':'Prioritize glute bridges, hinges, lunges, and hip abduction.',
 'Build muscle':'Balanced muscle-building work across the major muscle groups.',
 'Build strength':'Lower rep targets with more recovery between working sets.',
 'Build upper body':'More pushing, pulling, shoulder, and arm work.',
 'Build consistency':'Manageable full-body sessions that are easy to repeat.',
 'Improve fitness':'Steady full-body work with moderate recovery.',
 'Manage weight':'Repeatable strength and conditioning sessions at a steady pace.',
};
export default function Onboarding({preferences,onSave,onClose}:{preferences:Preferences;onSave:(p:Preferences)=>void;onClose:()=>void}){
 const [step,setStep]=useState(0);const [draft,setDraft]=useState(preferences);const dialog=useRef<HTMLDialogElement>(null);useEffect(()=>{dialog.current?.showModal()},[]);
 const titles=['What brings you here?','Where are you starting?','What do you train with?','Make room for yourself.','Your numbers. Your units.'];
 const descriptions=['Choose what you want your exercise suggestions, reps, and rest times to support.','Your experience changes set volume, rep targets, and technique guidance.','We’ll only suggest equipment you can use. Bodyweight is always available.','Choose the days that usually fit. These are preferences, not a streak to protect.','Loads can be displayed in kilograms or pounds.'];
 const options:readonly string[]=step===0?trainingGoals:step===1?experienceLevels:step===2?equipmentOptions:step===3?trainingDays:['kg','lb'];
 function selected(o:string){return step===0?draft.goal===o:step===1?draft.experience===o:step===2?draft.equipment.includes(o):step===3?draft.days.includes(o):draft.units===o}
 function choose(o:string){setDraft(p=>step===0?{...p,goal:o}:step===1?{...p,experience:o}:step===2?{...p,equipment:p.equipment.includes(o)?p.equipment.filter(v=>v!==o):[...p.equipment,o]}:step===3?{...p,days:p.days.includes(o)?p.days.filter(v=>v!==o):[...p.days,o]}:{...p,units:o as 'kg'|'lb'})}
 return <dialog ref={dialog} className="dialog onboarding-dialog" onCancel={onClose}><div className="dialog-heading"><span className="eyebrow">A PLAN THAT FEELS LIKE YOU</span><button className="icon-button" aria-label="Skip onboarding" onClick={onClose}><X size={20}/></button></div><div className="onboarding-icon"><Sparkles size={27}/></div><p className="eyebrow">TRAINING PREFERENCES · {step+1} OF 5</p><h2>{titles[step]}</h2><p className="muted">{descriptions[step]}</p><div className={'onboarding-options '+(step===3?'day-options':'')}>{options.map(o=><button key={o} className={'onboarding-choice '+(selected(o)?'chosen':'')} aria-pressed={selected(o)} onClick={()=>choose(o)}><span>{o==='kg'?'Kilograms (kg)':o==='lb'?'Pounds (lb)':o}{step===0&&<small>{goalDetails[o]}</small>}</span>{selected(o)&&<Check size={18}/>}</button>)}</div><div className="onboarding-progress">{titles.map((_,i)=><span key={i} className={i<=step?'filled':''}/>)}</div><div className="dialog-actions"><button className="btn ghost" onClick={()=>step?setStep(step-1):onClose()}>{step?<><ArrowLeft size={16}/>Back</>:'Skip for now'}</button><button className="btn primary" onClick={()=>step===4?onSave({...draft,onboarded:true,firstTime:true}):setStep(step+1)}>{step===4?'Build my plan':'Continue'}<ArrowRight size={17}/></button></div><p className="small muted">Your suggestions are a starting point. You can edit every exercise, set, rep, and rest time.</p></dialog>
}
