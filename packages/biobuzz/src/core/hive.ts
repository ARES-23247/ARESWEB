import type { Hive } from "./types";

/** Manual V1 figures 9-9..11 and supplied STEP skins; meters in the unrotated hive. */
export const HIVE = {
  pivot: 1.11633, front: 0.544, depth: 0.3058, halfWidth: 0.254,
  bottom: -0.0373, height: 0.3556, shoulder: 0.193294,
  // Conservative frame/skin envelope, not a measured material/contact model.
  wall: 0.0127, restitution: 0.25,
} as const;
export type Point3 = { x: number; y: number; z: number };
type Plane = { normal: Point3; offset: number };
const dot = (a: Point3, b: Point3) => a.x*b.x+a.y*b.y+a.z*b.z;
const slope = (HIVE.height-HIVE.shoulder)/HIVE.halfWidth;
const roofLength = Math.hypot(1,slope);
// The front is an opening. The other six planes bound the back, floor, sides and roof.
const planes: Plane[] = [
  {normal:{x:1,y:0,z:0},offset:HIVE.front},
  {normal:{x:-1,y:0,z:0},offset:-(HIVE.front-HIVE.depth)},
  {normal:{x:0,y:0,z:-1},offset:-HIVE.bottom},
  {normal:{x:0,y:1,z:0},offset:HIVE.halfWidth},
  {normal:{x:0,y:-1,z:0},offset:HIVE.halfWidth},
  {normal:{x:0,y:slope/roofLength,z:1/roofLength},offset:(HIVE.bottom+HIVE.height)/roofLength},
  {normal:{x:0,y:-slope/roofLength,z:1/roofLength},offset:(HIVE.bottom+HIVE.height)/roofLength},
];
export function hivePoint(h: Pick<Hive,"x"|"y"|"angle">, cell: number, p: Point3): Point3 {
  const sign=cell===0?-1:1,c=Math.cos(h.angle),s=Math.sin(h.angle);
  return {x:h.x+c*sign*p.x-s*p.z,y:h.y+p.y,z:HIVE.pivot+s*sign*p.x+c*p.z};
}
function localPoint(h: Hive, cell: number, p: Point3): Point3 {
  const dx=p.x-h.x,dz=p.z-HIVE.pivot,c=Math.cos(h.angle),s=Math.sin(h.angle);
  return {x:(cell===0?-1:1)*(c*dx+s*dz),y:p.y-h.y,z:-s*dx+c*dz};
}
/** A point within the wide rectangular part of the real opening, for bot aiming. */
export function hiveTarget(h: Hive, cell=h.upward): Point3 {
  return hivePoint(h,cell,{x:HIVE.front,y:0,z:HIVE.bottom+0.19});
}
/** Polygon vertices shared by collision bounds and the dynamic top-down renderer. */
export function hiveOutline(h: Hive, cell: number, back=false): Point3[] {
  const x=HIVE.front-(back?HIVE.depth:0),b=HIVE.bottom;
  return [[-HIVE.halfWidth,b],[HIVE.halfWidth,b],[HIVE.halfWidth,b+HIVE.shoulder],
    [0,b+HIVE.height],[-HIVE.halfWidth,b+HIVE.shoulder]].map(([y,z])=>hivePoint(h,cell,{x,y,z}));
}
type Hit = { time:number; cell:number; capture:boolean; normal:Point3 };
/** Swept sphere against the finite wall envelopes, so a fast shot cannot skip a skin.
 * Rounded ball corners use conservative plane offsets. The opening stays a hole;
 * a score requires inward entry with the entire sphere clear of all five edges.
 */
export function hitHive(h: Hive, from: Point3, to: Point3, radius: number): Hit | null {
  let first: Hit | null=null;
  for(let cell=0;cell<2;cell++) {
    const a=localPoint(h,cell,from),b=localPoint(h,cell,to);
    if(!h.tipping&&cell===h.upward&&a.x>=HIVE.front&&b.x<HIVE.front) {
      const time=(a.x-HIVE.front)/(a.x-b.x);
      const p={x:HIVE.front,y:a.y+(b.y-a.y)*time,z:a.z+(b.z-a.z)*time};
      if(planes.slice(2).every(plane=>dot(plane.normal,p)<=plane.offset-radius)&&(!first||time<first.time))
        first={time,cell,capture:true,normal:{x:0,y:0,z:0}};
    }
    for(let wall=1;wall<planes.length;wall++) {
      const plane=planes[wall];
      const bounds=[...planes.map(p=>({normal:p.normal,offset:p.offset+radius+HIVE.wall})),
        {normal:{x:-plane.normal.x,y:-plane.normal.y,z:-plane.normal.z},offset:-plane.offset+radius}];
      let enter=0,leave=1,normal:Point3|null=null;
      for(const bound of bounds) {
        const start=dot(bound.normal,a)-bound.offset,end=dot(bound.normal,b)-bound.offset;
        if(start>0&&end>0){leave=-1;break;}
        if(start<=0&&end<=0)continue;
        const t=start/(start-end);
        if(start>end){if(t>=enter){enter=t;normal=bound.normal;}}else leave=Math.min(leave,t);
      }
      if(normal&&enter<=leave&&(!first||enter<first.time)) {
        const sign=cell===0?-1:1,c=Math.cos(h.angle),s=Math.sin(h.angle);
        first={time:enter,cell,capture:false,normal:{x:c*sign*normal.x-s*normal.z,y:normal.y,z:s*sign*normal.x+c*normal.z}};
      }
    }
  }
  return first;
}
