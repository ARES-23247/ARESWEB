import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { exportAuto } from "./export";
import { defaultAuto } from "./AutoEditor";
describe("BIOBUZZ native bundle",()=>{
  it("round trips both native documents and explicit blue coordinates",async()=>{
    const program=defaultAuto();program.alliance="blue";program.start={x:1.1,y:-1.6038,heading:Math.PI/2};
    program.steps=[{kind:"intake",enabled:false},{kind:"drive",target:{x:1.2,y:-1.3,heading:1},preset:"balanced"},{kind:"shoot",count:4,speed:5.5}];
    const blob=await exportAuto(program);
    const bytes=await new Promise<ArrayBuffer>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result as ArrayBuffer);reader.onerror=reject;reader.readAsArrayBuffer(blob);});
    const zip=await JSZip.loadAsync(bytes),path=Object.keys(zip.files).find(p=>p.endsWith(".aresroutine"))!;
    const routine=JSON.parse(await zip.file(path)!.async("string")),catalog=JSON.parse(await zip.file(".ares/autonomous-catalog.json")!.async("string"));
    expect(routine.schemaVersion).toBe(2);expect(catalog.schemaVersion).toBe(1);
    expect(catalog.entries[0]).toMatchObject({routineId:routine.documentId,authoredAlliance:"BLUE",mirrorForOppositeAlliance:false,startingPose:{xMeters:1.1,yMeters:-1.6038,headingRadians:Math.PI/2}});
    expect(routine.steps.filter((s:{actionKey?:string;arguments?:{value:string}})=>s.actionKey?.endsWith("transferVoltage")&&s.arguments?.value==="12")).toHaveLength(4);
    await expect(exportAuto({...program,steps:[{kind:"shoot",count:5,speed:5.8}]})).rejects.toThrow("Invalid auto step");
  });
});
