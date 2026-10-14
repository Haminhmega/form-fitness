import {useSyncExternalStore} from 'react';
import {Download,Share,Check,RefreshCw} from 'lucide-react';
import {getInstallState,subscribeInstall,applyAppUpdate} from './pwa';
export default function InstallApp({busy=false}:{busy?:boolean}){
  const state=useSyncExternalStore(subscribeInstall,getInstallState);
  const installed=window.matchMedia('(display-mode: standalone)').matches||(navigator as Navigator & {standalone?:boolean}).standalone;
  const local=location.hostname==='localhost'||location.hostname==='127.0.0.1'||location.protocol==='file:';
  return <section className="panel settings-panel install-panel" aria-labelledby="install-title">
    <div className="settings-title"><Download size={21} aria-hidden="true"/><div><p className="eyebrow">READY WHEN YOU ARE</p><h2 id="install-title">{installed?'Form on your Home Screen':'Take Form with you'}</h2></div></div>
    {installed?<p className="install-status"><Check size={18} aria-hidden="true"/>You’re using the installed app.</p>:<><p>Install Form on your iPhone for a dedicated training space.</p><ol><li>Open this app’s HTTPS link in <strong>Safari</strong>.</li><li>Tap <Share size={15} aria-hidden="true"/> <strong>Share</strong>, then <strong>Add to Home Screen</strong>. If needed, find Share in Safari’s menu.</li><li>Keep <strong>Open as Web App</strong> on if shown, then tap <strong>Add</strong>.</li></ol></>}
    {local&&<p className="settings-note">This is a computer preview. Use the published HTTPS link on your iPhone to install.</p>}
    <p className="settings-note" role="status">{state.ready?'Ready for offline workout logging.':state.unavailable?'Offline setup is unavailable in this browser. You can keep using Form while online.':import.meta.env.PROD&&!local?'Preparing offline workout logging…':'Offline setup runs in the published app.'}</p>
    <p className="settings-note">Open online once before going offline. AI analysis needs its model files downloaded first and a compatible browser. Clips are never cached. Signed-in profiles and completed workouts sync when online. Active sessions and unsynced changes stay on this device; clearing site data can erase them.</p>
    {state.update&&<div className="install-update"><p>A new version is ready.{busy?' Finish your workout and sync changes before updating.':' Reload when you’re ready to use it.'}</p><button className="btn secondary" disabled={busy} onClick={applyAppUpdate}><RefreshCw size={16} aria-hidden="true"/>Update and reload</button></div>}
  </section>
}
