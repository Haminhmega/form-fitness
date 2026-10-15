const legacyKey='form-workout-recovery-v1';
type Timers={sessionId:string;restUntil:number;warmupUntil:number};
const ownerPrefix=(ownerId:string)=>legacyKey+':'+encodeURIComponent(ownerId)+':';
const keyFor=(sessionId:string,ownerId:string)=>ownerPrefix(ownerId)+encodeURIComponent(sessionId);
const valid=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)&&value>Date.now()?value:0;
function savedSessionId(ownerId:string):string|null{
  try{
    const key=ownerId==='guest'?'form-session-v1':`form-user:${ownerId}:form-session-v1`;
    const saved=JSON.parse(localStorage.getItem(key)||'null');
    return typeof saved?.id==='string'?saved.id:null;
  }catch{return null}
}
function savedTimers(key:string):Timers|null{
  try{const saved=JSON.parse(localStorage.getItem(key)||'null');return typeof saved?.sessionId==='string'?saved:null}catch{return null}
}
function removeLegacySessionTimers(){
  for(const key of ['form-rest','form-warmup'])try{sessionStorage.removeItem(key)}catch{}
}
export function readWorkoutTimers(sessionId:string,ownerId='guest'):Timers{
  const empty={sessionId,restUntil:0,warmupUntil:0};
  const current=savedTimers(keyFor(sessionId,ownerId));
  if(current?.sessionId===sessionId)return {sessionId,restUntil:valid(current.restUntil),warmupUntil:valid(current.warmupUntil)};
  // The first durable timer format stored one session globally. Its session UUID
  // must match before importing it into the current owner's namespace.
  const legacy=savedTimers(legacyKey);
  if(legacy?.sessionId===sessionId){
    const migrated={sessionId,restUntil:valid(legacy.restUntil),warmupUntil:valid(legacy.warmupUntil)};
    if(saveWorkoutTimers(migrated,ownerId))try{localStorage.removeItem(legacyKey)}catch{}
    return migrated;
  }
  // Older tab timers have no owner. Only adopt them when the selected owner's
  // persisted active workout proves that this is the same session.
  if(savedSessionId(ownerId)!==sessionId)return empty;
  let restUntil=0,warmupUntil=0;
  try{restUntil=valid(Number(sessionStorage.getItem('form-rest')))}catch{}
  try{warmupUntil=valid(Number(sessionStorage.getItem('form-warmup')))}catch{}
  const migrated={sessionId,restUntil,warmupUntil};
  if(saveWorkoutTimers(migrated,ownerId))removeLegacySessionTimers();
  return migrated;
}
export function saveWorkoutTimers(timers:Timers,ownerId='guest'){
  try{localStorage.setItem(keyFor(timers.sessionId,ownerId),JSON.stringify(timers));return true}catch{return false}
}
export function clearWorkoutTimers(sessionId?:string,ownerId='guest'){
  const activeId=savedSessionId(ownerId),targetId=sessionId||activeId;
  if(sessionId){try{localStorage.removeItem(keyFor(sessionId,ownerId))}catch{}}
  else{
    let keys:string[]=[];
    try{keys=Object.keys(localStorage).filter(key=>key.startsWith(ownerPrefix(ownerId)))}catch{}
    for(const key of keys)try{localStorage.removeItem(key)}catch{}
  }
  if(targetId&&savedTimers(legacyKey)?.sessionId===targetId)try{localStorage.removeItem(legacyKey)}catch{}
  if(activeId&&(!sessionId||sessionId===activeId))removeLegacySessionTimers();
}
