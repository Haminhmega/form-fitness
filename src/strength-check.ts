import type {Preferences,Routine} from './types';
export const strengthCheckId='form-beginner-strength-check';
export function strengthCheckRoutine(preferences:Preferences):Routine{
 const ids=['squat','glute-bridge',...(preferences.equipment.includes('Dumbbells')?['curl']:[]),'plank'];
 return {id:strengthCheckId,name:'Beginner strength check',description:'Optional baseline · comfortable effort, no maximum lifts.',exercises:ids.map(exerciseId=>({exerciseId,sets:2,reps:exerciseId==='plank'?'15–20':'8–10',rest:120,notes:exerciseId==='plank'?'Log seconds. First set: easy practice. Second set: comfortable hold; stop before position breaks.':'First set: easy practice. Second set: repeat at a comfortable effort. Stop with about 3 good reps left. Record actual reps and how it felt.'}))};
}
