import type { MechanismSide,RobotSetup } from "./types";
export const DEFAULT_ROBOT:Readonly<RobotSetup>={shooter:"front",deposit:"front",intake:"front"};
export function validateRobotSetup(value:unknown):RobotSetup {
  if(value===undefined||value===null)return {...DEFAULT_ROBOT};
  if(typeof value!=="object"||Array.isArray(value))throw new Error("Invalid robot configuration.");
  const r=value as RobotSetup;
  if(!["front","back"].includes(r.shooter)||!["front","back"].includes(r.deposit)||!["front","back","both"].includes(r.intake))throw new Error("Choose valid mechanism sides.");
  return {shooter:r.shooter,deposit:r.deposit,intake:r.intake};
}
export function sideAngle(side:MechanismSide){return side==="back"?Math.PI:0;}
