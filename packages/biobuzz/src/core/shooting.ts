import { HIVE, hitHive, hivePoint, type Point3 } from "./hive";
import { BALL, DT, HALF, type Ball, type Hive, type Pose } from "./types";

export const SHOOTER = { height:0.36, offset:0.28, elevation:Math.PI/3 } as const;
export interface ShotPlan { heading:number; speed:number; elevation:number }
/** Trace the same fixed-step launch and hive contacts used by the live engine. */
export function clearHiveShot(pose:Pose, kind:Ball["kind"], plan:ShotPlan, hives:readonly Hive[], target:number,
  velocity={x:0,y:0}):boolean {
  const c=Math.cos(plan.heading),s=Math.sin(plan.heading),radius=BALL[kind].diameter/2;
  let p:Point3={x:pose.x+c*SHOOTER.offset,y:pose.y+s*SHOOTER.offset,z:SHOOTER.height};
  const vx=c*plan.speed*Math.cos(plan.elevation)+velocity.x,vy=s*plan.speed*Math.cos(plan.elevation)+velocity.y;
  let vz=plan.speed*Math.sin(plan.elevation);
  for(let step=0;step<120;step++) {
    const next={x:p.x+vx*DT,y:p.y+vy*DT,z:p.z+vz*DT-4.905*DT*DT};vz-=9.81*DT;
    let first:ReturnType<typeof hitHive>=null,index=-1;
    for(let i=0;i<hives.length;i++){
      const hit=hitHive(hives[i],p,next,radius);
      if(hit&&(!first||hit.time<first.time)){first=hit;index=i;}
    }
    if(first)return first.capture&&index===target;
    if(next.z<=radius||Math.abs(next.x)>HALF-radius||Math.abs(next.y)>HALF-radius)return false;
    p=next;
  }
  return false;
}
/** Bounded ballistic search; never changes position, creates balls, or guarantees a hit through a wall. */
export function planHiveShot(pose:Pose,kind:Ball["kind"],hives:readonly Hive[],target:number):ShotPlan|null {
  const hive=hives[target];if(hive.tipping)return null;
  for(const height of [0.19,0.12,0.26]) {
    const point=hivePoint(hive,hive.upward,{x:HIVE.front,y:0,z:HIVE.bottom+height});
    const range=Math.hypot(point.x-pose.x,point.y-pose.y)-SHOOTER.offset;
    if(range<=BALL[kind].diameter)continue;
    const heading=Math.atan2(point.y-pose.y,point.x-pose.x);
    for(const degrees of [60,55,50,45,40,35,30,65,70,75,80]) {
      const elevation=degrees*Math.PI/180,denominator=2*Math.cos(elevation)**2*(range*Math.tan(elevation)-(point.z-SHOOTER.height));
      if(denominator<=0)continue;
      const speed=Math.sqrt(9.81*range*range/denominator);
      if(speed<2||speed>5.8)continue;
      const plan={heading,elevation,speed};
      if(clearHiveShot(pose,kind,plan,hives,target))return plan;
    }
  }
  return null;
}
