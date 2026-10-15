import type {Exercise,SupportLevel} from '../types';
import {analyzeGenericMotion} from './generic-motion';
import {popularExerciseProfiles,type MotionProfile} from './popular-profiles';
import {analyzeSquat} from './squat';
import {analyzeSpecificMovement,specificConfigs,type SpecificMovement} from './specific-movements';
import type {AnalysisInput,SquatAnalysis} from './types';

export type CameraView='side'|'front_three_quarter'|'front';
export type MovementCategory='lower_push'|'upper_push'|'upper_pull'|'hinge'|'isometric_core';
export type ExerciseAnalyzerSpec={id:string;canonicalName:string;aliases:string[];category:MovementCategory;version:string;validation:'verified'|'beta';metricLabel:string;camera:{requiredView:CameraView;requiredLandmarks:number[];setupInstructions:string};minimumSampleRateFps:number;contraindicatedClaims:string[]};
export type ExerciseAnalyzer={spec:ExerciseAnalyzerSpec;analyze:(input:AnalysisInput)=>SquatAnalysis};
const forbidden=['injury diagnosis','injury risk','clinical technique score','internal joint force','exercise identification'];
const squatSpec:ExerciseAnalyzerSpec={id:'squat',canonicalName:'Bodyweight squat',aliases:['Air squat','Bodyweight squat'],category:'lower_push',version:'1.0.0',validation:'verified',metricLabel:'knee angle',minimumSampleRateFps:5,camera:{requiredView:'side',requiredLandmarks:[11,12,23,24,25,26,27,28],setupInstructions:'Film from the side at hip height with shoulders, hips, knees, and ankles visible.'},contraindicatedClaims:forbidden};
const registry=new Map<string,ExerciseAnalyzer>([['squat',{spec:squatSpec,analyze:analyzeSquat}]]);
const builtInBetaProfiles=[
  {id:'pushup',name:'Push-up',profile:'elbow'},
  {id:'curl',name:'Standing biceps curl',profile:'elbow'},
  {id:'rdl',name:'Dumbbell Romanian deadlift',profile:'hip'},
  {id:'row',name:'Single-arm dumbbell row',profile:'elbow'},
  {id:'press',name:'Dumbbell shoulder press',profile:'shoulder'},
] as const satisfies readonly {id:string;name:string;profile:MotionProfile}[];
const setup:Record<MotionProfile,{view:CameraView;landmarks:number[];text:string;category:MovementCategory;metric:string}>={
  knee:{view:'side',landmarks:[11,12,23,24,25,26,27,28],text:'Film from the side with the working hip, knee, and ankle fully visible.',category:'lower_push',metric:'knee angle'},
  hip:{view:'side',landmarks:[11,12,23,24,25,26],text:'Film from the side with the working shoulder, hip, and knee fully visible.',category:'hinge',metric:'hip angle'},
  elbow:{view:'front_three_quarter',landmarks:[11,12,13,14,15,16],text:'Film from the side or a slight front angle with the working shoulder, elbow, and wrist fully visible.',category:'upper_pull',metric:'elbow angle'},
  shoulder:{view:'front_three_quarter',landmarks:[11,12,13,14,23,24],text:'Film from the front or a slight angle with the working elbow, shoulder, and hip fully visible.',category:'upper_push',metric:'shoulder angle'},
};
for(const entry of [...popularExerciseProfiles,...builtInBetaProfiles]){const guide=setup[entry.profile];const category=entry.profile==='elbow'&&/push|press|extension|dip|bench|chest|skull/i.test(entry.name)?'upper_push':guide.category;const spec:ExerciseAnalyzerSpec={id:entry.id,canonicalName:entry.name,aliases:[],category,version:'0.1.0',validation:'beta',metricLabel:guide.metric,minimumSampleRateFps:5,camera:{requiredView:guide.view,requiredLandmarks:guide.landmarks,setupInstructions:guide.text},contraindicatedClaims:forbidden};registry.set(entry.id,{spec,analyze:input=>analyzeGenericMotion(input,entry.profile,entry.name)});}

const dedicatedEntries:{id:SpecificMovement;name:string;view:CameraView;camera:string}[]=[
 {id:'pushup',name:'Push-up',view:'side',camera:'Film from the side with shoulders, elbows, wrists, hips and ankles visible. Keep hands and toes in frame.'},
 {id:'curl',name:'Standing biceps curl',view:'side',camera:'Film from the working-arm side. Keep shoulder, elbow, wrist and hip visible to compare upper-body movement.'},
 {id:'row',name:'Single-arm dumbbell row',view:'side',camera:'Film from the working-arm side with bench, shoulder, elbow, wrist and hip visible; keep the supporting side out of the working arm’s path.'},
 {id:'press',name:'Dumbbell shoulder press',view:'front_three_quarter',camera:'Use a front three-quarter view with wrists, elbows, shoulders and hips visible throughout the overhead press.'},
 {id:'rdl',name:'Dumbbell Romanian deadlift',view:'side',camera:'Film from the side with shoulder, hip, knee and ankle visible through the complete hip hinge.'},
 {id:'glute-bridge',name:'Glute bridge',view:'side',camera:'Film from the side at floor height. Include shoulders, hips, knees and ankles in the frame.'},
 {id:'reverse-lunge',name:'Reverse lunge',view:'side',camera:'Film from the side with shoulders and both legs visible. Perform all reps on one side before switching; alternating reps may be undercounted.'},
 {id:'hip-abduction',name:'Side-lying hip abduction',view:'front',camera:'Film facing the front of your side-lying body, with the moving top leg visible from hip to ankle. Avoid overlapping the legs in the camera view.'},
 {id:'plank',name:'Forearm plank',view:'side',camera:'Film from the side at floor height with shoulder, elbow, hip and ankle visible for at least two uninterrupted seconds.'},
];
for(const entry of dedicatedEntries){
 const config=specificConfigs[entry.id],original=registry.get(entry.id)?.spec;
 const spec:ExerciseAnalyzerSpec={id:entry.id,canonicalName:entry.name,aliases:[],category:original?.category||(entry.id==='plank'?'isometric_core':entry.id==='reverse-lunge'?'lower_push':'hinge'),version:'0.2.0',validation:'beta',metricLabel:config.label,minimumSampleRateFps:5,camera:{requiredView:entry.view,requiredLandmarks:[...config.joints,...config.joints.map(j=>j+1)],setupInstructions:entry.camera},contraindicatedClaims:forbidden};
 registry.set(entry.id,{spec,analyze:input=>analyzeSpecificMovement(input,entry.id,entry.name)});
}

export function getAnalyzer(exerciseId:string){return registry.get(exerciseId)}
export function listAnalyzers(){return [...registry.values()]}
export function hasRealAnalyzer(exerciseId:string){return registry.get(exerciseId)?.spec.validation==='verified'}
export function getExerciseSupportLevel(exercise:Pick<Exercise,'id'|'supported'|'supportLevel'|'custom'>):SupportLevel{
  if(exercise.custom)return 'logging_only';const analyzer=registry.get(exercise.id);if(analyzer)return analyzer.spec.validation==='verified'?'real_ai':'experimental_ai';
  if(exercise.supportLevel)return ['real_ai','experimental_ai'].includes(exercise.supportLevel)?'logging_only':exercise.supportLevel;
  return exercise.supported?'illustrative_only':'logging_only';
}
export function supportLabel(level:SupportLevel){return level==='real_ai'?'Verified AI check':level==='experimental_ai'?'Beta motion check':level==='illustrative_only'?'Illustrated example only':'Logging only'}
