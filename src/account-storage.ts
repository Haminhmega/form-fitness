import {documentSchema,preferencesSchema,type AccountDocument,type FitnessProfile} from '../shared/account';
import {initialExercises,initialRoutines} from './data';
import type {Preferences} from './types';

export type LocalReader=(key:string)=>string|null;
export type LocalRemover=(key:string)=>void;
export const migratedTrainingKeys=['form-routines-v1','form-exercises-v1','form-preferences-v1','form-history-v1'] as const;
export const localDemoKey='form-local-demo-v1';

export function readLocalPreferences(userId:string,fallback:Preferences,getItem:LocalReader=(name)=>localStorage.getItem(name)):Preferences{
  try{const parsed=preferencesSchema.safeParse(JSON.parse(getItem(`form-user:${userId}:form-preferences-v1`)||'null'));if(parsed.success)return parsed.data}catch{}
  return fallback;
}

export function hasLocalDemo(getItem:LocalReader=(name)=>localStorage.getItem(name)){
  try{return getItem(localDemoKey)==='1'||Boolean(getItem('form-session-v1'))}catch{return false}
}

export function clearMigratedTraining(
  userId:string,
  removeItem:LocalRemover=(name)=>localStorage.removeItem(name),
){
  migratedTrainingKeys.forEach(name=>removeItem(`form-user:${userId}:${name}`));
}

export function buildAccountDocumentFromLocal(
  userId:string,
  profile:FitnessProfile,
  preferences:Preferences,
  getItem:LocalReader=(name)=>localStorage.getItem(name),
):AccountDocument{
  try{
    const read=(name:string,fallback:unknown)=>JSON.parse(getItem(`form-user:${userId}:${name}`)||JSON.stringify(fallback));
    const localPreferences=readLocalPreferences(userId,preferences,getItem);
    const localHistory=read('form-history-v1',[]) as Array<{sample?:boolean}>;
    const candidate={
      profile,
      training:{
        preferences:{
          ...localPreferences,
          units:preferences.units,
          goal:preferences.goal,
          experience:preferences.experience,
          equipment:preferences.equipment,
          days:preferences.days,
          firstTime:true,
          onboarded:true,
        },
        routines:read('form-routines-v1',initialRoutines),
        exercises:read('form-exercises-v1',initialExercises),
        history:localHistory.filter(item=>!item?.sample),
      },
    };
    const parsed=documentSchema.safeParse(candidate);
    if(parsed.success)return parsed.data;
  }catch{/* A malformed device copy should not block account creation. */}

  return {
    profile,
    training:{
      preferences:{...preferences,firstTime:true,onboarded:true},
      routines:initialRoutines,
      exercises:initialExercises,
      history:[],
    },
  };
}
