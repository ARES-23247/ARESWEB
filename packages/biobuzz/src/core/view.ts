import { HALF, SIZE, type Alliance } from "./types";
type Point={x:number;y:number};
/** Normalized screen coordinates, with the chosen alliance's +Y/-Y station at the bottom. */
export function fieldToView(p:Point,alliance:Alliance):Point {
  const sign=alliance==="red"?1:-1;
  return {x:0.5-sign*p.x/SIZE,y:0.5+sign*p.y/SIZE};
}
export function viewToField(p:Point,alliance:Alliance):Point {
  const sign=alliance==="red"?1:-1;
  return {x:sign*(HALF-p.x*SIZE),y:sign*(p.y*SIZE-HALF)};
}
export function driverInput(forward:number,left:number,alliance:Alliance):Point {
  const sign=alliance==="red"?1:-1;
  return {x:sign*left,y:-sign*forward};
}
/** Rotation from the original +X-up CAD projection; heading remains CCW in the engine. */
export function viewRotation(alliance:Alliance):number {return alliance==="red"?-Math.PI/2:Math.PI/2;}
