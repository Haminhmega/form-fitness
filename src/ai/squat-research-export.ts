import type {FormFeedback} from './form-feedback';
import type {PosePoint,SquatAnalysis} from './types';

export const SQUAT_RESEARCH_SCHEMA_VERSION='form.squat.landmarks.v1';
export const SQUAT_PREPROCESSING_VERSION='squat-landmarks-1.0.0';
const POSE_MODEL={name:'MediaPipe Pose Landmarker Lite, float16',version:'1 / @mediapipe/tasks-vision 0.10.35',sha256:'59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a'} as const;
const TARGETS=['hip_fold_without_knee_bend','torso_change','range_change','tempo_change'] as const;
type Target=typeof TARGETS[number];
type LabelValue='positive'|'negative'|'uncertain'|'missing';
type HeuristicValue='positive'|'negative'|'abstain';
type Dimensions={duration:number;width:number;height:number;sampleRate?:number};
type Options={participantId:string;recordingId?:string;recordedAt?:string|null;consentConfirmed?:boolean;dimensions:Dimensions;result:SquatAnalysis;feedback?:FormFeedback|null};

function identifier(value:string,name:string){
  const trimmed=value.trim();
  if(!trimmed||trimmed.length>128)throw new Error(`${name} must be a non-empty anonymous identifier of at most 128 characters.`);
  if(/@|https?:|\s{2,}/i.test(trimmed))throw new Error(`${name} looks like identifying contact information. Use a study pseudonym instead.`);
  return trimmed;
}
function point(point:PosePoint,id:number){return {id,x:point.x,y:point.y,z:point.z,visibility:point.visibility,presence:point.presence??null};}
function emptyLabel():{value:LabelValue;annotator_id:null;annotated_at:null;notes:null}{return {value:'missing',annotator_id:null,annotated_at:null,notes:null};}
function heuristic(feedback:FormFeedback|undefined|null):Record<Target,HeuristicValue>{
  const mapping:Record<Target,string>={hip_fold_without_knee_bend:'squat-knee-participation',torso_change:'torso-change',range_change:'range-change',tempo_change:'tempo-change'};
  return Object.fromEntries(TARGETS.map(target=>{
    const check=feedback?.checks.find(candidate=>candidate.id===mapping[target]);
    return [target,check?.status==='finding'?'positive':check?.status==='not_detected'?'negative':'abstain'];
  })) as Record<Target,HeuristicValue>;
}

/** Build a local landmark-only research record. Human labels deliberately start missing. */
export function buildSquatResearchRecord(options:Options){
  const participantId=identifier(options.participantId,'participantId');
  const recordingId=identifier(options.recordingId??crypto.randomUUID(),'recordingId');
  const {result,dimensions}=options;
  if(![dimensions.duration,dimensions.width,dimensions.height].every(Number.isFinite)||dimensions.duration<=0||dimensions.width<=0||dimensions.height<=0)throw new Error('Valid video dimensions and duration are required.');
  if(!result.frames.length)throw new Error('Analyzed frames are required.');
  const reasons:Record<string,number>={};
  for(const frame of result.frames)if(!frame.valid){const reason=frame.reason||'Unspecified tracking failure.';reasons[reason]=(reasons[reason]??0)+1;}
  const labels=Object.fromEntries(TARGETS.map(target=>[target,emptyLabel()])) as Record<Target,ReturnType<typeof emptyLabel>>;
  return {
    schema_version:SQUAT_RESEARCH_SCHEMA_VERSION,participant_id:participantId,recording_id:recordingId,
    recorded_at:options.recordedAt===undefined?new Date().toISOString():options.recordedAt,exercise:'squat' as const,
    provenance:{synthetic:false,purpose:'squat_observation_research',consent_state:options.consentConfirmed?'confirmed':'not_recorded'},
    video:{duration_seconds:dimensions.duration,width:Math.round(dimensions.width),height:Math.round(dimensions.height),sample_rate_hz:dimensions.sampleRate??10},
    pose:{model_name:POSE_MODEL.name,model_version:POSE_MODEL.version,model_sha256:POSE_MODEL.sha256,preprocessing_version:SQUAT_PREPROCESSING_VERSION},
    tracking_quality:{valid_fraction:result.validFraction,valid_frames:result.frames.filter(frame=>frame.valid).length,total_frames:result.frames.length,withheld_reasons:reasons},
    frames:result.frames.map(frame=>({timestamp_seconds:frame.time,tracking:{valid:frame.valid,reason:frame.reason??null},landmarks:frame.landmarks.map(point),world_landmarks:(frame.worldLandmarks??[]).map(point)})),
    attempts:result.reps.map(rep=>({attempt_id:`${recordingId}-rep-${rep.index}`,rep_index:rep.index,start_seconds:rep.start,bottom_seconds:rep.bottom,end_seconds:rep.end,side:rep.side})),
    labels,
    heuristic_output:{version:'deterministic-form-feedback-2026-10-18',status:options.feedback?.status??result.status,observation_ids:result.observations.map(observation=>observation.id),labels:heuristic(options.feedback)},
  };
}

export function downloadSquatResearchRecord(options:Options){
  const record=buildSquatResearchRecord(options);
  const blob=new Blob([JSON.stringify(record,null,2)+'\n'],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=`form-squat-${record.recording_id.replace(/[^a-z0-9._-]+/gi,'-')}.json`;
  link.click();setTimeout(()=>URL.revokeObjectURL(url),0);
  return record;
}
