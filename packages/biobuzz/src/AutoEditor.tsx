import { useState } from "react";
import type { AutoProgram, AutoStep, Pose } from "./core/types";
import { HALF, ROBOT_HALF } from "./core/types";
import { autoDuration, validateAuto } from "./core/auto";
import { exportAuto } from "./export";
import RobotSetupFields from "./RobotSetupFields";
import { DEFAULT_ROBOT } from "./core/robot";
export function defaultAutoStart(alliance:"red"|"blue"):Pose {const sign=alliance==="red"?1:-1;return {x:-1.1*sign,y:(HALF-Math.hypot(ROBOT_HALF,ROBOT_HALF))*sign,heading:alliance==="red"?-Math.PI/4:Math.PI*3/4};}
export function defaultAuto():AutoProgram {return {version:1,name:"BIOBUZZ auto",alliance:"red",start:defaultAutoStart("red"),steps:[]};}
export default function AutoEditor({program,onChange,onPreview,canRun=true}:{program:AutoProgram;onChange:(program:AutoProgram)=>void;onPreview:()=>void;canRun?:boolean}) {
  const [message,setMessage]=useState("");
  const add=(step:AutoStep)=>program.steps.length<128&&onChange({...program,steps:[...program.steps,step]});
  const update=(index:number,step:AutoStep)=>onChange({...program,steps:program.steps.map((old,i)=>i===index?step:old)});
  const move=(index:number,offset:number)=>{const steps=[...program.steps];[steps[index],steps[index+offset]]=[steps[index+offset],steps[index]];onChange({...program,steps});};
  const poseInputs=(p:Pose,change:(pose:Pose)=>void)=><div className="bio-row">{(["x","y","heading"] as const).map(key=><label key={key}>{key==="heading"?"Heading (rad)":key.toUpperCase()+" (m)"}<input type="number" step="0.01" value={p[key]} onChange={e=>change({...p,[key]:Number(e.target.value)})}/></label>)}</div>;
  return <section className="bio-card" aria-label="Auto editor">
    <h2>Build an auto</h2><p>Click the field to add a waypoint, or enter coordinates. Heading is in CCW radians.</p>
    <div className="bio-row"><button disabled={!canRun||!program.steps.length} onClick={()=>{try{validateAuto(program);onPreview();setMessage("AUTO running for 30 seconds. Watch the field; use Pause to pause or Return to untimed practice to drive again.");}catch(e){setMessage((e as Error).message);}}}>Run AUTO only</button>
      <button onClick={()=>{try{localStorage.setItem("ares-biobuzz-auto-v1",JSON.stringify(validateAuto(program)));setMessage("Saved on this device.");}catch(e){setMessage((e as Error).message);}}}>Save locally</button>
      <button onClick={()=>{try{onChange(validateAuto(JSON.parse(localStorage.getItem("ares-biobuzz-auto-v1")??"null")));setMessage("Loaded saved auto.");}catch(e){setMessage((e as Error).message);}}}>Load saved</button></div>
    <p role="status">{message}</p>
    {!canRun&&<p>For this online room, choose Ready with this auto. The host starts the match once everyone is ready.</p>}
    <h3>Add an action</h3>
    <div className="bio-row"><button disabled={program.steps.length>=128} onClick={()=>add({kind:"drive",target:{x:0.8,y:0.9,heading:0},preset:"safe"})}>Add waypoint</button><button disabled={program.steps.length>=128} onClick={()=>add({kind:"wait",seconds:1})}>Add wait</button><button disabled={program.steps.length>=128} onClick={()=>add({kind:"intake",enabled:true})}>Add intake</button><button disabled={program.steps.length>=128} onClick={()=>add({kind:"lockOn",enabled:true})}>Add aim lock</button><button disabled={program.steps.length>=128} onClick={()=>add({kind:"shoot",count:1,speed:5.8})}>Add shot</button></div>
    <p className="bio-help">Steps run in order. Intake and aim lock start off. Add a toggle step to switch either on or off; its setting stays active through later steps until changed or the auto ends. With aim lock on, shots wait for a clear, steady aim and use calculated power. A fixed shooter tracks the hive while driving and ignores waypoint headings. With aim lock off, shots use the current shooter direction and selected launch speed.</p>
    {!program.steps.length&&<p>Add an action above to begin. Your robot starts with four pollen balls.</p>}
    <label>Auto name<input maxLength={80} value={program.name} onChange={e=>onChange({...program,name:e.target.value})}/></label>
    <label>Authored alliance<select value={program.alliance} onChange={e=>{const alliance=e.target.value as "red"|"blue";onChange({...program,alliance,start:defaultAutoStart(alliance)});}}><option value="red">Red</option><option value="blue">Blue</option></select></label>
    <h3>Starting pose</h3>{poseInputs(program.start,start=>onChange({...program,start}))}
    <ol className="bio-steps">{program.steps.map((step,i)=><li key={i}><div className="bio-row"><strong>{i+1}. {step.kind==="lockOn"?"aim lock":step.kind}</strong><button type="button" aria-label={"Move step "+(i+1)+" up"} disabled={i===0} onClick={()=>move(i,-1)}>↑</button><button type="button" aria-label={"Move step "+(i+1)+" down"} disabled={i===program.steps.length-1} onClick={()=>move(i,1)}>↓</button><button type="button" aria-label={"Remove step "+(i+1)} onClick={()=>onChange({...program,steps:program.steps.filter((_,j)=>j!==i)})}>Remove</button></div>
      {step.kind==="drive"&&<>{poseInputs(step.target,target=>update(i,{...step,target}))}<label>Motion<select value={step.preset} onChange={e=>update(i,{...step,preset:e.target.value as "safe"|"balanced"})}><option value="safe">Safe</option><option value="balanced">Balanced</option></select></label></>}
      {step.kind==="wait"&&<label>Seconds<input type="number" min={0} max={30} step={0.1} value={step.seconds} onChange={e=>update(i,{...step,seconds:Number(e.target.value)})}/></label>}
      {step.kind==="intake"&&<div className="bio-row"><label><input type="checkbox" checked={step.enabled} onChange={e=>update(i,{...step,enabled:e.target.checked})}/> Intake enabled</label><strong aria-hidden="true">{step.enabled?"On":"Off"}</strong></div>}
      {step.kind==="lockOn"&&<div className="bio-row"><label><input type="checkbox" checked={step.enabled} onChange={e=>update(i,{...step,enabled:e.target.checked})}/> Aim lock enabled</label><strong aria-hidden="true">{step.enabled?"On":"Off"}</strong></div>}
      {step.kind==="shoot"&&<><div className="bio-row"><label>Balls<input type="number" min={1} max={4} value={step.count} onChange={e=>update(i,{...step,count:Number(e.target.value)})}/></label><label>Launch speed (m/s)<input type="number" min={2} max={5.8} step={0.01} value={step.speed} onChange={e=>update(i,{...step,speed:Number(e.target.value)})}/></label></div><p className="bio-help">Launch speed is used only when aim lock is off.</p></>}
    </li>)}</ol>
    <p>Estimated minimum {autoDuration(program.steps).toFixed(1)} seconds, plus driving and aim alignment. AUTO stops at 30 seconds.</p>
    <RobotSetupFields value={program.robotSetup??DEFAULT_ROBOT} onChange={robotSetup=>onChange({...program,robotSetup})}/>
    <p className="bio-help">Robot settings and aim lock steps are saved with the browser auto. Turret autos start at the shooter's home direction. Studio export supports the front-facing reference robot with a fixed shooter, default drive speeds, and an intake that collects pollen and nectar. Aim lock steps are available in the web simulator only.</p>
    <div className="bio-row">
      <button onClick={async()=>{try{const blob=await exportAuto(program),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="biobuzz-auto.zip";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage("Exported. Import the ZIP in ARES Studio's auto editor.");}catch(e){setMessage((e as Error).message);}}}>Export for ARES Studio</button></div>
  </section>;
}
