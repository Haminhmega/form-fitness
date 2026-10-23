import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/ai/squat-research-export.ts'],bundle:true,format:'esm',platform:'browser',write:false});
const {buildSquatResearchRecord}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const pose=Array.from({length:33},(_,id)=>({x:.4+id/1000,y:.3+id/1000,z:0,visibility:.99,presence:.98}));
const result={
  status:'assessed',duration:2,validFraction:.5,issues:[],observations:[{id:'measured-cycles'}],
  reps:[{index:1,start:.2,bottom:.8,end:1.4,descentSeconds:.6,ascentSeconds:.6,rangeDegrees:80,minKneeAngle:90,side:'left'}],
  frames:[
    {time:0,valid:true,angle:175,landmarks:pose,worldLandmarks:pose},
    {time:.1,valid:false,reason:'Required joint was hidden.',angle:null,landmarks:pose},
  ],
};
const feedback={status:'ready',summary:'',cards:[],limitations:[],checks:[
  {id:'squat-knee-participation',label:'',status:'finding',detail:''},
  {id:'range-change',label:'',status:'not_detected',detail:''},
]};
const record=buildSquatResearchRecord({participantId:'person-007',recordingId:'recording-abc',recordedAt:null,consentConfirmed:true,dimensions:{duration:2,width:720,height:1280},result,feedback});
assert.equal(record.schema_version,'form.squat.landmarks.v1');
const manifest=JSON.parse(readFileSync('public/ai/manifest.json','utf8'));
assert.equal(record.pose.model_sha256,manifest.artifacts.find(artifact=>artifact.file==='pose_landmarker_lite.task').sha256);
assert.equal(record.participant_id,'person-007');
assert.equal(record.recorded_at,null);
assert.equal(record.frames[0].landmarks.length,33);
assert.equal(record.frames[0].landmarks[11].id,11);
assert.equal(record.frames[1].tracking.reason,'Required joint was hidden.');
assert.deepEqual(record.tracking_quality,{valid_fraction:.5,valid_frames:1,total_frames:2,withheld_reasons:{'Required joint was hidden.':1}});
assert.equal(record.attempts[0].start_seconds,.2);
assert(Object.values(record.labels).every(label=>label.value==='missing'));
assert.equal(record.heuristic_output.labels.hip_fold_without_knee_bend,'positive');
assert.equal(record.heuristic_output.labels.range_change,'negative');
assert.equal(record.heuristic_output.labels.tempo_change,'abstain');
assert.deepEqual(Object.keys(record.video).sort(),['duration_seconds','height','sample_rate_hz','width']);
assert(!('url' in record.video)&&!('blob' in record.video)&&!('filename' in record.video));
const exportSource=readFileSync('src/ai/squat-research-export.ts','utf8');
for(const forbidden of ['fetch(','XMLHttpRequest','sendBeacon','localStorage','indexedDB'])assert(!exportSource.includes(forbidden),`export must not use ${forbidden}`);
const uiSource=readFileSync('src/AIRecording.tsx','utf8');
assert(uiSource.includes("import.meta.env.DEV&&exercise.id==='squat'"));
assert.throws(()=>buildSquatResearchRecord({participantId:'person@example.com',dimensions:{duration:2,width:1,height:1},result}),/study pseudonym/);
console.log('PASS squat research export preserves production landmarks without inventing labels');
