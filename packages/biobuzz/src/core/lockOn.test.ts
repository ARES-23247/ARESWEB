import { describe,expect,it } from "vitest";
import { Simulation } from "./engine";
import { DEFAULT_ROBOT,shooterHeading } from "./robot";
import { NEUTRAL,angle,type Input,type RobotSetup } from "./types";
import { defaultAuto } from "../AutoEditor";
import { nativeAuto,validateAuto } from "./auto";

const locked:Input={...NEUTRAL,lockOn:true,shootHeld:false,aimFlower:true};
function sim(setup:RobotSetup={...DEFAULT_ROBOT}){return new Simulation({timed:false,seats:["human","empty","empty","empty"],robotSetups:[setup]});}
function run(s:Simulation,ticks:number,input:Input=locked){for(let i=0;i<ticks;i++){s.command(0,input);s.step();}}

describe("persistent driver aim lock and held shooting",()=>{
  it.each(["front","back"] as const)("tracks with a %s fixed shooter while translating and resumes after a manual turn",shooter=>{
    const s=sim({...DEFAULT_ROBOT,shooter}),r=s.robots[0];run(s,300);
    expect(r.shotStatus).toBe("ready");const start={x:r.x,y:r.y,heading:shooterHeading(r)};
    run(s,40,{...locked,x:.25,y:-.15});
    expect(Math.hypot(r.x-start.x,r.y-start.y)).toBeGreaterThan(.1);
    expect(r.shotTarget).toBe("hive");expect(r.shotStatus).not.toBe("ready");expect(r.inventory).toHaveLength(4);
    run(s,300);expect(r.shotStatus).toBe("ready");
    expect(Math.abs(angle(shooterHeading(r)-start.heading))).toBeGreaterThan(.02);
    const heading=r.heading;run(s,25,{...locked,turn:.5});expect(r.shotStatus).toBeUndefined();expect(r.heading).not.toBeCloseTo(heading,1);
    run(s,300);expect(r.shotStatus).toBe("ready");
    run(s,30,{...locked,lockOn:false});expect(r.shotStatus).toBeUndefined();expect(r.inventory).toHaveLength(4);
  });
  it("keeps turret tracking independent and resumes after a turret override or flower placement",()=>{
    const s=sim({...DEFAULT_ROBOT,turret:true}),r=s.robots[0];run(s,180);const heading=r.heading;
    run(s,30,{...locked,x:.1});expect(r.heading).toBeCloseTo(heading,2);expect(r.shotTarget).toBe("hive");
    run(s,10,{...locked,turretTurn:1});expect(r.shotStatus).toBeUndefined();
    run(s,180);expect(r.shotStatus).toBe("ready");
    run(s,1,{...locked,deposit:true});expect(r.shotTarget).toBe("flower");
    run(s,360);expect(s.balls.some(b=>b.location==="flower"&&b.id===0)).toBe(true);expect(r.shotTarget).toBe("hive");
  });
  it("keeps a blocked lock active without falling back to a manual shot and reacquires after repositioning",()=>{
    const s=sim(),r=s.robots[0],body=s["robotBodies"].get(0)!;
    body.setTransform({x:0,y:.32385},0);s.step();run(s,120,{...locked,shoot:true,shootHeld:true});
    expect(r.shotStatus).toBe("blocked");expect(r.inventory).toHaveLength(4);
    body.setTransform({x:-1.1,y:1.5},0);s.step();run(s,300);expect(r.shotStatus).toBe("ready");expect(r.inventory).toHaveLength(4);
  });
  it.each([false,true])("repeats held shots with cooldown and stops on release, lock enabled %s",lockOn=>{
    const s=sim(),r=s.robots[0];run(s,300,{...locked,lockOn});
    run(s,25,{...locked,lockOn,shoot:true,shootHeld:true});
    expect(r.inventory).toHaveLength(2);
    const shots=s.events.filter(e=>e.message.includes("launched"));expect(shots).toHaveLength(2);expect(shots[1].tick-shots[0].tick).toBeGreaterThanOrEqual(20);
    run(s,180,{...locked,lockOn});expect(r.inventory).toHaveLength(2);
    run(s,90,{...locked,lockOn,shoot:true,shootHeld:true});expect(r.inventory).toHaveLength(0);
  });
  it("waits for alignment while Shoot is held, and does not queue a shot after release",()=>{
    const s=sim(),r=s.robots[0];run(s,2,{...locked,shoot:true,shootHeld:true});run(s,300);
    expect(r.inventory).toHaveLength(4);expect(r.shotStatus).toBe("ready");
    run(s,30,{...locked,y:-.3,shoot:true,shootHeld:true});expect(r.inventory).toHaveLength(4);
    run(s,120,{...locked,shoot:true,shootHeld:true});expect(r.inventory.length).toBeLessThan(4);
  });
  it.each(["neutral","stale","disconnect","period end"])("neutralizes aim and sustained shooting on %s",reason=>{
    const s=sim(),r=s.robots[0];run(s,300);run(s,1,{...locked,shoot:true,shootHeld:true});
    if(reason==="neutral")s.command(0,NEUTRAL);
    if(reason==="disconnect")s.setController(0,"empty");
    if(reason==="period end")s.phase="settling";
    for(let i=0;i<120;i++)s.step();
    expect(r.shotStatus).toBeUndefined();expect(s.events.filter(e=>e.message.includes("launched"))).toHaveLength(1);
  });
  it.each(["front","back"] as const)("repeats held flower placement from the %s and resumes hive lock after release",deposit=>{
    const s=sim({...DEFAULT_ROBOT,deposit}),r=s.robots[0];
    run(s,540,{...locked,deposit:true,depositHeld:true});
    expect(r.inventory).toHaveLength(0);expect(s.flowers[1].balls).toHaveLength(8);
    const shots=s.events.filter(e=>e.message.includes("launched"));expect(shots).toHaveLength(4);
    for(let i=1;i<shots.length;i++)expect(shots[i].tick-shots[i-1].tick).toBeGreaterThanOrEqual(20);
    run(s,180,{...locked,depositHeld:false});expect(r.shotTarget).toBe("hive");
  });
  it("finishes a tapped placement but stops repeating after release or motion",()=>{
    const s=sim(),r=s.robots[0];run(s,1,{...locked,deposit:true,depositHeld:true});
    run(s,300,{...locked,depositHeld:false});expect(r.inventory).toHaveLength(3);expect(s.flowers[1].balls).toHaveLength(5);
    run(s,20,{...locked,deposit:true,depositHeld:true,y:-.1});run(s,180,{...locked,depositHeld:false});
    expect(r.inventory).toHaveLength(3);
  });
  it("does not freeze a moving turret chassis or fire a fallback when flower placement is held",()=>{
    const s=sim({...DEFAULT_ROBOT,turret:true}),r=s.robots[0],y=r.y;
    run(s,30,{...locked,lockOn:false,deposit:true,depositHeld:true,shoot:true,shootHeld:true,y:-.1});
    expect(r.y).toBeLessThan(y-.03);expect(r.inventory).toHaveLength(4);expect(r.shotStatus).toBeUndefined();
  });
});

