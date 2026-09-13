import { useState } from "react";
import type { AutoProgram, AutoStep, Pose } from "./core/types";
import { HALF, ROBOT_HALF } from "./core/types";
import { autoDuration, validateAuto } from "./core/auto";
import { exportAuto } from "./export";
export function defaultAutoStart(alliance:"red"|"blue"):Pose {const sign=alliance==="red"?1:-1;return {x:-1.1*sign,y:(HALF-Math.hypot(ROBOT_HALF,ROBOT_HALF))*sign,heading:alliance==="red"?-Math.PI/4:Math.PI*3/4};}
export function defaultAuto():AutoProgram {return {version:1,name:"BIOBUZZ auto",alliance:"red",start:defaultAutoStart("red"),steps:[]};}
export default function AutoEditor({program,onChange,onPreview}:{program:AutoProgram;onChange:(program:AutoProgram)=>void;onPreview:()=>void}) {
  const [message,setMessage]=useState("");
  const add=(step:AutoStep)=>program.steps.length<128&&onChange({...program,steps:[...program.steps,step]});
  const update=(index:number,step:AutoStep)=>onChange({...program,steps:program.steps.map((old,i)=>i===index?step:old)});
  const poseInputs=(p:Pose,change:(pose:Pose)=>void)=><div className="bio-row">{(["x","y","heading"] as const).map(key=><label key={key}>{key==="heading"?"Heading (rad)":key.toUpperCase()+" (m)"}<input type="number" step="0.01" value={p[key]} onChange={e=>change({...p,[key]:Number(e.target.value)})}/></label>)}</div>;
  return <section className="bio-card" aria-label="Auto editor">
    <h2>Build an auto</h2><p>Click the field to add a waypoint, or enter coordinates. Heading is in CCW radians.</p>
    <label>Auto name<input maxLength={80} value={program.name} onChange={e=>onChange({...program,name:e.target.value})}/></label>
    <label>Authored alliance<select value={program.alliance} onChange={e=>{const alliance=e.target.value as "red"|"blue";onChange({...program,alliance,start:defaultAutoStart(alliance)});}}><option value="red">Red</option><option value="blue">Blue</option></select></label>
    <h3>Starting pose</h3>{poseInputs(program.start,start=>onChange({...program,start}))}
    <ol className="bio-steps">{program.steps.map((step,i)=><li key={i}><div className="bio-row"><strong>{i+1}. {step.kind}</strong><button type="button" aria-label={"Remove step "+(i+1)} onClick={()=>onChange({...program,steps:program.steps.filter((_,j)=>j!==i)})}>Remove</button></div>
      {step.kind==="drive"&&<>{poseInputs(step.target,target=>update(i,{...step,target}))}<label>Motion<select value={step.preset} onChange={e=>update(i,{...step,preset:e.target.value as "safe"|"balanced"})}><option value="safe">Safe</option><option value="balanced">Balanced</option></select></label></>}
      {step.kind==="wait"&&<label>Seconds<input type="number" min={0} max={30} step={0.1} value={step.seconds} onChange={e=>update(i,{...step,seconds:Number(e.target.value)})}/></label>}
      {step.kind==="intake"&&<label><input type="checkbox" checked={step.enabled} onChange={e=>update(i,{...step,enabled:e.target.checked})}/> Intake enabled</label>}
      {step.kind==="shoot"&&<div className="bio-row"><label>Balls<input type="number" min={1} max={4} value={step.count} onChange={e=>update(i,{...step,count:Number(e.target.value)})}/></label><label>Launch speed (m/s)<input type="number" min={2} max={5.8} step={0.01} value={step.speed} onChange={e=>update(i,{...step,speed:Number(e.target.value)})}/></label></div>}
    </li>)}</ol>
    <div className="bio-row"><button onClick={()=>add({kind:"drive",target:{x:0.8,y:0.9,heading:0},preset:"safe"})}>Add waypoint</button><button onClick={()=>add({kind:"wait",seconds:1})}>Add wait</button><button onClick={()=>add({kind:"intake",enabled:true})}>Add intake</button><button onClick={()=>add({kind:"shoot",count:1,speed:5.8})}>Add shot</button></div>
    <p>At least {autoDuration(program.steps).toFixed(1)} seconds, plus driving. AUTO stops at 30 seconds.</p>
    <div className="bio-row"><button onClick={()=>{try{validateAuto(program);onPreview();setMessage("Running AUTO preview.");}catch(e){setMessage((e as Error).message);}}}>Preview auto</button>
      <button onClick={()=>{try{localStorage.setItem("ares-biobuzz-auto-v1",JSON.stringify(validateAuto(program)));setMessage("Saved on this device.");}catch(e){setMessage((e as Error).message);}}}>Save locally</button>
      <button onClick={()=>{try{onChange(validateAuto(JSON.parse(localStorage.getItem("ares-biobuzz-auto-v1")??"null")));setMessage("Loaded saved auto.");}catch(e){setMessage((e as Error).message);}}}>Load saved</button>
      <button onClick={async()=>{try{const blob=await exportAuto(program),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="biobuzz-auto.zip";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage("Exported. Import the ZIP in ARES Studio's auto editor.");}catch(e){setMessage((e as Error).message);}}}>Export for ARES Studio</button></div>
    <p role="status">{message}</p>
  </section>;
}
