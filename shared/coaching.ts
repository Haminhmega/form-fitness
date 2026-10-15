export const focusAreas=['Glutes','Legs','Back','Chest','Shoulders','Arms','Core'] as const;
export const sessionLengths=[20,30,45,60,75] as const;
export const trainingStyles=['Balanced','Free weights','Machines','Bodyweight'] as const;
export const impactOptions=['Standard','Low impact'] as const;
export const movementAvoidances=['Jumping','Overhead pressing','Deep knee bends','Floor exercises'] as const;
export const sportFocusOptions=['General athleticism','Running','Court and field sports'] as const;
export type CoachingPreferences={version:1;focusAreas:Array<typeof focusAreas[number]>;sessionMinutes:typeof sessionLengths[number];trainingStyle:typeof trainingStyles[number];impact:typeof impactOptions[number];avoidMovements:Array<typeof movementAvoidances[number]>;sportFocus:typeof sportFocusOptions[number]};
export function coachingDefaults():CoachingPreferences{return {version:1,focusAreas:[],sessionMinutes:45,trainingStyle:'Balanced',impact:'Standard',avoidMovements:[],sportFocus:'General athleticism'}}
export function getCoaching(preferences:{coaching?:CoachingPreferences}):CoachingPreferences{return {...coachingDefaults(),...preferences.coaching}}
