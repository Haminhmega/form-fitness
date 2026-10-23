export const focusAreas=['Glutes','Legs','Back','Chest','Shoulders','Arms','Core'] as const;
export const sessionLengths=[20,30,45,60,75] as const;
export const sessionDurationRange={min:10,max:120,step:5} as const;
export const trainingStyles=['Balanced','Free weights','Machines','Bodyweight'] as const;
export type TrainingStyle=typeof trainingStyles[number];
export const impactOptions=['Standard','Low impact'] as const;
export const movementAvoidances=['Jumping','Overhead pressing','Deep knee bends','Floor exercises'] as const;
export const sportFocusOptions=['General athleticism','Running','Court and field sports'] as const;
export type CoachingPreferences={version:1;focusAreas:Array<typeof focusAreas[number]>;sessionMinutes:number;trainingStyle:TrainingStyle;trainingStyles?:TrainingStyle[];impact:typeof impactOptions[number];avoidMovements:Array<typeof movementAvoidances[number]>;sportFocus:typeof sportFocusOptions[number]};
export function coachingDefaults():CoachingPreferences{return {version:1,focusAreas:[],sessionMinutes:60,trainingStyle:'Balanced',impact:'Standard',avoidMovements:[],sportFocus:'General athleticism'}}
export function getCoaching(preferences:{coaching?:CoachingPreferences}):CoachingPreferences&{trainingStyles:TrainingStyle[]}{
  const coaching={...coachingDefaults(),...preferences.coaching};
  const selected=[...new Set(coaching.trainingStyles?.filter(style=>trainingStyles.includes(style))||[])];
  return {...coaching,trainingStyles:selected.length?selected:[coaching.trainingStyle]};
}
