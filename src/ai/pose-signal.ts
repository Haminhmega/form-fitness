import {OneEuroFilter} from './one-euro';
import type {AnalysisInput, PosePoint} from './types';

export const reliablePoint = (p: PosePoint | undefined): p is PosePoint => !!p &&
  [p.x,p.y,p.z,p.visibility,p.presence??1].every(Number.isFinite) &&
  p.visibility <= 1 && (p.presence??1) <= 1 && Math.min(p.visibility,p.presence??1) >= .65;

/** Conservative discontinuity gate, not a general scene-cut detector. */
export function poseDiscontinuity(a: PosePoint[], b: PosePoint[], width: number, height: number): boolean {
  const distance = (p: PosePoint,q: PosePoint) => Math.hypot((p.x-q.x)*width,(p.y-q.y)*height);
  const ids = [11,12,23,24].filter(id=>reliablePoint(a[id]) && reliablePoint(b[id]));
  if (ids.length < 3) return false;
  const offset = [0,1].find(o=>[11+o,23+o].every(id=>ids.includes(id)));
  if (offset === undefined) return false;
  const torso = distance(a[11+offset],a[23+offset]);
  if (torso < height*.07) return false;
  const scale = distance(b[11+offset],b[23+offset])/torso;
  if (scale < .65 || scale > 1.55) return true;
  const moves = ids.map(id=>({x:(b[id].x-a[id].x)*width,y:(b[id].y-a[id].y)*height}));
  const mean = moves.reduce((s,v)=>({x:s.x+v.x/moves.length,y:s.y+v.y/moves.length}),{x:0,y:0});
  return Math.hypot(mean.x,mean.y)/torso > .35 && moves.every(v=>Math.hypot(v.x-mean.x,v.y-mean.y)/torso < .1);
}

/** Clone and smooth trusted coordinates only; never interpolate missing data.
 * Image x/y are filtered in pixels so adaptive speed uses the same axis units.
 * Original inferred world coordinates are preserved, not treated as ground truth.
 */
export function smoothPoseInput(input: AnalysisInput): AnalysisInput {
  const filters = new Map<number,OneEuroFilter[]>();
  let previous: PosePoint[] = [], last = -Infinity;
  return {...input,frames:input.frames.map(frame=>{
    const pose = frame.poses.length===1 ? frame.poses[0] : [];
    const cut = poseDiscontinuity(previous,pose,input.width,input.height);
    if (!pose.length || cut || !Number.isFinite(frame.time) || frame.time<=last || frame.time-last>.4) filters.clear();
    previous=pose; last=frame.time;
    if (cut) return {...frame,poses:[]};
    if (frame.poses.length!==1) return {...frame,poses:frame.poses.map(p=>p.map(v=>({...v})))};
    return {...frame,poses:[pose.map((p,id)=>{
      if (!reliablePoint(p) || p.x<=.015 || p.x>=.985 || p.y<=.015 || p.y>=.985) {filters.delete(id);return {...p};}
      const bank=filters.get(id)??[new OneEuroFilter(),new OneEuroFilter(),new OneEuroFilter()];
      filters.set(id,bank);
      return {...p,x:bank[0].filter(p.x*input.width,frame.time)/input.width,y:bank[1].filter(p.y*input.height,frame.time)/input.height,z:bank[2].filter(p.z*input.width,frame.time)/input.width};
    })]};
  })};
}
