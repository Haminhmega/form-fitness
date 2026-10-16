import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';

// Opt-in, local-only diagnostic. Never commit personal footage or pose output.
// Usage: node scripts/inspect-local-form-video.mjs <clip> <output.json> [exercise]
const [clip,output,exercise='squat']=process.argv.slice(2);
if(!clip||!output)throw new Error('Provide a local video and an output JSON path outside the repository.');
const relative=path.relative(process.cwd(),path.resolve(output));
if(!relative.startsWith('..')&&!path.isAbsolute(relative))throw new Error('Keep personal pose output outside the repository.');
const base=process.env.FORM_TEST_URL||'http://127.0.0.1:5174';
const origin=new URL(base).origin;
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw new Error('This diagnostic only runs against localhost.');
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
  const page=await browser.newPage();
  await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  await page.route(origin+'/inspection',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body>Local video diagnostic</body></html>'}));
  await page.goto(origin+'/inspection');
  await page.evaluate(()=>{const input=document.createElement('input');input.type='file';input.id='local-inspection';document.body.appendChild(input)});
  await page.locator('#local-inspection').setInputFiles(path.resolve(clip));
  const data=await page.evaluate(async exercise=>{
    const file=document.querySelector('#local-inspection').files[0],url=URL.createObjectURL(file);
    try{
      const video=document.createElement('video');video.muted=true;video.src=url;
      await new Promise((resolve,reject)=>{video.onloadedmetadata=resolve;video.onerror=()=>reject(new Error('The browser could not decode this clip.'))});
      const dimensions={width:video.videoWidth,height:video.videoHeight};
      const {analyzeVideo}=await import('/src/ai/analyzeVideo.ts');
      const {buildFormFeedback}=await import('/src/ai/form-feedback.ts');
      const result=await analyzeVideo(url,exercise,{signal:new AbortController().signal,onProgress:()=>{}});
      return {exercise,dimensions,result,feedback:buildFormFeedback(exercise,result,dimensions)};
    }finally{URL.revokeObjectURL(url)}
  },exercise);
  await writeFile(output,JSON.stringify(data));
  console.log(JSON.stringify({status:data.result.status,frames:data.result.frames.length,reps:data.result.reps.length,validFraction:data.result.validFraction,issues:data.result.issues,feedback:data.feedback}));
}finally{await browser.close()}
