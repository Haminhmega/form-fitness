import {useEffect,useRef,useState} from 'react';
import {House,Dumbbell,ChartNoAxesCombined,UserRound,ArrowUpRight,ArrowRight,Flame,Check,X,WifiOff,ShieldCheck,Play} from 'lucide-react';
import {useAccount} from './Account';
import type {AccountDocument} from '../shared/account';
import StrengthCheck from './StrengthCheck';
import {strengthCheckId} from './strength-check';
import Today from './Today';import Workout from './Workout';import Train from './Train';import Recording from './Recording';import Progress from './Progress';import Profile from './Profile';import Onboarding from './Onboarding';
import {initialExercises,initialRoutines,initialPreferences,initialHistory} from './data';
import {type Exercise,type Routine,type Session,type Preferences} from './types';
import {createHistoryEntry,createWorkoutSession,selectNextRoutine} from './domain/workout';
import {getExerciseSupportLevel} from './ai/registry';
import {buildRecommendedRoutine,recommendationSummary} from './training-recommendations';
type View='Today'|'Train'|'Progress'|'Profile'|'Workout'|'Recording';
type RecordingRouteState={exerciseId?:string;resultOnly?:boolean;recordChoice?:boolean};
const views:View[]=['Today','Train','Progress','Profile','Workout','Recording'];
const linkedView=():View|null=>window.location.hash==='#form-test'?'Recording':null;
const stateView=(value:unknown):View|undefined=>typeof value==='string'&&views.includes(value as View)?value as View:undefined;
const routeView=(state:unknown=window.history.state):View=>linkedView()||stateView((state as {formView?:unknown}|null)?.formView)||'Today';
const recordingExercise=(exercises:Exercise[],id?:string)=>{
 const requested=exercises.find(exercise=>exercise.id===id);
 if(requested&&getExerciseSupportLevel(requested)!=='logging_only')return requested;
 return exercises.find(exercise=>getExerciseSupportLevel(exercise)==='real_ai')||exercises.find(exercise=>getExerciseSupportLevel(exercise)==='illustrative_only')||exercises[0]||initialExercises[0];
};
function useStored<T>(key:string,fallback:T,persist=true){const account=useAccount();key=account.user?'form-user:'+account.user.id+':'+key:key;const [value,setValue]=useState<T>(()=>{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}});useEffect(()=>{if(!persist)return;try{localStorage.setItem(key,JSON.stringify(value))}catch{/* In-memory use still works if browser storage is unavailable. */}},[key,value,persist]);return [value,setValue] as const}
function useTraining<K extends keyof AccountDocument['training']>(field:K,key:string,fallback:AccountDocument['training'][K]){const account=useAccount();const [local,setLocal]=useStored(key,fallback,!account.document);return [account.document?account.document.training[field]:local,(value:AccountDocument['training'][K])=>account.document?account.editTraining(field,value):setLocal(value)] as const}
export default function App(){
 const account=useAccount();
 const [view,setView]=useState<View>(()=>routeView());
 const [routines,setRoutines]=useTraining('routines','form-routines-v1',initialRoutines);
 const [exercises,setExercises]=useTraining('exercises','form-exercises-v1',initialExercises);
 const [preferences,setPreferences]=useTraining('preferences','form-preferences-v1',initialPreferences);
 const [history,setHistory]=useTraining('history','form-history-v1',initialHistory);
 const [session,setSession]=useStored<Session|null>('form-session-v1',null);
 const [todayRoutineId,setTodayRoutineId]=useState('');
 const initialRecordingState=(window.history.state||{}) as RecordingRouteState;
 const sessionRef=useRef(session);const exercisesRef=useRef(exercises);const historyRef=useRef(history);
 const [recordExercise,setRecordExercise]=useState(()=>recordingExercise(exercises,initialRecordingState.exerciseId));
 const [resultOnly,setResultOnly]=useState(()=>initialRecordingState.resultOnly===true);
 const [recordChoice,setRecordChoice]=useState(()=>initialRecordingState.recordChoice??window.location.hash==='#form-test');
 const [onboarding,setOnboarding]=useState(false);const [notification,setNotification]=useState<{message:string;undo?:()=>void}|null>(null);const [online,setOnline]=useState(navigator.onLine);const [pendingRoutine,setPendingRoutine]=useState<Routine|null>(null);const switchDialog=useRef<HTMLDialogElement>(null);const main=useRef<HTMLElement>(null);const toastTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 function toast(message:string,undo?:()=>void){setNotification({message,undo});if(toastTimer.current)clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setNotification(null),undo?10000:6000)}
 function navigate(next:View,replace=false,recording:RecordingRouteState={}){if(next===view)return;const target=next==='Recording'?'#form-test':window.location.pathname+window.location.search;window.history[replace?'replaceState':'pushState']({...window.history.state,formView:next,...recording},'',target);setView(next);window.scrollTo({top:0});setTimeout(()=>main.current?.focus(),0)}
 useEffect(()=>{const handler=()=>setOnline(navigator.onLine);window.addEventListener('online',handler);window.addEventListener('offline',handler);return()=>{window.removeEventListener('online',handler);window.removeEventListener('offline',handler)}},[]);
 useEffect(()=>{const missing=initialExercises.filter(core=>!exercises.some(exercise=>exercise.id===core.id));if(missing.length)setExercises([...exercises,...missing])},[exercises]);
 useEffect(()=>{if(!preferences.onboarded)setOnboarding(true)},[preferences.onboarded]);
 useEffect(()=>{if(!session)return;const handler=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='Your active workout is saved locally.'};window.addEventListener('beforeunload',handler);return()=>window.removeEventListener('beforeunload',handler)},[session]);
 useEffect(()=>{if(pendingRoutine)switchDialog.current?.showModal();else switchDialog.current?.close()},[pendingRoutine]);
 useEffect(()=>{sessionRef.current=session},[session]);
 useEffect(()=>{exercisesRef.current=exercises},[exercises]);
 useEffect(()=>{historyRef.current=history},[history]);
 useEffect(()=>{window.history.replaceState({...window.history.state,formView:view},'',window.location.href);const restore=(state:unknown,hashNavigation=false)=>{let next=linkedView()||(hashNavigation?'Today':stateView((state as {formView?:unknown}|null)?.formView))||'Today';if(next==='Workout'&&!sessionRef.current)next='Today';setView(next);if(next==='Recording'){const recording=(state||window.history.state||{}) as RecordingRouteState;setRecordExercise(recordingExercise(exercisesRef.current,recording.exerciseId));setResultOnly(recording.resultOnly===true);setRecordChoice(recording.recordChoice??true)}window.scrollTo({top:0});setTimeout(()=>main.current?.focus(),0)};const onPopState=(event:PopStateEvent)=>restore(event.state);const onHashChange=()=>restore(window.history.state,true);window.addEventListener('popstate',onPopState);window.addEventListener('hashchange',onHashChange);return()=>{window.removeEventListener('popstate',onPopState);window.removeEventListener('hashchange',onHashChange)}},[]);
 const visibleHistory=preferences.firstTime?history.filter(h=>!h.sample):history;
 const recommendationExercises=[...exercises,...initialExercises.filter(core=>!exercises.some(exercise=>exercise.id===core.id))];
 const recommendedRoutine=buildRecommendedRoutine(preferences,recommendationExercises);
 const nextRoutine=selectNextRoutine(routines,visibleHistory);
 const todayRoutine=routines.find(routine=>routine.id===todayRoutineId)||nextRoutine;
 function start(r:Routine){if(!r.exercises.length){toast('Add an exercise before starting this routine.');navigate('Train');return}if(session){if(session.routineId===r.id)navigate('Workout');else setPendingRoutine(r);return}begin(r)}
 function begin(r:Routine){setSession(createWorkoutSession(r,recommendationExercises,r.id===strengthCheckId?[]:visibleHistory));sessionStorage.removeItem('form-rest');sessionStorage.removeItem('form-warmup');navigate('Workout')}
 function useRecommendation(nextPreferences=preferences){const suggested=buildRecommendedRoutine(nextPreferences,recommendationExercises);setRoutines([suggested,...routines.filter(routine=>routine.id!==suggested.id)]);setTodayRoutineId(suggested.id);return suggested}
 function record(e?:Exercise,results=false){const target=e||recordingExercise(exercises);const choice=!e;setRecordChoice(choice);setRecordExercise(target);setResultOnly(results);navigate('Recording',false,{exerciseId:target.id,resultOnly:results,recordChoice:choice})}
 function finish(){if(!session)return;const entry=createHistoryEntry(session,exercises);setHistory([entry,...history]);setTodayRoutineId('');setSession(null);navigate('Progress',true);toast('Workout saved. That’s a little more you.')}
 function updateHistoryEntry(entry:typeof history[number]){const next=history.map(current=>current.id===entry.id?entry:current);historyRef.current=next;setHistory(next);toast('Workout corrections saved.')}
 function deleteHistoryEntry(id:string){const index=history.findIndex(current=>current.id===id);const entry=history[index];if(!entry)return;const next=history.filter(current=>current.id!==id);historyRef.current=next;setHistory(next);toast('Workout deleted.',()=>{const current=historyRef.current;if(current.some(candidate=>candidate.id===id))return;const restored=[...current];restored.splice(Math.min(index,restored.length),0,entry);historyRef.current=restored;setHistory(restored)})}
 const nav=[{name:'Today' as const,icon:House},{name:'Train' as const,icon:Dumbbell},{name:'Progress' as const,icon:ChartNoAxesCombined},{name:'Profile' as const,icon:UserRound}];
 return <><a href="#main" className="skip-link">Skip to content</a><aside className="app-sidebar"><button className="brand" onClick={()=>navigate('Today')} aria-label="Form home"><span className="brand-mark"><i/><i/></span><span>form<span className="brand-period">.</span></span></button><span className="sidebar-label">YOUR SPACE</span><nav aria-label="Primary navigation">{nav.map(n=><button key={n.name} className={'nav-link '+(view===n.name||(view==='Workout'&&n.name==='Train')?'active':'')} aria-current={view===n.name?'page':undefined} onClick={()=>navigate(n.name)}><n.icon size={20}/><span>{n.name}</span>{view===n.name&&<span className="nav-indicator"/>}</button>)}</nav><div className="sidebar-bottom"><div className="sidebar-motto"><span className="tiny-square"/><p>Better movement.<br/><span>A little, every day.</span></p></div><button className="sidebar-account" onClick={()=>navigate('Profile')}><span className="avatar">{account.document?.profile.name.slice(0,2).toUpperCase()||'F'}</span><span><strong>{account.document?.profile.name||'Local demo'}</strong><small>{account.document?'Your account':'Personal space · demo'}</small></span><ArrowUpRight size={16}/></button></div></aside>
 <div className="app-body"><header className="topbar"><span className="breadcrumb" data-account={account.document?'Your account':'Local demo'}>Your space <span>/</span> <strong>{view==='Recording'?'Check my form':view==='Workout'?'Active workout':view}</strong></span><div className="topbar-right"><span className="prototype-label">INTERACTIVE PROTOTYPE</span><span className="topbar-divider"/><span className="local-label"><ShieldCheck size={15}/>{account.document?account.dirty?'Waiting to sync':'Your account':'Local demo'}</span><button className="mobile-brand" onClick={()=>navigate('Today')} aria-label="Form home">form.</button></div></header>{!online&&<div className="offline-banner"><WifiOff size={17}/>You’re offline. Keep logging in this browser.</div>}
 <main id="main" ref={main} tabIndex={-1} className={session&&view!=='Workout'?'has-active-session':''}>
 {view==='Today'&&<Today weeklyGoal={preferences.days.length} name={account.document?.profile.name} routine={todayRoutine} routines={routines} exercises={recommendationExercises} session={session} history={visibleHistory} firstTime={preferences.firstTime} recommendation={recommendedRoutine} recommendationSummary={recommendationSummary(preferences)} onUseRecommendation={()=>{const suggested=useRecommendation();toast(`${suggested.name} is ready. You can edit every exercise.`)}} onStart={()=>session?navigate('Workout'):todayRoutine?start(todayRoutine):navigate('Train')} onSelectRoutine={setTodayRoutineId} onTrain={()=>navigate('Train')} onRecord={()=>record()} onFeedback={()=>record(exercises.find(exercise=>exercise.id==='squat')||exercises[0],true)} onOnboarding={()=>setOnboarding(true)}/>}
 {view==='Today'&&preferences.experience==='Getting started'&&<StrengthCheck preferences={preferences} history={visibleHistory} onStart={start}/>}
 {view==='Train'&&<Train routines={routines} setRoutines={setRoutines} exercises={recommendationExercises} setExercises={setExercises} preferences={preferences} onStart={start} onRecord={record} toast={toast}/>}
 {view==='Workout'&&session&&<Workout session={session} setSession={setSession} exercises={recommendationExercises} preferences={preferences} history={visibleHistory} onRecord={record} onFinish={finish} onBack={()=>navigate('Today')} toast={toast}/>}
 {view==='Recording'&&recordChoice&&<label className='field standalone-movement'>Movement experience<select aria-label='Movement experience' value={recordExercise.id} onChange={event=>{const selected=exercises.find(exercise=>exercise.id===event.target.value);if(!selected)return;setRecordExercise(selected);setResultOnly(false);window.history.replaceState({...window.history.state,formView:'Recording',exerciseId:selected.id,resultOnly:false,recordChoice},'','#form-test')}}>{exercises.filter(exercise=>getExerciseSupportLevel(exercise)!=='logging_only').map(exercise=><option key={exercise.id} value={exercise.id}>{exercise.name} · {getExerciseSupportLevel(exercise)==='real_ai'?'tested motion':getExerciseSupportLevel(exercise)==='experimental_ai'?'beta motion':'illustration'}</option>)}</select></label>}{view==='Recording'&&<Recording key={`${recordExercise.id}-${resultOnly}`} exercise={recordExercise} initialResult={resultOnly} standalone={!session} onClose={()=>navigate(session?'Workout':'Today')} onComplete={kind=>{if(kind==='analysis'){if(session)setSession({...session,feedback:true,feedbackExerciseId:recordExercise.id,feedbackKind:'analysis'});toast('Local AI check completed. Video and detailed results were cleared.')}else toast('Illustrated sample reviewed. No video was analyzed.');navigate(session?'Workout':'Today')}}/>}
 {view==='Progress'&&<Progress history={visibleHistory} exercises={exercises} units={preferences.units} onFeedback={(id,resultOnly=true)=>record(exercises.find(e=>e.id===(id||'squat'))||exercises[0],resultOnly)} onUpdateHistory={updateHistoryEntry} onDeleteHistory={deleteHistoryEntry} toast={toast}/>}
 {view==='Profile'&&<Profile workoutActive={!!session} preferences={preferences} setPreferences={setPreferences} onOnboarding={()=>setOnboarding(true)} toast={toast}/>}
 <footer className="page-footer"><span className="footer-wordmark">form.</span><span>Built around your next rep.</span><span>Sample training data · Local motion tracking</span></footer></main>
 </div><nav className="mobile-nav" aria-label="Mobile navigation">{nav.map(n=><button key={n.name} className={view===n.name?'active':''} aria-current={view===n.name?'page':undefined} onClick={()=>navigate(n.name)}><n.icon size={20}/><span>{n.name}</span></button>)}</nav>
 {session&&view!=='Workout'&&<div className="resume-bar"><span className="pulse-dot"/><span><strong>{session.name}</strong><small>{Object.values(session.logs).flat().filter(s=>s.done).length} sets completed · saved locally</small></span><button className="btn primary" onClick={()=>navigate('Workout')}><Play size={15} fill="currentColor"/>Resume</button></div>}
 {notification&&<div className={view==='Workout'?'toast workout-toast':'toast'} role="status"><Check size={19}/><span>{notification.message}</span>{notification.undo&&<button className="btn ghost" onClick={()=>{notification.undo?.();setNotification(null)}}>Undo</button>}<button className="icon-button" aria-label="Dismiss notification" onClick={()=>setNotification(null)}><X size={17}/></button></div>}
 {onboarding&&<Onboarding preferences={preferences} onClose={()=>setOnboarding(false)} onSave={p=>{setPreferences(p);const suggested=useRecommendation(p);setOnboarding(false);navigate('Today');toast(`${suggested.name} is ready. Make it your own anytime.`)}}/>}
 <dialog ref={switchDialog} className="dialog" onCancel={()=>setPendingRoutine(null)}><div className="dialog-heading"><h2>You have a workout in progress.</h2><button className="icon-button" aria-label="Cancel switching routine" onClick={()=>setPendingRoutine(null)}><X/></button></div><p className="muted">Resume {session?.name} to keep your completed sets. Starting a new routine replaces the active session.</p><div className="dialog-actions"><button className="btn secondary" onClick={()=>{setPendingRoutine(null);navigate('Workout')}}>Resume workout</button><button className="btn danger" onClick={()=>{if(pendingRoutine)begin(pendingRoutine);setPendingRoutine(null)}}>Replace session<ArrowRight size={17}/></button></div></dialog>
 </>
}






