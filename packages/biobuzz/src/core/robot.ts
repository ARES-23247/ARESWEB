import type { MechanismSide,Robot,RobotSetup } from "./types";
export const DEFAULT_ROBOT:Readonly<RobotSetup>={shooter:"front",deposit:"front",intake:"front"};
export const ROBOT_LIMITS={driveSpeed:{min:0.25,max:3,default:1.8},turnSpeed:{min:Math.PI/6,max:2*Math.PI,default:3.2},turretSpeed:Math.PI} as const;
export function validateRobotSetup(value:unknown):RobotSetup {
  if(value===undefined||value===null)return {...DEFAULT_ROBOT};
  if(typeof value!=="object"||Array.isArray(value))throw new Error("Invalid robot configuration.");
  const r=value as RobotSetup;
  if(!["front","back"].includes(r.shooter)||!["front","back"].includes(r.deposit)||!["front","back","both"].includes(r.intake))throw new Error("Choose valid mechanism sides.");
  if(r.turret!==undefined&&typeof r.turret!=="boolean")throw new Error("Choose whether the shooter has a turret.");
  for(const key of ["driveSpeed","turnSpeed"] as const){const speed=r[key],limit=ROBOT_LIMITS[key];if(speed!==undefined&&(!Number.isFinite(speed)||speed<limit.min||speed>limit.max))throw new Error("Robot speeds are outside the supported range.");}
  return {shooter:r.shooter,deposit:r.deposit,intake:r.intake,...(r.turret!==undefined?{turret:r.turret}:{}),...(r.driveSpeed!==undefined?{driveSpeed:r.driveSpeed}:{}),...(r.turnSpeed!==undefined?{turnSpeed:r.turnSpeed}:{})};
}
export function sideAngle(side:MechanismSide){return side==="back"?Math.PI:0;}
export function shooterHeading(robot:Robot){return robot.heading+sideAngle(robot.setup.shooter)+(robot.setup.turret?robot.turretAngle??0:0);}
