import type { DeviceConnection, DeviceMetric, DeviceProvider, DeviceProviderId, DeviceScope, DeviceState, DeviceDay, ImportedWorkout, SelectedMetric } from './deviceTypes';

// These are product-level demo permissions, not vendor OAuth scope strings.
export const scopeLabels: Record<DeviceScope, string> = {
  activity: 'Activity & workouts',
  sleep: 'Sleep duration',
  vitals: 'Resting heart rate & HRV',
};

export const metricScope: Record<DeviceMetric, DeviceScope> = {
  steps: 'activity', sleepMinutes: 'sleep', restingHeartRate: 'vitals', hrv: 'vitals',
};

export const providers: DeviceProvider[] = [
  {
    id: 'fitbit', name: 'Fitbit by Google', shortName: 'Fitbit', initials: 'F', color: '#80d9d0',
    description: 'Explore sample activity, sleep, and daily signals from a Fitbit device.',
    route: 'Future route: Google Health API. No Fitbit account is connected.',
    capabilities: ['activity', 'sleep', 'vitals'], metrics: ['steps', 'sleepMinutes', 'restingHeartRate', 'hrv'],
    docs: 'https://developers.google.com/health',
  },
  {
    id: 'whoop', name: 'WHOOP', shortName: 'WHOOP', initials: 'W', color: '#c0cbbd',
    description: 'Explore sample workouts, sleep, resting heart rate, and HRV. Steps are not included.',
    route: 'Future route: WHOOP API with workout, sleep, and recovery OAuth permissions.',
    capabilities: ['activity', 'sleep', 'vitals'], metrics: ['sleepMinutes', 'restingHeartRate', 'hrv'],
    docs: 'https://developer.whoop.com/docs/developing/oauth/',
  },
  {
    id: 'garmin', name: 'Garmin', shortName: 'Garmin', initials: 'G', color: '#a6c9ee',
    description: 'Explore sample daily activity, workouts, sleep, and overnight signals.',
    route: 'Future route: approved Garmin Connect Developer Program access.',
    capabilities: ['activity', 'sleep', 'vitals'], metrics: ['steps', 'sleepMinutes', 'restingHeartRate', 'hrv'],
    docs: 'https://developer.garmin.com/gc-developer-program/health-api/',
  },
  {
    id: 'apple', name: 'Apple Health', shortName: 'Apple Health', initials: 'AH', color: '#e4b7b6',
    description: 'Explore sample health records that a future iPhone app could request.',
    route: 'Future route: a native iOS app using HealthKit. Unavailable to this web prototype.',
    capabilities: ['activity', 'sleep', 'vitals'], metrics: ['steps', 'sleepMinutes', 'restingHeartRate', 'hrv'],
    docs: 'https://developer.apple.com/documentation/healthkit',
  },
  {
    id: 'healthconnect', name: 'Health Connect', shortName: 'Health Connect', initials: 'HC', color: '#b3d8a4',
    description: 'Explore sample health records that a future Android app could request.',
    route: 'Future route: a native Android app using Health Connect. Unavailable to this web prototype.',
    capabilities: ['activity', 'sleep', 'vitals'], metrics: ['steps', 'sleepMinutes', 'restingHeartRate', 'hrv'],
    docs: 'https://developer.android.com/health-and-fitness/health-connect',
  },
];

export const sampleDates: string[] = ['2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13'];

export const initialDeviceState: DeviceState = {
  connections: providers.reduce((connections, provider) => {
    connections[provider.id] = { provider: provider.id, status: 'disconnected', scopes: [], lastSyncAt: null, days: [] };
    return connections;
  }, {} as DeviceState['connections']),
  preferred: { activity: 'auto', sleep: 'auto', vitals: 'auto' },
};

