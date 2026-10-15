import type {Exercise, SupportLevel} from '../types';
import {analyzeSquat} from './squat';
import type {AnalysisInput, SquatAnalysis} from './types';

export type CameraView='side'|'front_three_quarter'|'front';
export type MovementCategory='lower_push'|'upper_push'|'upper_pull'|'hinge'|'isometric_core';
export type ExerciseAnalyzerSpec={
  id:string;
  canonicalName:string;
  aliases:string[];
  category:MovementCategory;
  version:string;
  camera:{requiredView:CameraView;requiredLandmarks:number[];setupInstructions:string};
  minimumSampleRateFps:number;
  contraindicatedClaims:string[];
};
export type ExerciseAnalyzer={spec:ExerciseAnalyzerSpec;analyze:(input:AnalysisInput)=>SquatAnalysis};

const squatSpec:ExerciseAnalyzerSpec={
  id:'squat',canonicalName:'Bodyweight squat',aliases:['Air squat','Bodyweight squat'],category:'lower_push',version:'1.0.0',minimumSampleRateFps:5,
  camera:{requiredView:'side',requiredLandmarks:[11,12,23,24,25,26,27,28],setupInstructions:'Film from the side at hip height with shoulders, hips, knees, and ankles visible.'},
  contraindicatedClaims:['injury diagnosis','injury risk','clinical technique score','internal joint force'],
};

const registry=new Map<string,ExerciseAnalyzer>([['squat',{spec:squatSpec,analyze:analyzeSquat}]]);

export function getAnalyzer(exerciseId:string){return registry.get(exerciseId)}
export function listAnalyzers(){return [...registry.values()]}
export function hasRealAnalyzer(exerciseId:string){return registry.has(exerciseId)}
export function getExerciseSupportLevel(exercise:Pick<Exercise,'id'|'supported'|'supportLevel'|'custom'>):SupportLevel{
  if(exercise.custom)return 'logging_only';
  if(hasRealAnalyzer(exercise.id))return 'real_ai';
  if(exercise.supportLevel)return exercise.supportLevel==='real_ai'?'logging_only':exercise.supportLevel;
  return exercise.supported?'illustrative_only':'logging_only';
}
export function supportLabel(level:SupportLevel){return level==='real_ai'?'AI form check available':level==='illustrative_only'?'Illustrated example only':'Logging only'}
