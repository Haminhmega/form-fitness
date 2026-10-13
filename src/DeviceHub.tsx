import { useEffect, useRef, useState, type Dispatch, type SetStateAction, type KeyboardEvent } from 'react';
import { Activity, ArrowLeft, ArrowRight, Check, ChevronDown, CircleAlert, Clock3, ExternalLink, HeartPulse, Link2, LoaderCircle, Moon, RefreshCw, Settings2, ShieldCheck, Smartphone, Trash2, Unplug, Watch, X } from 'lucide-react';
import type { DeviceMetric, DeviceProviderId, DeviceScope, DeviceState } from './deviceTypes';
import type { ToastFn } from './types';
import { providers, sampleDates, scopeLabels, connectDemo, syncDemo, updateDeviceScopes, disconnectDemo, deleteDeviceData, setDeviceScenario, selectMetric, getImportedWorkouts } from './devices';
import './devices.css';

type DialogMode = 'connect' | 'manage' | 'disconnect' | 'delete';
type Scenario = 'normal' | 'stale' | 'error' | 'expired' | 'empty';
const scopes: DeviceScope[] = ['activity', 'sleep', 'vitals'];
const scopeCopy: Record<DeviceScope, string> = { activity: 'Steps and imported workout summaries', sleep: 'Sleep duration', vitals: 'Resting heart rate and HRV where available' };
const scopeIcons = { activity: Activity, sleep: Moon, vitals: HeartPulse };
const metricLabels: Record<DeviceMetric, string> = { steps: 'Steps', sleepMinutes: 'Sleep duration', restingHeartRate: 'Resting heart rate', hrv: 'HRV' };
const metrics: DeviceMetric[] = ['steps', 'sleepMinutes', 'restingHeartRate', 'hrv'];
const labelDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const shortTime = (time: number) => new Date(time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
function metricValue(metric: DeviceMetric, value: number) { return metric === 'sleepMinutes' ? `${Math.floor(value / 60)}h ${Math.round(value % 60)}m` : value.toLocaleString('en-US'); }

export default function Devices({ state, setState, onBack, toast }: { state: DeviceState; setState: Dispatch<SetStateAction<DeviceState>>; onBack: () => void; toast: ToastFn }) {
  const [dialog, setDialog] = useState<{ mode: DialogMode; id: DeviceProviderId } | null>(null);
  const [chosenScopes, setChosenScopes] = useState<DeviceScope[]>([]);
  const [removeData, setRemoveData] = useState(true);
  const [busy, setBusy] = useState<DeviceProviderId | null>(null);
  const [selectedDate, setSelectedDate] = useState(sampleDates[sampleDates.length - 1]);
  const [previewProvider, setPreviewProvider] = useState<DeviceProviderId>('fitbit');
  const modal = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const provider = dialog ? providers.find(p => p.id === dialog.id)! : null;
  const connection = dialog ? state.connections[dialog.id] : null;
  const connected = providers.filter(p => state.connections[p.id].status !== 'disconnected').length;
  const availableDays = new Set(Object.values(state.connections).flatMap(c => c.days.map(day => day.date))).size;
  const hasData = availableDays > 0;
  const importedWorkouts = getImportedWorkouts(state, selectedDate);
  const previewConnection = state.connections[previewProvider];
  const previewValue: Scenario = previewConnection.status === 'connected' ? previewConnection.days.length ? 'normal' : 'empty' : previewConnection.status === 'disconnected' ? 'normal' : previewConnection.status;

  useEffect(() => () => { if (pendingTimer.current) clearTimeout(pendingTimer.current); }, []);
  useEffect(() => {
    if (dialog) { if (!modal.current?.open) modal.current?.showModal(); modal.current?.querySelector<HTMLButtonElement>('.dev-dialog-close')?.focus(); }
    else { modal.current?.close(); opener.current?.focus(); }
  }, [dialog]);

  function openDialog(id: DeviceProviderId, mode: DialogMode) {
    if (!dialog) opener.current = document.activeElement as HTMLElement;
    setChosenScopes(mode === 'connect' ? [] : [...state.connections[id].scopes]);
    setRemoveData(true); setDialog({ id, mode });
  }
  function closeDialog() {
    if (pendingTimer.current && busy) { clearTimeout(pendingTimer.current); pendingTimer.current = null; setBusy(null); }
    setDialog(null);
  }
  function containDialogFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      .filter(element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden' && !element.closest('[inert]'));
    const first = controls[0]; const last = controls[controls.length - 1];
    const active = document.activeElement;
    if (!first) { event.preventDefault(); event.currentTarget.focus(); return; }
    // Native Chromium dialogs can send focus to browser chrome at this boundary.
    if (event.shiftKey && (active === first || !controls.includes(active as HTMLElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (active === last || !controls.includes(active as HTMLElement))) { event.preventDefault(); first.focus(); }
  }
  function simulate(id: DeviceProviderId, apply: (previous: DeviceState) => DeviceState, message: string, closesDialog = false) {
    if (busy) return;
    setBusy(id);
    pendingTimer.current = setTimeout(() => { setState(previous => apply(previous)); setBusy(null); pendingTimer.current = null; if (closesDialog) setDialog(null); toast(message); }, 1000);
  }
  function connect() {
    if (!dialog || !chosenScopes.length) return;
    const id = dialog.id; const granted = [...chosenScopes];
    simulate(id, previous => connectDemo(previous, id, granted), `${provider!.shortName} demo connected. Seven days of selected sample data imported.`, true);
  }
  function sync(id: DeviceProviderId) { simulate(id, previous => syncDemo(previous, id), 'Sample data refreshed. Existing dates were updated without adding duplicate days.'); }
  function saveScopes() {
    if (!dialog) return;
    const id = dialog.id; const granted = [...chosenScopes];
    setState(previous => updateDeviceScopes(previous, id, granted)); setDialog(null);
    toast('Demo permissions updated. Removed categories were cleared; sync to import newly enabled categories.');
  }
  function changeScenario(value: Scenario) {
    if (previewConnection.status === 'expired' && value === 'normal') { openDialog(previewProvider, 'connect'); return; }
    setState(previous => setDeviceScenario(previous, previewProvider, value));
  }
  function statusLabel(id: DeviceProviderId) {
    const c = state.connections[id];
    return c.status === 'connected' ? c.days.length ? 'Demo connected' : 'Connected · no sample data' : c.status === 'stale' ? 'Sample data needs a refresh' : c.status === 'error' ? 'Demo sync failed' : c.status === 'expired' ? 'Demo permission expired' : c.days.length ? 'Disconnected · data retained' : 'Not connected';
  }
  function scopeFields() {
    return <fieldset className="dev-scope-fields" disabled={!!busy}><legend>{dialog?.mode === 'connect' ? 'Choose what to import' : 'Your demo permissions'}</legend>{provider!.capabilities.map(scope => {
      const Icon = scopeIcons[scope]; return <label className="dev-scope-choice" key={scope}><span className="dev-scope-icon"><Icon size={20} /></span><span><strong>{scopeLabels[scope]}</strong><small>{scope === 'activity' && provider!.id === 'whoop' ? 'Imported workout summaries · steps are not included' : scopeCopy[scope]}</small></span><input type="checkbox" checked={chosenScopes.includes(scope)} onChange={e => setChosenScopes(previous => e.target.checked ? [...previous, scope] : previous.filter(s => s !== scope))} aria-label={`Allow ${scopeLabels[scope].toLowerCase()} sample data`} /></label>;
    })}</fieldset>;
  }

  return <section className="devices-page" aria-label="Connected devices">
    <button className="dev-back" onClick={onBack}><ArrowLeft size={17} /> Back to Profile</button>
    <div className="dev-page-heading"><div><span className="eyebrow">A LITTLE MORE CONTEXT</span><h1>Your devices.<br className="dev-phone-break" /> One picture.</h1><p>Bring your activity, sleep, and everyday patterns into view.</p></div><span className="dev-demo-badge"><span /> Sample connections only</span></div>
    <div className="dev-intro"><span className="dev-intro-icon"><ShieldCheck size={23} /></span><div><strong>You choose what comes in.</strong><p>Explore with seven days of clearly labeled sample data. No real accounts connect, no health data is read, and nothing is sent to a device service.</p></div><span className="dev-import-range">OCT 7–13, 2026</span></div>
    <div className="dev-section-heading"><h2>Your connections <span>{connected} / {providers.length}</span></h2><p>Connect a demo. Keep what is useful.</p></div>
    <div className="dev-provider-grid">{providers.map(p => {
      const c = state.connections[p.id]; const working = busy === p.id; const active = c.status !== 'disconnected'; const reconnect = c.status === 'expired';
      return <article className={`dev-provider-card ${active ? 'is-connected' : ''} ${['stale', 'error', 'expired'].includes(c.status) ? 'needs-attention' : ''}`} key={p.id} aria-label={`${p.name} connection`}>
        <div className="dev-provider-heading"><span className={`dev-provider-logo provider-${p.id}`} aria-hidden="true">{p.id === 'apple' || p.id === 'healthconnect' ? <Smartphone size={24} /> : <Watch size={24} />}</span><div><h3>{p.name}</h3><span>{p.description}</span></div>{active && <span className="dev-connected-mark" title="Demo connection"><Check size={14} /></span>}</div>
        <div className={`dev-connection-status status-${c.status}`}><span />{statusLabel(p.id)}</div>
        <div className="dev-capabilities">{p.capabilities.map(scope => { const Icon = scopeIcons[scope]; return <span key={scope} className={c.scopes.includes(scope) ? 'granted' : ''}><Icon size={12} />{scopeLabels[scope]}{c.scopes.includes(scope) && <Check size={10} />}</span>; })}</div>
        {c.status === 'stale' && <p className="dev-card-notice">These sample records are marked stale. Refresh before using them as current context.</p>}
        {c.status === 'error' && <p className="dev-card-notice">A simulated sync failed. Your last sample records are still available. Try again when you are ready.</p>}
        {c.status === 'expired' && <p className="dev-card-notice">Choose your permissions again to reconnect this demo. Retained records stay marked as stale.</p>}
        {c.days.length > 0 ? <div className="dev-record-summary"><strong>{c.days.length} sample days imported</strong><span>{c.lastSyncAt ? `Last demo refresh ${shortTime(c.lastSyncAt)} ET` : 'Sample records retained on this device'}</span></div> : <div className="dev-record-summary"><strong>{active ? 'No imported sample data yet' : 'A little context, on your terms.'}</strong><span>{active ? c.scopes.length ? 'Sync to import your selected categories.' : 'Choose categories in Manage data, then sync.' : 'Choose categories before connecting.'}</span></div>}
        <div className="dev-card-actions">{!active || reconnect ? <button className="btn secondary" disabled={!!busy} onClick={() => openDialog(p.id, 'connect')}><Link2 size={16} />{reconnect ? 'Reconnect demo' : 'Connect demo'}<ArrowRight size={15} /></button> : <button className="btn secondary" disabled={!!busy || !c.scopes.length} onClick={() => sync(p.id)}>{working ? <LoaderCircle size={16} className="dev-spin" /> : <RefreshCw size={16} />}{working ? 'Refreshing sample…' : 'Sync sample data'}</button>}{(active || c.days.length > 0) && <button className="dev-manage" onClick={() => openDialog(p.id, 'manage')} disabled={!!busy}><Settings2 size={15} /> Manage data</button>}</div>
        {working && <span className="dev-sync-status" role="status">Simulating a refresh. No service is being contacted.</span>}
      </article>;
    })}</div>

    <div className="dev-data-heading"><div><span className="eyebrow">KEEP THE SOURCE IN SIGHT</span><h2>A small window into your day.</h2><p>{hasData ? `${availableDays} days with sample records · every value keeps its source.` : 'Your selected sample data will appear here.'}</p></div><label className="dev-date-select">Sample date<select value={selectedDate} onChange={e => setSelectedDate(e.target.value)} aria-label="Sample data date">{sampleDates.map(date => <option key={date} value={date}>{labelDate(date)}, 2026</option>)}</select></label></div>
    {!hasData ? <div className="dev-data-empty"><span><Activity size={29} /></span><h3>Start with one connection.</h3><p>Connect a demo device and choose the categories you want to see. You can remove them whenever you like.</p><button className="dev-text-action" onClick={() => openDialog('fitbit', 'connect')}>Try a sample connection <ArrowRight size={15} /></button></div> : <><div className="dev-metric-grid">{metrics.map(metric => {
      const selected = selectMetric(state, metric, selectedDate); const source = selected && providers.find(p => p.id === selected.provider);
      return <div className="dev-metric-card" key={metric}><span className="dev-metric-label">{metricLabels[metric]}</span><strong>{selected ? metricValue(metric, selected.value) : '—'}{selected && <small>{metric === 'steps' ? 'steps' : metric === 'restingHeartRate' ? 'bpm' : metric === 'hrv' ? 'ms' : ''}</small>}</strong><span className="dev-metric-source">{selected ? <><span className="dev-sample-tag">SAMPLE</span>{source?.shortName}</> : 'No sample data for this date'}</span>{selected?.stale && <span className="dev-stale-label"><Clock3 size={12} /> Retained or stale sample</span>}</div>;
    })}</div><p className="dev-data-footnote">Values illustrate imported data, not your health or readiness. Missing values mean no sample data is available for that metric, date, and selected source.</p></>}

    <div className="dev-lower-grid"><section className="dev-source-panel"><div className="dev-panel-heading"><span><Settings2 size={19} /></span><h2>Choose your sources</h2></div><p>One source per metric, per day. Steps and sleep from different providers are never added together.</p><div className="dev-source-fields">{scopes.map(scope => {
      const candidates = providers.filter(p => p.capabilities.includes(scope) && (state.connections[p.id].status !== 'disconnected' || state.connections[p.id].days.length > 0));
      const preferred = state.preferred[scope]; const unavailable = preferred !== 'auto' && !candidates.some(p => p.id === preferred);
      return <label key={scope}>{scopeLabels[scope]}<select aria-label={`Preferred ${scopeLabels[scope].toLowerCase()} source`} value={preferred} onChange={e => { const value = e.target.value as DeviceProviderId | 'auto'; setState(previous => ({ ...previous, preferred: { ...previous.preferred, [scope]: value } })); }}><option value="auto">Automatic · one available source</option>{candidates.map(p => <option key={p.id} value={p.id}>{p.name}{state.connections[p.id].status === 'disconnected' ? ' · retained data' : ''}</option>)}{unavailable && <option value={preferred} disabled>Previous source · no available data</option>}</select></label>;
    })}</div><details className="dev-source-help"><summary>How source selection works <ChevronDown size={14} /></summary><p>Automatic selection checks connected sources first, then retained or stale sources, for each metric and date. Your preferred source comes first. If that value is missing, Form uses another available source and labels the source shown. Missing data stays blank when no source has it.</p></details></section>
    <section className="dev-workouts-panel"><div className="dev-panel-heading"><span><Activity size={19} /></span><h2>Imported workouts</h2><span className="dev-sample-tag">SAMPLE</span></div><p>Kept separate from the sessions you log in Form. Imports never add to your workout streak or lifting volume.</p>{importedWorkouts.length ? <div className="dev-workout-list">{importedWorkouts.map(item => { const workout = item.workout; const source = providers.find(p => p.id === item.provider); return <div className="dev-workout-row" key={`${item.provider}-${workout.id}`}><span><Activity size={19} /></span><div><strong>{workout.name}</strong><small>{source?.shortName} · {labelDate(selectedDate)}{state.connections[item.provider].status !== 'connected' && ' · retained or stale sample'}</small></div><span>{workout.durationMinutes} min</span></div>; })}</div> : <div className="dev-workout-empty"><Activity size={23} /><strong>No imported workouts for this day.</strong><span>Activity permission and a source with a sample workout are needed.</span></div>}</section></div>

    <details className="dev-future-details"><summary><span>When real connections become available</span><ChevronDown size={16} /></summary><p>These are future integration paths, not services connected to this prototype. Account authorization, secure token handling, and real data imports still need implementation.</p><div>{providers.map(p => <article key={p.id}><h3>{p.name}</h3><p>{p.route}{p.id === 'fitbit' && ' The legacy Fitbit Web API is scheduled to shut down October 30, 2026.'}</p><a href={p.docs} target="_blank" rel="noreferrer">Provider documentation <ExternalLink size={12} /></a></article>)}</div></details>
    <details className="dev-preview-states"><summary>Preview a connection state <ChevronDown size={15} /></summary><div><label>Device<select value={previewProvider} onChange={e => setPreviewProvider(e.target.value as DeviceProviderId)} aria-label="Preview device">{providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Simulated state<select value={previewValue} onChange={e => changeScenario(e.target.value as Scenario)} disabled={previewConnection.status === 'disconnected' || !!busy} aria-label="Preview connection state"><option value="normal">Connected / normal</option><option value="stale">Stale sample data</option><option value="error">Sync failure</option><option value="expired">Expired permission</option><option value="empty">No imported records</option></select></label></div><p>{previewConnection.status === 'disconnected' ? 'Connect this demo device before previewing its sync states.' : 'Recovery controls on the card work. Expired permission requires choosing categories again.'}</p></details>

    <dialog className="dev-dialog" ref={modal} onKeyDown={containDialogFocus} aria-labelledby="dev-dialog-title" aria-describedby="dev-dialog-description" onCancel={e => { e.preventDefault(); closeDialog(); }} onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeDialog(); } }}>
      {dialog && provider && connection && <><div className="dev-dialog-top"><span className="dev-dialog-provider"><Watch size={19} />{provider.name}</span><button className="icon-button dev-dialog-close" aria-label="Close device dialog" onClick={closeDialog}><X size={20} /></button></div><span className="eyebrow">LOCAL PROTOTYPE · SAMPLE DATA</span><h2 id="dev-dialog-title">{dialog.mode === 'connect' ? 'A connection on your terms.' : dialog.mode === 'manage' ? 'You are in control.' : dialog.mode === 'disconnect' ? 'Disconnect this demo?' : 'Remove imported sample data?'}</h2><p id="dev-dialog-description">{dialog.mode === 'connect' ? 'Choose the sample categories you want to explore. No sign-in, real account, or device access is involved.' : dialog.mode === 'manage' ? 'Choose which sample categories to keep, or remove this provider’s data from the local preview.' : dialog.mode === 'disconnect' ? 'This stops demo refreshes. It does not change any real device account or its permissions.' : `This removes ${provider.shortName} sample records from this browser. It does not delete anything from a real device or service.`}</p>
      {dialog.mode === 'connect' && <form onSubmit={e => { e.preventDefault(); connect(); }}>{scopeFields()}<p className="dev-permission-note"><ShieldCheck size={15} /> Everything starts off. Only selected categories will be imported.</p><div className="dev-dialog-import"><span>YOUR FIRST SAMPLE IMPORT</span><strong>7 days · October 7–13, 2026</strong><p>Illustrative records stay in this browser with your prototype settings.</p></div><div className="dev-dialog-actions"><button type="button" className="btn secondary" onClick={closeDialog}>{busy ? 'Cancel import' : 'Not now'}</button><button className="btn primary" disabled={!chosenScopes.length || !!busy} type="submit">{busy ? <LoaderCircle className="dev-spin" size={17} /> : <Link2 size={16} />}{busy ? 'Importing sample…' : 'Connect & import sample'}</button></div><p className="dev-dialog-status" role="status">{busy ? 'Simulating your first refresh. No account is being contacted.' : !chosenScopes.length ? 'Choose at least one category to continue.' : `${chosenScopes.length} ${chosenScopes.length === 1 ? 'category' : 'categories'} selected. You can change this later.`}</p></form>}
      {dialog.mode === 'manage' && <>{connection.status !== 'disconnected' ? <>{scopeFields()}<p className="dev-permission-note">Turning off a category removes its sample data. Newly enabled categories appear after you save and sync.</p><button className="btn primary dev-save-scopes" onClick={saveScopes}>Save demo permissions <Check size={17} /></button>{connection.status === 'expired' && <p className="dev-permission-note"><CircleAlert size={16} /> Saving categories does not reconnect an expired demo. Reconnect from its card.</p>}</> : <div className="dev-retained-note"><Unplug size={18} /><p>This demo is disconnected. Retained records are still labeled as stale and can be removed below.</p></div>}<div className="dev-data-actions"><button onClick={() => openDialog(provider.id, 'delete')} disabled={!connection.days.length}><Trash2 size={18} /><span><strong>Delete imported sample data</strong><small>{connection.days.length ? `${connection.days.length} sample days from ${provider.shortName}` : 'There are no imported records to delete'}</small></span><ArrowRight size={16} /></button>{connection.status !== 'disconnected' && <button onClick={() => openDialog(provider.id, 'disconnect')}><Unplug size={18} /><span><strong>Disconnect demo</strong><small>You can choose whether to keep sample records.</small></span><ArrowRight size={16} /></button>}</div></>}
      {dialog.mode === 'disconnect' && <><label className="dev-remove-choice"><input type="checkbox" checked={removeData} onChange={e => setRemoveData(e.target.checked)} /><span><strong>Also remove this provider’s sample data</strong><small>{removeData ? 'Imported records will be cleared from this browser.' : 'Records will remain visible as retained, stale sample data.'}</small></span></label><div className="dev-dialog-actions"><button className="btn secondary" onClick={() => openDialog(provider.id, 'manage')}>Keep connected</button><button className="btn primary" onClick={() => { const id = provider.id; setState(previous => disconnectDemo(previous, id, removeData)); setDialog(null); toast(removeData ? 'Demo disconnected and its sample data removed.' : 'Demo disconnected. Sample records retained and marked stale.'); }}><Unplug size={16} /> Disconnect demo</button></div></>}
      {dialog.mode === 'delete' && <><div className="dev-delete-note"><Trash2 size={22} /><p><strong>{connection.days.length} sample days</strong> will be removed. {connection.status === 'disconnected' ? 'Reconnect and choose categories to import them again.' : 'Your demo connection stays available. A later sync can import the sample records again.'}</p></div><div className="dev-dialog-actions"><button className="btn secondary" onClick={() => openDialog(provider.id, 'manage')}>Keep data</button><button className="btn danger" onClick={() => { const id = provider.id; setState(previous => deleteDeviceData(previous, id)); setDialog(null); toast(`${provider.shortName} sample data removed from the local preview.`); }}><Trash2 size={16} /> Delete sample data</button></div></>}
      </>}
    </dialog>
  </section>;
}
