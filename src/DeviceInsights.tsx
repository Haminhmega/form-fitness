import { useState } from 'react';
import { Activity, ArrowUpRight, Footprints, Heart, Info, Moon, PlugZap, Watch } from 'lucide-react';
import type { DeviceMetric, DeviceProviderId, DeviceState, SelectedMetric } from './deviceTypes';
import { getImportedWorkouts, metricScope, providers, sampleDates, scopeLabels, selectMetric } from './devices';
import './device-insights.css';

type DeviceInsightProps = { state: DeviceState; onManage: () => void };
const metricDetails: Record<DeviceMetric, { label: string; shortLabel: string; unit: string; icon: typeof Footprints }> = {
  steps: { label: 'Daily steps', shortLabel: 'Steps', unit: 'steps', icon: Footprints },
  sleepMinutes: { label: 'Sleep duration', shortLabel: 'Sleep', unit: 'minutes', icon: Moon },
  restingHeartRate: { label: 'Resting heart rate', shortLabel: 'Resting heart rate', unit: 'bpm', icon: Heart },
  hrv: { label: 'Heart rate variability', shortLabel: 'HRV', unit: 'ms', icon: Activity },
};
const nameOf = (id: DeviceProviderId) => providers.find(provider => provider.id === id)?.name || id;
const shortDate = (date: string) => new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fullDate = (date: string) => new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const formatValue = (value: number, metric: DeviceMetric) => metric === 'sleepMinutes'
  ? `${Math.floor(value / 60)}h ${Math.round(value % 60)}m`
  : value.toLocaleString('en-US', { maximumFractionDigits: 1 });
const hasImports = (state: DeviceState) => Object.values(state.connections).some(connection => connection.days.length > 0);
const statusLabel = (state: DeviceState, selected: SelectedMetric) => {
  const status = state.connections[selected.provider].status;
  if (status === 'disconnected') return 'Retained · disconnected';
  if (status === 'expired') return 'Retained · permission expired';
  if (status === 'error') return 'Retained · sync failed';
  if (selected.stale || status === 'stale') return 'Stale sample';
  return 'Sample import';
};

function DeviceEmpty({ state, onManage, compact = false }: DeviceInsightProps & { compact?: boolean }) {
  const hasConnection = Object.values(state.connections).some(connection => connection.status !== 'disconnected');
  return <section className={`device-insights device-empty panel${compact ? ' device-empty-compact' : ''}`} aria-labelledby={compact ? 'device-today-empty-heading' : 'device-progress-empty-heading'}>
    <span className="device-empty-icon"><Watch size={23} aria-hidden="true" /></span>
    <div className="device-empty-copy"><p className="eyebrow">A LITTLE MORE CONTEXT · OPTIONAL</p><h2 id={compact ? 'device-today-empty-heading' : 'device-progress-empty-heading'}>{hasConnection ? 'Your devices are ready for a sample import.' : 'Bring your day into the picture.'}</h2><p className="muted">Explore sample activity, sleep, and heart-rate imports alongside your training.</p><div className="device-provider-wordmarks" role="group" aria-label="Supported demonstration providers"><span>FITBIT</span><span>WHOOP</span><span>GARMIN</span><span>Apple Health</span><span>Health Connect</span></div><p className="device-empty-disclosure">Interactive demo connections. No real account, device, or health data is accessed.</p></div>
    <button className="btn secondary" onClick={onManage}>{hasConnection ? 'Import sample data' : 'Connect your devices'}<ArrowUpRight size={17} aria-hidden="true" /></button>
  </section>;
}

