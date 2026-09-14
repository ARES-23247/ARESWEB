import { describe,it,expect } from "vitest";
import { Simulation } from "./engine";
import { DEFAULT_ROBOT,validateRobotSetup,sideAngle } from "./robot";
import { planFlowerShot,clearFlowerShot } from "./shooting";
import { nativeAuto,validateAuto } from "./auto";
import { defaultAuto } from "../AutoEditor";
import { NEUTRAL,angle,type Input,type RobotSetup } from "./types";
const run=(s:Simulation,n:number,input:(tick:number)=>Input)=>{for(let i=0;i<n;i++){s.command(0,input(i));s.step();}};
describe("configurable BIOBUZZ mechanisms",()=>{
  it("validates all twelve layouts and copies defaults without accepting invalid sides",()=>{
    for(const shooter of ["front","back"] as const)for(const deposit of ["front","back"] as const)for(const intake of ["front","back","both"] as const){
      const setup={shooter,deposit,intake};expect(validateRobotSetup(setup)).toEqual(setup);
    }
    const original=validateRobotSetup(undefined);original.intake="both";expect(validateRobotSetup(null)).toEqual(DEFAULT_ROBOT);
    for(const bad of [4,"front",[],{}, {...DEFAULT_ROBOT,shooter:"both"},{...DEFAULT_ROBOT,deposit:"left"},{...DEFAULT_ROBOT,intake:true}])expect(()=>validateRobotSetup(bad)).toThrow();
  });
  it.each(["front","back"] as const)("launches from the %s and still aligns an assisted hive shot",side=>{
    const s=new Simulation({timed:false,seats:["human","empty","empty","empty"],robotSetups:[{...DEFAULT_ROBOT,shooter:side}]}),r=s.robots[0],b=s.balls[r.inventory[0]];
    s.command(0,{...NEUTRAL,shoot:true});s.step();
    const a=r.heading+sideAngle(side);
    expect(b.x-r.x).toBeCloseTo(Math.cos(a)*.28);expect(b.y-r.y).toBeCloseTo(Math.sin(a)*.28);
    expect(b.vx*Math.cos(a)+b.vy*Math.sin(a)).toBeGreaterThan(0);
    const ball=s.balls[r.inventory[0]];
    run(s,300,i=>({...NEUTRAL,aimHive:true,shoot:i===1}));
    expect(ball.location).toBe("hive");expect(r.inventory).toHaveLength(2);
  });
  it.each(["front","back","both"] as const)("collects from %s with one shared four-ball capacity",intake=>{
    const s=new Simulation({timed:false,seats:["human","empty","empty","empty"],robotSetups:[{...DEFAULT_ROBOT,intake}]}),r=s.robots[0];
    const ids=[...r.inventory];for(const id of ids){s["detach"](s.balls[id]);s.balls[id].location="reserve";}
    s["robotBodies"].get(0)!.setTransform({x:1.1,y:0},0);
    s["floor"](s.balls[ids[0]],1.45,0);s["floor"](s.balls[ids[1]],.75,0);
    run(s,30,()=>({...NEUTRAL,intake:true}));
    expect(r.inventory).toEqual(intake==="front"?[ids[0]]:intake==="back"?[ids[1]]:[ids[0],ids[1]]);
    while(r.inventory.length<3)s["store"](s.balls.find(b=>b.location==="reserve"&&b.kind==="pollen")!,"robot",0);
    const extras=s.balls.filter(b=>b.location==="reserve"&&b.kind==="pollen").slice(0,2);
    s["floor"](extras[0],1.45,0);s["floor"](extras[1],.75,0);
    run(s,30,()=>({...NEUTRAL,intake:true}));expect(r.inventory).toHaveLength(4);expect(s.balls).toHaveLength(56);
  });
  it.each(["front","back"] as const)("places pollen through a flower's top using the %s mechanism",deposit=>{
    const s=new Simulation({timed:false,seats:["human","empty","empty","empty"],robotSetups:[{...DEFAULT_ROBOT,deposit}]}),r=s.robots[0],f=s.flowers[0],ball=s.balls[r.inventory[0]];
    s["robotBodies"].get(0)!.setTransform({x:f.x-.7,y:f.y},Math.PI/2);s.step();
    const plan=planFlowerShot(r,ball.kind,s.hives,s.flowers,s.balls);expect(plan).not.toBeNull();
    run(s,300,i=>({...NEUTRAL,aimFlower:true,deposit:i===0}));
    expect(ball.location).toBe("flower");expect(ball.container).toBe(0);expect(f.balls).toHaveLength(5);
    expect(Math.abs(angle(r.heading+sideAngle(deposit)))).toBeLessThan(.02);expect(r.inventory).toHaveLength(3);
  });
  it("keeps flower placement physical, rejects full/far flowers, and cancels on neutral controls",()=>{
    const s=new Simulation(),r=s.robots[0],ball=s.balls[r.inventory[0]];
    const plan=planFlowerShot(r,ball.kind,s.hives,s.flowers,s.balls)!;expect(plan).not.toBeNull();
    expect(clearFlowerShot(r,ball.kind,{...plan,heading:Math.PI},s.hives,s.flowers[plan.flower])).toBe(false);
    expect(planFlowerShot({x:0,y:0,heading:0},ball.kind,s.hives,s.flowers,s.balls)).toBeNull();
    s.command(0,{...NEUTRAL,aimFlower:true,deposit:true});s.step();expect(r.shotTarget).toBe("flower");
    s.command(0,{...NEUTRAL});s.step();expect(r.shotStatus).toBeUndefined();expect(r.inventory).toHaveLength(4);
    for(const f of s.flowers)while(f.balls.length<8)s["store"](s.balls.find(b=>b.location==="reserve")!,"flower",s.flowers.indexOf(f));
    expect(planFlowerShot(r,ball.kind,s.hives,s.flowers,s.balls)).toBeNull();
  });
  it("preserves the nectar bottom obstruction with a rear intake",()=>{
    const s=new Simulation({timed:false,seats:["human","empty","empty","empty"],robotSetups:[{...DEFAULT_ROBOT,intake:"back"}]}),r=s.robots[0],f=s.flowers[0];
    for(const id of [...r.inventory,...f.balls]){s["detach"](s.balls[id]);s.balls[id].location="reserve";}
    const n=s.balls.find(b=>b.kind==="red"&&b.location==="reserve")!,p=s.balls.find(b=>b.kind==="pollen"&&b.location==="reserve")!;
    s["store"](n,"flower",0);s["store"](p,"flower",0);s["robotBodies"].get(0)!.setTransform({x:f.x-.4,y:f.y},Math.PI);
    run(s,30,()=>({...NEUTRAL,intake:true}));expect(r.inventory).toHaveLength(0);expect(f.balls).toEqual([n.id,p.id]);
    s["detach"](n);n.location="reserve";run(s,15,()=>({...NEUTRAL,intake:true}));expect(r.inventory).toEqual([p.id]);
  });
  it("saves layouts with browser autos and prevents incompatible native exports",()=>{
    const setup:RobotSetup={shooter:"back",deposit:"front",intake:"both"},program={...defaultAuto(),robotSetup:setup};
    expect(validateAuto(program).robotSetup).toEqual(setup);
    const s=new Simulation({timed:true,seats:["human","empty","empty","empty"],autos:[program]});expect(s.robots[0].setup).toEqual(setup);
    expect(()=>nativeAuto(program,"custom")).toThrow("front-facing");
    expect(nativeAuto({...program,robotSetup:{...DEFAULT_ROBOT}},"reference").routine.schemaVersion).toBe(2);
  });
  it("scores placed nectar while applying the early TELEOP penalty",()=>{
    const s=new Simulation({timed:true,seats:["human","empty","empty","empty"],robotSetups:[{...DEFAULT_ROBOT,deposit:"back"}]}),r=s.robots[0],f=s.flowers[0];
    for(const id of [...r.inventory]){s["detach"](s.balls[id]);s.balls[id].location="reserve";}
    const nectar=s.balls.find(b=>b.kind==="red"&&b.location==="reserve")!;s["store"](nectar,"robot",0);
    s.phase="teleop";s.tick=38*60;s["robotBodies"].get(0)!.setTransform({x:f.x-.7,y:f.y},Math.PI);s.step();
    run(s,240,i=>({...NEUTRAL,aimFlower:true,deposit:i===0}));
    expect(nectar.location).toBe("flower");expect(s.tally.red.majorFouls).toBe(1);expect(s.snapshot().tally.flowers[0]).toContain("red");
  });
});
