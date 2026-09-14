import { HIVE, hitHive, hivePoint, type Point3 } from "./hive";
import { BALL, DT, HALF, FLOWER_TOP, FLOWER_BASE, distance, type Ball, type Hive, type Pose, type Flower } from "./types";

export const SHOOTER = { height:0.36, offset:0.28, elevation:Math.PI/3 } as const;
export interface ShotPlan { heading:number; speed:number; elevation:number }
export interface FlowerShotPlan extends ShotPlan { flower:number }
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

/** A short, real projectile arc through the flower's top opening. */
export function clearFlowerShot(pose:Pose,kind:Ball["kind"],plan:ShotPlan,hives:readonly Hive[],flower:Flower,velocity={x:0,y:0}):boolean {
  const c=Math.cos(plan.heading),s=Math.sin(plan.heading),radius=BALL[kind].diameter/2,height=FLOWER_TOP+radius;
  let p:Point3={x:pose.x+c*SHOOTER.offset,y:pose.y+s*SHOOTER.offset,z:SHOOTER.height};
  const vx=c*plan.speed*Math.cos(plan.elevation)+velocity.x,vy=s*plan.speed*Math.cos(plan.elevation)+velocity.y;
  let vz=plan.speed*Math.sin(plan.elevation);
  for(let step=0;step<120;step++){
    const next={x:p.x+vx*DT,y:p.y+vy*DT,z:p.z+vz*DT-4.905*DT*DT};vz-=9.81*DT;
    if(hives.some(h=>hitHive(h,p,next,radius)))return false;
    if(p.z>=height&&next.z<=height&&p.z>next.z){const t=(p.z-height)/(p.z-next.z);return distance({x:p.x+(next.x-p.x)*t,y:p.y+(next.y-p.y)*t},flower)<=.0508-radius;}
    if(next.z<=radius||Math.abs(next.x)>HALF-radius||Math.abs(next.y)>HALF-radius)return false;
    p=next;
  }
  return false;
}
export function planFlowerShot(pose:Pose,kind:Ball["kind"],hives:readonly Hive[],flowers:readonly Flower[],balls:readonly Ball[]):FlowerShotPlan|null {
  const radius=BALL[kind].diameter/2;
  // The CAD flower spacing allows at most one opening within this placement reach.
  const candidates=flowers.map((f,flower)=>({f,flower})).filter(({f})=>distance(pose,f)<=.95&&FLOWER_BASE+f.balls.reduce((sum,id)=>sum+BALL[balls[id].kind].diameter,0)<FLOWER_TOP);
  for(const {f,flower} of candidates){
    const range=distance(pose,f)-SHOOTER.offset,heading=Math.atan2(f.y-pose.y,f.x-pose.x);
    if(range<=radius)continue;
    for(const degrees of [60,65,70,75,80,85]){
      const elevation=degrees*Math.PI/180,denominator=2*Math.cos(elevation)**2*(range*Math.tan(elevation)-(FLOWER_TOP+radius-SHOOTER.height));
      if(denominator<=0)continue;
      const speed=Math.sqrt(9.81*range*range/denominator);
      if(speed<2||speed>5.8)continue;
      const plan={heading,elevation,speed,flower};
      if(clearFlowerShot(pose,kind,plan,hives,f))return plan;
    }
  }
  return null;
}
