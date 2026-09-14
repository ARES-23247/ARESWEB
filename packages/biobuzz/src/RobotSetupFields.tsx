import type { RobotSetup } from "./core/types";
import { useId } from "react";
import { ROBOT_LIMITS } from "./core/robot";
export default function RobotSetupFields({value,onChange,disabled=false}:{value:RobotSetup;onChange:(value:RobotSetup)=>void;disabled?:boolean}) {
  const id=useId();
  return <fieldset disabled={disabled}><legend>Mechanism positions</legend><div className="bio-row">
    {(["shooter","deposit","intake"] as const).map(key=><div key={key}><label htmlFor={id+key}>{key==="shooter"?"Hive shooter side":key==="deposit"?"Flower placement side":"Intake side"}</label>
      <select id={id+key} value={value[key]} onChange={e=>onChange({...value,[key]:e.target.value})}><option value="front">Front</option><option value="back">Back</option>{key==="intake"&&<option value="both">Both</option>}</select>
    </div>)}
  </div><label><input type="checkbox" checked={value.turret??false} onChange={e=>onChange({...value,turret:e.target.checked})}/> Shooter turret</label>
  <p className="bio-help">The turret rotates the shooter independently. Shooter side sets its home direction; flower placement and intake stay on the chassis.</p>
  <div className="bio-row"><label>Chassis speed (m/s)<input type="number" min={ROBOT_LIMITS.driveSpeed.min} max={ROBOT_LIMITS.driveSpeed.max} step={0.05} value={value.driveSpeed??ROBOT_LIMITS.driveSpeed.default} onChange={e=>onChange({...value,driveSpeed:Number(e.target.value)})}/></label>
  <label>Turn speed (degrees/s)<input type="number" min={30} max={360} step={1} value={Number(((value.turnSpeed??ROBOT_LIMITS.turnSpeed.default)*180/Math.PI).toFixed(2))} onChange={e=>onChange({...value,turnSpeed:Number(e.target.value)*Math.PI/180})}/></label></div>
  <p className="bio-help">Chassis: 0.25–3.0 m/s. Turn: 30–360°/s. Acceleration remains limited.</p></fieldset>;
}
