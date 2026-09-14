import type { RobotSetup } from "./core/types";
import { useId } from "react";
export default function RobotSetupFields({value,onChange,disabled=false}:{value:RobotSetup;onChange:(value:RobotSetup)=>void;disabled?:boolean}) {
  const id=useId();
  return <fieldset disabled={disabled}><legend>Mechanism positions</legend><div className="bio-row">
    {(["shooter","deposit","intake"] as const).map(key=><div key={key}><label htmlFor={id+key}>{key==="shooter"?"Hive shooter side":key==="deposit"?"Flower placement side":"Intake side"}</label>
      <select id={id+key} value={value[key]} onChange={e=>onChange({...value,[key]:e.target.value})}><option value="front">Front</option><option value="back">Back</option>{key==="intake"&&<option value="both">Both</option>}</select>
    </div>)}
  </div></fieldset>;
}
