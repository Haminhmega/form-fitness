import type {Preferences} from './types';
import {getCoaching} from '../shared/coaching';

// Product starting ranges, not minimum effective doses or validated optima.
export function trainingDurationAdvice(preferences:Preferences,age?:number|null){
  const novice=preferences.experience==='Getting started'||(typeof age==='number'&&age<18);
  const strength=/strength/i.test(preferences.goal)&&!novice;
  const range=novice?[30,45]:strength?[60,90]:[45,60];
  const minutes=getCoaching(preferences).sessionMinutes;
  const context=novice?'As you learn the movements, 30–45 minutes is a manageable starting range. Build tolerance before extending every session.':strength?'For your strength goal, 60–90 minutes can accommodate progressive warm-up sets and longer rests on the main lifts.':'For your goal, start around 45–60 minutes, then adjust to your weekly workload and recovery.';
  const selected=minutes<=20?'A brief session: prioritize a few main movements or practice sets. Short sessions can help; the weekly plan will show any missing coverage.':minutes<=40?'A focused session: prioritize the main lifts, with fewer accessory sets. Keep the warm-up and recovery between sets.':minutes<=60?'A standard session: room for main lifts, complementary accessories, warm-up and full rests.':minutes<=90?'An extended session: more room for complementary strength work and preparation. Extra time does not automatically mean extra hard sets.':'A long session: useful for some experienced programs, but not required for results. The plan will flag time it cannot use productively within your weekly workload.';
  const frequency=novice&&preferences.days.length>3?'With more than three days selected, each strength session may be smaller. Two or three separated full-body days are usually a simpler starting option.':'';
  return {range,context,selected,frequency};
}
