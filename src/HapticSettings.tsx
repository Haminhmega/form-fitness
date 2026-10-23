import {useState} from 'react';
import {Check} from 'lucide-react';
import {hapticsEnabled, pulseHaptic, setHapticsEnabled, supportsHaptics} from './haptics';

export default function HapticSettings() {
  const [enabled, setEnabled] = useState(hapticsEnabled);
  const [message, setMessage] = useState('');
  const supported = supportsHaptics();
  function change() {
    const next = !enabled;
    if (!setHapticsEnabled(next)) { setMessage('This browser could not save the preference.'); return; }
    setEnabled(next); setMessage('');
    if (next) pulseHaptic();
  }
  return <div className="haptic-settings" data-haptics-settings>
    <div className="profile-setting"><div><h3 id="haptics-label">Touch feedback</h3><p id="haptics-description" className="muted">Short vibrations for key taps and completed sets. Saved on this device only. Reduced Motion silences vibrations.</p></div><button className={`setting-switch ${enabled && supported ? 'is-on' : ''}`} type="button" role="switch" aria-checked={enabled && supported} aria-labelledby="haptics-label" aria-describedby="haptics-description haptics-support" disabled={!supported} onClick={change}><span>{enabled && supported && <Check size={13} aria-hidden="true"/>}</span></button></div>
    <p id="haptics-support" className="settings-note">{supported ? 'Vibration depends on your device and system settings.' : 'Vibration is unavailable in this browser, including iPhone Safari. Buttons still respond visually when pressed.'}</p>
    {supported && enabled && <button className="btn secondary" type="button" onClick={()=>{setMessage(pulseHaptic() ? 'Test requested. Your device settings control whether you feel it.' : 'Vibration is unavailable or silenced by Reduced Motion.')}}>Test touch feedback</button>}
    {message && <p className="settings-note" role="status">{message}</p>}
  </div>;
}