describe("autonomous actuator toggles",()=>{
  it("validates both toggle states, preserves saves, and refuses unsupported native export",()=>{
    const auto={...defaultAuto(),steps:[{kind:"lockOn",enabled:true},{kind:"intake",enabled:true},{kind:"lockOn",enabled:false},{kind:"intake",enabled:false}]};
    expect(validateAuto(JSON.parse(JSON.stringify(auto)))).toEqual(auto);
    for(const enabled of [null,undefined,1,"true"])expect(()=>validateAuto({...auto,steps:[{kind:"lockOn",enabled}]})).toThrow("Invalid auto step");
    expect(()=>nativeAuto(validateAuto(auto),"lock-test")).toThrow("Studio export does not support lock-on");
  });
  it("retains lock through driving and counts actual shots before switching off, despite neutral driver packets",()=>{
    const program=validateAuto({...defaultAuto(),steps:[{kind:"intake",enabled:true},{kind:"lockOn",enabled:true},{kind:"drive",target:{x:-.95,y:1.4,heading:2},preset:"safe"},{kind:"shoot",count:2,speed:2},{kind:"lockOn",enabled:false},{kind:"intake",enabled:false},{kind:"wait",seconds:10}]});
    const s=new Simulation({timed:true,matchMode:"auto",seats:["human","empty","empty","empty"],autos:[program]}),r=s.robots[0];
    run(s,2,NEUTRAL);expect(s["autoState"].get(0)).toMatchObject({intake:true,lockOn:true});
    run(s,720,NEUTRAL);expect(s.events.filter(e=>e.message.includes("launched"))).toHaveLength(2);expect(s.hives[0].cells[0]).toHaveLength(5);
    expect(Math.hypot(r.x+.95,r.y-1.4)).toBeLessThan(.04);expect(r.heading).not.toBeCloseTo(2,1);
    expect(s["autoState"].get(0)).toMatchObject({intake:false,lockOn:false});expect(r.shotStatus).toBeUndefined();
  });
  it("stops retained lock and intake when the routine ends",()=>{
    const program=validateAuto({...defaultAuto(),steps:[{kind:"intake",enabled:true},{kind:"lockOn",enabled:true},{kind:"wait",seconds:1}]});
    const s=new Simulation({timed:true,matchMode:"auto",seats:["human","empty","empty","empty"],autos:[program]});
    run(s,30,NEUTRAL);expect(s.robots[0].shotTarget).toBe("hive");run(s,90,NEUTRAL);
    expect(s["autoInput"](s.robots[0])).toEqual(NEUTRAL);expect(s.robots[0].shotStatus).toBeUndefined();
  });
});