const allScopes: DeviceScope[] = ['activity', 'sleep', 'vitals'];
const allMetrics = Object.keys(metricScope) as DeviceMetric[];
const metadata = (id: DeviceProviderId) => providers.find(provider => provider.id === id)!;
const selectedScopes = (id: DeviceProviderId, scopes: DeviceScope[]) => allScopes.filter(scope => scopes.includes(scope) && metadata(id).capabilities.includes(scope));

function withConnection(state: DeviceState, id: DeviceProviderId, connection: DeviceConnection): DeviceState {
  return { ...state, connections: { ...state.connections, [id]: connection } };
}

function filterDay(day: DeviceDay, scopes: DeviceScope[], provider: DeviceProvider): DeviceDay {
  const filtered: DeviceDay = {
    id: day.id, provider: day.provider, date: day.date, sample: true,
    workouts: scopes.includes('activity') ? day.workouts.map(workout => ({ ...workout })) : [],
  };
  for (const metric of allMetrics) {
    const value = day[metric];
    if (scopes.includes(metricScope[metric]) && provider.metrics.includes(metric) && typeof value === 'number' && Number.isFinite(value)) {
      filtered[metric] = value;
    }
  }
  return filtered;
}

function sampleDays(id: DeviceProviderId, scopes: DeviceScope[]): DeviceDay[] {
  if (!scopes.length) return [];
  const source = metadata(id);
  const offset = providers.findIndex(provider => provider.id === id);
  const steps = [7820, 6340, 9140, 5210, 10620, 8420, 4860];
  const sleep = [438, 461, 405, 452, 474, 429, 447];
  const rhr = [58, 57, 60, 59, 56, 58, 57];
  const hrv = [54, 59, 48, 53, 63, 56, 60];
  return sampleDates.map((date, index) => {
    const workouts: ImportedWorkout[] = [0, 2, 5].includes(index) ? [{
      id: `${id}-${date}-workout`, name: index === 2 ? 'Outdoor walk' : 'Strength training',
      durationMinutes: index === 2 ? 28 + offset : 34 + offset,
      startedAt: `${date}T17:30:00-04:00`,
    }] : [];
    return filterDay({
      id: `${id}-${date}`, provider: id, date, sample: true, workouts,
      steps: steps[index] + offset * 120,
      sleepMinutes: sleep[index] + offset * 3,
      restingHeartRate: rhr[index] + offset,
      hrv: hrv[index] + offset * 2,
    }, scopes, source);
  });
}

/** Explicit demo consent replaces old imports with seven days of selected sample data. */
export function connectDemo(state: DeviceState, id: DeviceProviderId, scopes: DeviceScope[], now = Date.now()): DeviceState {
  const allowed = selectedScopes(id, scopes);
  return withConnection(state, id, {
    provider: id, status: 'connected', scopes: allowed, lastSyncAt: now, days: sampleDays(id, allowed),
  });
}

/** An expired permission requires explicit consent through connectDemo before syncing. */
export function syncDemo(state: DeviceState, id: DeviceProviderId, now = Date.now()): DeviceState {
  const connection = state.connections[id];
  if (connection.status === 'disconnected' || connection.status === 'expired' || !connection.scopes.length) return state;
  const allowed = selectedScopes(id, connection.scopes);
  return withConnection(state, id, {
    ...connection, status: 'connected', scopes: allowed, lastSyncAt: now, days: sampleDays(id, allowed),
  });
}

/** Revocations remove the affected data immediately. Added scopes wait for an explicit sync. */
export function updateDeviceScopes(state: DeviceState, id: DeviceProviderId, scopes: DeviceScope[]): DeviceState {
  const connection = state.connections[id];
  const allowed = connection.status === 'disconnected' ? [] : selectedScopes(id, scopes);
  const preferred = { ...state.preferred };
  for (const scope of allScopes) {
    if (preferred[scope] === id && !allowed.includes(scope)) preferred[scope] = 'auto';
  }
  return {
    ...withConnection(state, id, {
      ...connection, scopes: allowed,
      days: allowed.length ? connection.days.map(day => filterDay(day, allowed, metadata(id))) : [],
    }),
    preferred,
  };
}