export function DeviceToday({ state, onManage }: DeviceInsightProps) {
  if (!hasImports(state)) return <DeviceEmpty state={state} onManage={onManage} compact />;
  const metrics: DeviceMetric[] = ['steps', 'sleepMinutes', 'restingHeartRate'];
  const selected = metrics.map(metric => ({ metric, point: selectMetric(state, metric) }));
  const stale = selected.some(item => item.point?.stale || item.point && state.connections[item.point.provider].status !== 'connected');
  return <section className="device-insights device-today panel" aria-labelledby="device-today-heading">
    <div className="device-section-heading"><div><p className="eyebrow">AROUND YOUR TRAINING</p><h2 id="device-today-heading">A little everyday context.</h2></div><button className="btn ghost" onClick={onManage}>Manage devices<ArrowUpRight size={16} aria-hidden="true" /></button></div>
    <div className="device-today-metrics">{selected.map(({ metric, point }) => {
      const detail = metricDetails[metric];
      const Icon = detail.icon;
      return <div className="device-today-metric" key={metric}><span className="device-metric-label"><Icon size={16} aria-hidden="true" />{detail.shortLabel}</span><p className="device-metric-value">{point ? formatValue(point.value, metric) : '—'}{point && metric === 'restingHeartRate' && <span>bpm</span>}</p>{point ? <><span className="device-metric-source">{nameOf(point.provider)} <span aria-hidden="true">·</span> {shortDate(point.date)}</span><span className="device-data-status">{statusLabel(state, point)}</span></> : <><span className="device-metric-source">No imported value</span><span className="device-data-status">Missing data is not zero</span></>}</div>;
    })}</div>
    <p className="device-context-note"><Info size={14} aria-hidden="true" /><span>{stale ? 'Some values are retained or out of date. ' : ''}Clearly labeled sample data, one source per metric. No live sync, readiness score, or automatic workout changes.</span></p>
  </section>;
}

