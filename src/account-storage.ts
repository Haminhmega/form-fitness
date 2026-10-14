import {documentSchema,type AccountDocument,type FitnessProfile} from '../shared/account';
import {initialExercises,initialRoutines} from './data';
import type {Preferences} from './types';

export type LocalReader=(key:string)=>string|null;

export function buildAccountDocumentFromLocal(
  userId:string,
  profile:FitnessProfile,
  preferences:Preferences,
  getItem:LocalReader=(name)=>localStorage.getItem(name),
):AccountDocument{
  try{
    const read=(name:string,fallback:unknown)=>JSON.parse(getItem(`form-user:${userId}:${name}`)||JSON.stringify(fallback));
    const candidate={
      profile,
      training:{
        preferences,
        routines:read('form-routines-v1',initialRoutines),
        exercises:read('form-exercises-v1',initialExercises),
        history:read('form-history-v1',[]),
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