export function disconnectDemo(state: DeviceState, id: DeviceProviderId, removeData: boolean): DeviceState {
  const connection = state.connections[id];
  const preferred = { ...state.preferred };
  if (removeData) {
    for (const scope of allScopes) if (preferred[scope] === id) preferred[scope] = 'auto';
  }
  return {
    ...withConnection(state, id, { ...connection, status: 'disconnected', scopes: [], days: removeData ? [] : connection.days }),
    preferred,
  };
}

/** Deletes imports only; does not revoke existing demo permissions. */
export function deleteDeviceData(state: DeviceState, id: DeviceProviderId): DeviceState {
  return withConnection(state, id, { ...state.connections[id], days: [] });
}

export function setDeviceScenario(state: DeviceState, id: DeviceProviderId, scenario: 'stale' | 'error' | 'expired' | 'empty' | 'normal'): DeviceState {
  const connection = state.connections[id];
  const protectedStatus = connection.status === 'disconnected' || connection.status === 'expired';
  const status = protectedStatus ? connection.status : scenario === 'normal' || scenario === 'empty' ? 'connected' : scenario;
  return withConnection(state, id, {
    ...connection, status,
    days: scenario === 'empty' ? [] : connection.days,
    lastSyncAt: scenario === 'stale' && !protectedStatus ? (connection.lastSyncAt ?? Date.now()) - 3 * 86400000 : connection.lastSyncAt,
  });
}

function sourceOrder(state: DeviceState, scope: DeviceScope): DeviceProviderId[] {
  const preferred = state.preferred[scope];
  const ids = providers.map(provider => provider.id);
  const ordered = [...ids.filter(id => state.connections[id].status === 'connected'), ...ids.filter(id => state.connections[id].status !== 'connected')];
  return preferred === 'auto' ? ordered : [preferred, ...ordered.filter(id => id !== preferred)];
}

function hasMetric(day: DeviceDay, metric: DeviceMetric): boolean {
  return typeof day[metric] === 'number' && Number.isFinite(day[metric]);
}

/** Chooses one actual value. Daily totals are never added across overlapping sources. */
export function selectMetric(state: DeviceState, metric: DeviceMetric, date?: string): SelectedMetric | null {
  const availableDate = date ?? providers.flatMap(provider => state.connections[provider.id].days.filter(day => hasMetric(day, metric)).map(day => day.date)).sort().at(-1);
  if (!availableDate) return null;
  for (const id of sourceOrder(state, metricScope[metric])) {
    if (!metadata(id).metrics.includes(metric)) continue;
    const connection = state.connections[id];
    const day = connection.days.find(record => record.date === availableDate && hasMetric(record, metric));
    if (day) return { value: day[metric]!, provider: id, date: availableDate, stale: connection.status !== 'connected' || connection.lastSyncAt === null, sample: true };
  }
  return null;
}

/** Separate imports for display; this does not create or count Form workout sessions. */
export function getImportedWorkouts(state: DeviceState, date?: string): { provider: DeviceProviderId; workout: ImportedWorkout; date: string }[] {
  const dates = date ? [date] : [...new Set(providers.flatMap(provider => state.connections[provider.id].days.map(day => day.date)))].sort().reverse();
  return dates.flatMap(dayDate => {
    for (const id of sourceOrder(state, 'activity')) {
      const workouts = state.connections[id].days.filter(day => day.date === dayDate).flatMap(day => day.workouts);
      if (!workouts.length) continue;
      const unique = new Map<string, ImportedWorkout>();
      for (const workout of workouts) if (!unique.has(workout.id)) unique.set(workout.id, workout);
      return [...unique.values()].map(workout => ({ provider: id, workout: { ...workout }, date: dayDate }));
    }
    return [];
  });
}