export function DeviceProgress({ state, onManage }: DeviceInsightProps) {
  const [metric, setMetric] = useState<DeviceMetric>('steps');
  const [showAllActivities, setShowAllActivities] = useState(false);
  if (!hasImports(state)) return <DeviceEmpty state={state} onManage={onManage} />;
  const detail = metricDetails[metric];
  const current = selectMetric(state, metric);
  const dates = sampleDates.slice(-7);
  const rows = dates.map(date => ({ date, point: selectMetric(state, metric, date) }));
  const available = rows.filter(row => row.point !== null);
  const max = Math.max(1, ...available.map(row => row.point!.value));
  const distinctProviders = [...new Set(available.map(row => row.point!.provider))];
  const scope = metricScope[metric];
  const preferred = state.preferred[scope];
  const activities = [...getImportedWorkouts(state)].sort((a, b) => b.workout.startedAt.localeCompare(a.workout.startedAt));
  const visibleActivities = showAllActivities ? activities : activities.slice(0, 3);
  const Icon = detail.icon;
  return <section className="device-insights device-progress panel" aria-labelledby="device-progress-heading">
    <div className="device-section-heading"><div><p className="eyebrow">DEVICE IMPORTS · SAMPLE DATA</p><h2 id="device-progress-heading">The context around the work.</h2><p className="muted">Activity and rest, kept separate from your Form workout totals.</p></div><button className="btn secondary" onClick={onManage}><PlugZap size={16} aria-hidden="true" />Manage sources</button></div>
    <div className="device-progress-layout"><div className="device-trend-column">
      <div className="device-trend-controls"><label className="field" htmlFor="device-trend-metric"><span id="device-trend-metric-label">Metric</span><select id="device-trend-metric" aria-labelledby="device-trend-metric-label" value={metric} onChange={e => setMetric(e.target.value as DeviceMetric)}>{(Object.keys(metricDetails) as DeviceMetric[]).map(key => <option value={key} key={key}>{metricDetails[key].label}</option>)}</select></label><div className="device-scope-source"><span>{scopeLabels[scope]} source preference</span><strong>{preferred === 'auto' ? 'Automatic · one source per day' : nameOf(preferred)}</strong><span>Change this in Devices</span></div></div>
      <div className="device-latest-value"><div><span className="device-metric-label"><Icon size={17} aria-hidden="true" />Latest imported value</span><p>{current ? formatValue(current.value, metric) : '—'}{current && metric !== 'sleepMinutes' && <span>{detail.unit}</span>}</p></div>{current ? <div className="device-latest-source"><strong>{nameOf(current.provider)}</strong><span>{fullDate(current.date)}</span><span className="badge">{statusLabel(state, current)}</span></div> : <div className="device-latest-source"><strong>No value imported</strong><span>Connect a supporting source and allow this data category.</span></div>}</div>
      <div className="device-chart-header"><span>{shortDate(dates[0])}–{shortDate(dates[dates.length - 1])}, 2026</span><span>{available.length} of {dates.length} days with data</span></div>
      <div className="device-week-chart" role="img" aria-label={`${detail.label}, sample week. ${rows.map(row => `${shortDate(row.date)}: ${row.point ? `${formatValue(row.point.value, metric)}${metric === 'sleepMinutes' ? '' : ` ${detail.unit}`}, ${nameOf(row.point.provider)}, ${statusLabel(state, row.point)}` : 'no imported value'}`).join('; ')}. Exact values and sources are in the table below.`}><div className="device-chart-grid" aria-hidden="true"><span /><span /><span /></div>{rows.map(row => <div className="device-day-column" key={row.date} aria-hidden="true"><span className={`device-day-bar ${row.point ? '' : 'device-day-missing'}`} style={{ height: row.point ? `${Math.max(row.point.value === 0 ? 3 : 6, row.point.value / max * 108)}px` : '8px' }} />{!row.point && <span className="device-missing-label">—</span>}<span className="device-day-number">{new Date(`${row.date}T12:00:00`).getDate()}</span></div>)}</div>
      <p className="device-trend-context">{available.length ? `${available.length} sample ${available.length === 1 ? 'day is' : 'days are'} available. These illustrative values do not establish a personal trend or readiness to train.` : 'No values are available for this metric in the sample week. A dash means missing, not zero.'}</p>
      {metric === 'hrv' && <p className="device-comparability-note"><Info size={15} aria-hidden="true" /><span>HRV varies by device and measurement method. Values from different providers are not directly comparable; Form does not average or convert them.</span></p>}
      {distinctProviders.length > 1 && <p className="device-comparability-note"><Info size={15} aria-hidden="true" /><span>This view contains {distinctProviders.length} providers. Each day keeps its own source; measurements are never summed or averaged across devices.</span></p>}
      <div className="device-data-table-wrap"><table className="device-data-table"><caption>Exact sample values & source</caption><thead><tr><th scope="col">Day</th><th scope="col">{detail.shortLabel}</th><th scope="col">Source & status</th></tr></thead><tbody>{rows.map(row => <tr key={row.date}><th scope="row">{shortDate(row.date)}</th><td>{row.point ? `${formatValue(row.point.value, metric)}${metric === 'sleepMinutes' || metric === 'steps' ? '' : ` ${detail.unit}`}` : <span>—</span>}</td><td>{row.point ? <><strong>{nameOf(row.point.provider)}</strong><span>{statusLabel(state, row.point)}</span></> : <span>No imported value</span>}</td></tr>)}</tbody></table></div>
    </div><div className="device-activities-column"><div className="device-activities-heading"><span className="device-activity-icon"><Activity size={21} aria-hidden="true" /></span><div><p className="eyebrow">FROM YOUR DEVICES</p><h3>Imported activities</h3></div><span className="badge">{activities.length}</span></div><p className="device-activity-explainer">Separate from Form sessions. These samples do not increase your completed-session count, sets, volume, or personal records.</p>
      {visibleActivities.length ? <ul className="device-activity-list">{visibleActivities.map(({ provider, workout, date }) => {
        const connection = state.connections[provider];
        return <li key={`${provider}-${workout.id}`}><span className="device-activity-date">{shortDate(date)}</span><strong>{workout.name}</strong><span>{workout.durationMinutes} min <span aria-hidden="true">·</span> {nameOf(provider)}</span><span className="device-data-status">{connection.status === 'disconnected' ? 'Retained sample · disconnected' : connection.status === 'connected' ? 'Sample activity' : 'Retained sample · sync unavailable'}</span></li>;
      })}</ul> : <div className="device-no-activities"><Footprints size={23} aria-hidden="true" /><strong>No activities imported yet.</strong><p>Allow activity data and import a sample in Devices. Missing activity data does not mean you did not train.</p></div>}
      {activities.length > 3 && <button className="btn ghost device-activity-toggle" onClick={() => setShowAllActivities(!showAllActivities)} aria-expanded={showAllActivities}>{showAllActivities ? 'Show fewer activities' : `Show all ${activities.length} activities`}</button>}
      <div className="device-source-note"><Info size={16} aria-hidden="true" /><p>One selected activity source per day avoids counting the same workout from multiple devices. Source preferences and data permissions are managed in Devices.</p></div>
    </div></div>
    <p className="device-context-note"><Info size={14} aria-hidden="true" /><span>All imports here are simulated. Device connections, permissions, and sync do not access a real account or health record.</span></p>
  </section>;
}
