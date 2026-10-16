import {documentSchema,preferencesSchema,type AccountDocument,type AccountUser,type FitnessProfile} from '../shared/account';
import {initialExercises,initialRoutines} from './data';
import type {Preferences} from './types';
import {clearWorkoutTimers} from './workout-recovery';
import {prepareCoachingPlan} from './coaching-plan';

export type LocalReader=(key:string)=>string|null;
export type LocalRemover=(key:string)=>void;
export const migratedTrainingKeys=['form-routines-v1','form-exercises-v1','form-preferences-v1','form-history-v1'] as const;
export const localDemoKey='form-local-demo-v1';
export const accountCacheKey=(userId:string)=>'form-account-v1:'+userId;
export const skippedProfileKey=(userId:string)=>`form-user:${userId}:form-setup-skipped-v1`;
export type CachedAccount={user:AccountUser;document:AccountDocument;revision:number;dirty:boolean;requiresSignIn:boolean};

export function readCachedAccount(userId:string,getItem:LocalReader=(name)=>localStorage.getItem(name)):CachedAccount|null{
  try{
    const raw=JSON.parse(getItem(accountCacheKey(userId))||'null');
    const parsed=documentSchema.safeParse(raw?.document),user=raw?.user;
    if(!parsed.success||user?.id!==userId||typeof user.email!=='string'||typeof user.name!=='string'||!['password','google','chatgpt'].includes(user.provider)||typeof user.googleLinked!=='boolean'||!Number.isSafeInteger(raw.revision)||raw.revision<1||typeof raw.dirty!=='boolean')return null;
    return {user:{id:userId,email:user.email,name:user.name,provider:user.provider,googleLinked:user.googleLinked},document:parsed.data,revision:raw.revision,dirty:raw.dirty,requiresSignIn:raw.requiresSignIn===true};
  }catch{return null}
}

export function readLastCachedAccount(getItem:LocalReader=(name)=>localStorage.getItem(name)){
  try{const id=getItem('form-last-account');return id?readCachedAccount(id,getItem):null}catch{return null}
}

export function clearAccountWorkoutState(userId:string){clearWorkoutTimers(undefined,userId)}

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
          ...(preferences.coaching?{coaching:preferences.coaching}:{}),
          firstTime:true,
          onboarded:true,
        },
        routines:read('form-routines-v1',preferences.coaching?[]:initialRoutines),
        exercises:read('form-exercises-v1',initialExercises),
        history:localHistory.filter(item=>!item?.sample),
      },
    };
    const parsed=documentSchema.safeParse(candidate);
    if(parsed.success){
      if(!preferences.coaching)return parsed.data;
      const suggested=prepareCoachingPlan(parsed.data.training.preferences,parsed.data.training.routines,parsed.data.training.exercises,{age:profile.age});
      return {...parsed.data,training:{...parsed.data.training,routines:suggested.routines,exercises:suggested.exercises}};
    }
  }catch{/* A malformed device copy should not block account creation. */}

  const suggested=preferences.coaching?prepareCoachingPlan(preferences,[],initialExercises,{age:profile.age}):null;
  return {
    profile,
    training:{
      preferences:{...preferences,firstTime:true,onboarded:true},
      routines:suggested?.routines||initialRoutines,
      exercises:suggested?.exercises||initialExercises,
      history:[],
    },
  };
}
