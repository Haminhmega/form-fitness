import {useEffect,useId,useRef,useState} from 'react';
import {ArrowLeft,X} from 'lucide-react';
import './session-navigation.css';

export default function SessionNavigation({onBack,onCancel,completedSets=0}:{onBack:()=>void;onCancel:()=>void;completedSets?:number}){
  const [open,setOpen]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null);
  const titleId=useId(),descriptionId=useId();
  useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close()},[open]);
  return <div className="session-navigation">
    <button className="btn ghost back-button" onClick={onBack}><ArrowLeft size={17}/>Back to Today</button>
    <button className="btn ghost" onClick={()=>setOpen(true)}><X size={17}/>Cancel session</button>
    <dialog ref={dialog} className="dialog" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={()=>setOpen(false)} onClose={()=>setOpen(false)}>
      <div className="dialog-heading"><h2 id={titleId}>Cancel this session?</h2></div>
      <p id={descriptionId}>Discard this session’s sets, notes and timers. It won’t be saved to history or earn points. Your routine stays available.</p>
      {completedSets>0&&<p className="muted">{completedSets} completed {completedSets===1?'set will':'sets will'} be discarded. Choose “Keep training” if you want to finish and save them instead.</p>}
      <div className="dialog-actions"><button className="btn secondary" autoFocus onClick={()=>setOpen(false)}>Keep training</button><button className="btn danger" onClick={()=>{dialog.current?.close();onCancel()}}>Discard session</button></div>
    </dialog>
  </div>;
}
