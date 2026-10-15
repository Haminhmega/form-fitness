export type InstallState = {ready:boolean; update:boolean; unavailable:boolean};
let state:InstallState={ready:false,update:false,unavailable:false};
let registration:ServiceWorkerRegistration|undefined;
let started=false;
let reloading=false;
const listeners=new Set<()=>void>();
export const getInstallState=()=>state;
export const subscribeInstall=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener)}};
function publish(change:Partial<InstallState>){state={...state,...change};listeners.forEach(listener=>listener())}
export async function startOfflineApp(){
  if(started||!import.meta.env.PROD||location.protocol==='file:')return;
  started=true;
  if(!('serviceWorker' in navigator)||!window.isSecureContext){publish({unavailable:true});return}
  try {
    registration=await navigator.serviceWorker.register(new URL('./sw.js',location.href),{scope:'./',updateViaCache:'none'});
    const check=()=>publish({update:!!registration?.waiting});
    check();
    const watchInstall=()=>{
      const worker=registration?.installing;
      worker?.addEventListener('statechange',()=>{check();if(worker.state==='redundant'&&!registration?.active)publish({unavailable:true})});
    };
    watchInstall();
    registration.addEventListener('updatefound',watchInstall);
    // Installed apps can stay open for days; check again when returning to Form.
    let lastUpdateCheck=Date.now();
    const checkForUpdate=()=>{if(document.visibilityState==='visible'&&navigator.onLine&&Date.now()-lastUpdateCheck>60000){lastUpdateCheck=Date.now();void registration?.update().catch(()=>{})}};
    document.addEventListener('visibilitychange',checkForUpdate);
    window.addEventListener('online',checkForUpdate);
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)location.reload();else publish({ready:true,update:!!registration?.waiting})});
    await navigator.serviceWorker.ready;
    publish({ready:true});
    // Installation can be blocked by storage limits even after registration.
  }catch{publish({unavailable:true})}
}
export function applyAppUpdate(){
  if(!registration?.waiting)return;
  reloading=true;
  registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});
}
