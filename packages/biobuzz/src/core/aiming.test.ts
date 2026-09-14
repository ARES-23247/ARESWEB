import { describe,it,expect } from "vitest";
import { Simulation } from "./engine";
import { DEFAULT_ROBOT,ROBOT_LIMITS,shooterHeading,validateRobotSetup } from "./robot";
import { NEUTRAL,angle,type Input,type RobotSetup } from "./types";
import { defaultAuto } from "../AutoEditor";
import { nativeAuto,validateAuto } from "./auto";

const controls:Input={...NEUTRAL,aimHive:true,aim:false,aimFlower:true};
function sim(setup:RobotSetup={...DEFAULT_ROBOT}){return new Simulation({timed:false,seats:["human","empty","empty","empty"],robotSetups:[setup]});}
function run(s:Simulation,ticks:number,input:(tick:number)=>Input=()=>controls){for(let i=0;i<ticks;i++){s.command(0,input(i));s.step();}}

describe("separate aim and fire",()=>{
  it("aims and stays ready without firing or expiring while input is fresh",()=>{
    const s=sim(),r=s.robots[0],start=r.heading;
    run(s,720,i=>({...controls,aim:i===0}));
    expect(r.shotStatus).toBe("ready");expect(r.heading).not.toBeCloseTo(start,1);
    expect(r.inventory).toHaveLength(4);expect(s.events.filter(e=>e.type==="shot")).toHaveLength(0);
    expect(r.shotSpeed).toBeGreaterThanOrEqual(2);expect(r.shotSpeed).toBeLessThanOrEqual(5.8);
  });
  it("does not queue an early fire press and fires once when ready, even if held",()=>{
    const s=sim(),r=s.robots[0],ball=s.balls[r.inventory[0]];
    run(s,240,i=>({...controls,aim:i===0,shoot:i===1}));
    expect(r.shotStatus).toBe("ready");expect(r.inventory).toHaveLength(4);
    run(s,180,()=>({...controls,shoot:true}));
    expect(ball.location).toBe("hive");expect(r.inventory).toHaveLength(3);
    expect(s.events.filter(e=>e.message.includes("launched"))).toHaveLength(1);expect(r.shotStatus).toBe("ready");
  });
  it("retains one coalesced Aim press but never interprets it as Shoot",()=>{
    const s=sim();s.command(0,{...controls,aim:true});s.command(0,controls);s.step();
    run(s,240);expect(s.robots[0].shotStatus).toBe("ready");expect(s.robots[0].inventory).toHaveLength(4);
    s.command(0,{...controls,aim:true});s.command(0,controls);s.step();
    expect(s.robots[0].shotStatus).toBeUndefined();
  });
  it.each(["aim again","drive","neutral","stale","disconnect","period end"])("cancels held aim on %s",reason=>{
    const s=sim(),r=s.robots[0];run(s,240,i=>({...controls,aim:i===0}));expect(r.shotStatus).toBe("ready");
    if(reason==="aim again")run(s,1,()=>({...controls,aim:true}));
    if(reason==="drive")run(s,1,()=>({...controls,x:.2}));
    if(reason==="neutral")run(s,1,()=>({...NEUTRAL}));
    if(reason==="stale")for(let i=0;i<16;i++)s.step();
    if(reason==="disconnect")s.setController(0,"standard");
    if(reason==="period end"){s.phase="settling";s.step();}
    expect(r.shotStatus).toBeUndefined();expect(r.shotSpeed).toBeUndefined();expect(r.inventory).toHaveLength(4);
  });
  it("still permits a manual shot without first enabling Aim",()=>{
    const s=sim(),r=s.robots[0],ball=s.balls[r.inventory[0]],start=r.heading;
    run(s,1,()=>({...controls,shoot:true,speed:2}));
    expect(ball.location).toBe("air");expect(r.heading).toBeCloseTo(start);expect(r.inventory).toHaveLength(3);
  });
  it.each([0,2,6,10,14])("accepts a rear shot %i ticks after a Ready snapshot without losing the click",delay=>{
    const s=sim({...DEFAULT_ROBOT,shooter:"back",deposit:"back",intake:"both"}),r=s.robots[0];
    const placed=s.balls[r.inventory[0]];run(s,1,()=>({...controls,deposit:true}));
    for(let i=0;i<300&&placed.location!=="flower";i++)run(s,1);
    expect(placed.location).toBe("flower");expect(r.inventory).toHaveLength(3);
    run(s,1,()=>({...controls,aim:true}));
    for(let i=0;i<300&&r.shotStatus!=="ready";i++)run(s,1);
    expect(r.shotStatus).toBe("ready");run(s,delay);
    s.command(0,{...controls,shoot:true});s.command(0,controls);s.step();run(s,180);
    expect(r.inventory).toHaveLength(2);expect(s.hives[0].cells[0]).toHaveLength(4);
  });
  it.each([false,true])("rechecks a recent Ready fire press after contact, with neutral cancellation %s",cancel=>{
    const s=sim(),r=s.robots[0];run(s,240,i=>({...controls,aim:i===0}));expect(r.shotStatus).toBe("ready");
    s["robotBodies"].get(0)!.setLinearVelocity({x:.05,y:0});
    run(s,1,()=>({...controls,shoot:true}));expect(r.inventory).toHaveLength(4);
    run(s,180,()=>cancel?{...NEUTRAL}:controls);
    expect(r.inventory).toHaveLength(cancel?4:3);
  });
});

describe("turret and drivetrain configuration",()=>{
  it("validates optional settings, keeps legacy defaults, and rejects malformed or out-of-range values",()=>{
    expect(validateRobotSetup(DEFAULT_ROBOT)).toEqual(DEFAULT_ROBOT);
    const setup={...DEFAULT_ROBOT,turret:true,driveSpeed:3,turnSpeed:2*Math.PI};expect(validateRobotSetup(setup)).toEqual(setup);
    for(const key of ["driveSpeed","turnSpeed"] as const)for(const value of [null,"2",NaN,Infinity,-1,0,ROBOT_LIMITS[key].max+.01])expect(()=>validateRobotSetup({...DEFAULT_ROBOT,[key]:value})).toThrow();
    for(const turret of [1,"yes",null])expect(()=>validateRobotSetup({...DEFAULT_ROBOT,turret})).toThrow();
    expect(validateRobotSetup({...DEFAULT_ROBOT,turret:false,driveSpeed:.25,turnSpeed:Math.PI/6})).toMatchObject({turret:false,driveSpeed:.25});
  });
  it.each(["front","back"] as const)("automatically locks the %s-home turret without an Aim press and scores only on Shoot",shooter=>{
    const s=sim({...DEFAULT_ROBOT,shooter,turret:true}),r=s.robots[0];run(s,30);
    const start={x:r.x,y:r.y,heading:r.heading},ball=s.balls[r.inventory[0]];
    run(s,240);
    expect(r.shotStatus).toBe("ready");expect(r.inventory).toHaveLength(4);expect(r.turretAngle).not.toBeCloseTo(0,1);
    expect(r.heading).toBeCloseTo(start.heading,5);expect(r.x).toBeCloseTo(start.x,5);expect(r.y).toBeCloseTo(start.y,5);
    run(s,120,i=>({...controls,shoot:i===0}));expect(ball.location).toBe("hive");expect(r.inventory).toHaveLength(3);
  });
  it("tracks independently while the chassis turns and stops aiming when the turret is manually driven",()=>{
    const s=sim({...DEFAULT_ROBOT,turret:true}),r=s.robots[0],start=r.heading;
    // Clear the starting wall so chassis rotation can be checked without contact.
    s["robotBodies"].get(0)!.setTransform({x:-1.1,y:1.35},start);s.step();
    run(s,60,()=>({...controls,turn:.15}));
    expect(Math.abs(angle(r.heading-start))).toBeGreaterThan(.2);expect(r.inventory).toHaveLength(4);
    run(s,180);expect(r.shotStatus).toBe("ready");
    const previous=r.turretAngle!;run(s,10,()=>({...controls,turretTurn:.5}));
    expect(r.shotStatus).toBeUndefined();expect(angle(r.turretAngle!-previous)).toBeCloseTo(.5*Math.PI*10/60,5);
    const before=r.turretAngle;run(s,30,()=>({...NEUTRAL}));expect(r.turretAngle).toBe(before);
    run(s,240);expect(r.shotStatus).toBe("ready");expect(r.inventory).toHaveLength(4);
  });
  it("launches manual shots along the bounded turret angle and leaves flower placement on the chassis",()=>{
    const s=sim({...DEFAULT_ROBOT,turret:true,deposit:"back"}),r=s.robots[0];
    run(s,40,()=>({...controls,turretTurn:1}));const heading=shooterHeading(r),ball=s.balls[r.inventory[0]];
    run(s,1,()=>({...controls,aimHive:false,shoot:true}));
    expect(ball.x-r.x).toBeCloseTo(Math.cos(heading)*.28,5);expect(ball.y-r.y).toBeCloseTo(Math.sin(heading)*.28,5);
    const flowerBall=s.balls[r.inventory[0]],turretAngle=r.turretAngle;
    run(s,300,i=>({...controls,deposit:i===0}));
    expect(flowerBall.location).toBe("flower");expect(r.turretAngle).toBe(turretAngle);
  });
  it("keeps automatic lock cancelled until Aim is pressed again, including after manual power",()=>{
    const s=sim({...DEFAULT_ROBOT,turret:true}),r=s.robots[0];run(s,240);expect(r.shotStatus).toBe("ready");
    run(s,240,i=>({...controls,aim:i===0}));expect(r.shotStatus).toBeUndefined();expect(r.inventory).toHaveLength(4);
    run(s,240,i=>({...controls,aim:i===0}));expect(r.shotStatus).toBe("ready");
    run(s,30,()=>({...controls,aimHive:false}));expect(r.shotStatus).toBeUndefined();
    run(s,240,i=>({...controls,aim:i===0}));expect(r.shotStatus).toBe("ready");
  });
  it("does not reinterpret a held Aim or Shoot as a new press after a stale-input gap",()=>{
    const s=sim({...DEFAULT_ROBOT,turret:true}),r=s.robots[0];run(s,240);
    run(s,1,()=>({...controls,aim:true}));run(s,1); // Cancel, then release.
    run(s,240,()=>({...controls,aim:true}));expect(r.shotStatus).toBe("ready");
    for(let i=0;i<16;i++)s.step();expect(r.shotStatus).toBeUndefined();
    run(s,240,()=>({...controls,aim:true}));expect(r.shotStatus).toBe("ready");
    run(s,120,()=>({...controls,shoot:true}));expect(r.inventory).toHaveLength(3);
    for(let i=0;i<16;i++)s.step();expect(r.shotStatus).toBeUndefined();
    run(s,120,()=>({...controls,shoot:true}));expect(r.inventory).toHaveLength(3);
  });
  it("places a flower while locked, then automatically reacquires the hive without firing",()=>{
    const s=sim({...DEFAULT_ROBOT,turret:true}),r=s.robots[0],ball=s.balls[r.inventory[0]];
    run(s,240);expect(r.shotStatus).toBe("ready");
    run(s,600,i=>({...controls,deposit:i===0}));
    expect(ball.location).toBe("flower");expect(r.shotTarget).toBe("hive");expect(r.shotStatus).toBe("ready");
    expect(r.inventory).toHaveLength(3);
  });
  it.each(["neutral","stale","transition","settling","interrupted"])("neutralizes automatic turret tracking on %s",reason=>{
    const s=sim({...DEFAULT_ROBOT,turret:true}),r=s.robots[0];run(s,240);expect(r.shotStatus).toBe("ready");
    if(reason==="neutral")run(s,30,()=>({...NEUTRAL}));
    else if(reason==="stale")for(let i=0;i<16;i++)s.step();
    else if(reason==="interrupted")s.interrupt();
    else{s.phase=reason as "transition"|"settling";s.step();}
    expect(r.shotStatus).toBeUndefined();const before=r.turretAngle;
    for(let i=0;i<10;i++)s.step();expect(r.turretAngle).toBe(before);expect(r.inventory).toHaveLength(4);
  });
  it("does not fire a manual fallback when automatic lock has no clear trajectory",()=>{
    const s=sim({...DEFAULT_ROBOT,turret:true}),r=s.robots[0];
    s["robotBodies"].get(0)!.setTransform({x:0,y:.32385},0);s.step();
    run(s,1,()=>({...controls,shoot:true}));
    expect(r.shotStatus).toBe("blocked");expect(r.inventory).toHaveLength(4);
    s["robotBodies"].get(0)!.setTransform({x:-1.1,y:1.35},0);s.step();
    run(s,240);expect(r.shotStatus).toBe("ready");expect(r.inventory).toHaveLength(4);
  });
  it("keeps an empty turret pointed at the hive and becomes ready after collecting a ball",()=>{
    const s=sim({...DEFAULT_ROBOT,turret:true}),r=s.robots[0],ball=s.balls[r.inventory[0]];
    for(const id of [...r.inventory]){s["detach"](s.balls[id]);s.balls[id].location="reserve";}
    run(s,240);expect(r.turretAngle).not.toBe(0);expect(r.shotStatus).toBe("aiming");
    s["store"](ball,"robot",r.id);run(s,240);
    expect(r.shotStatus).toBe("ready");expect(r.inventory).toHaveLength(1);
  });
  it.each([.25,1.8,3])("honors a %.2f m/s chassis limit with gradual acceleration",driveSpeed=>{
    const s=sim({...DEFAULT_ROBOT,driveSpeed}),body=s["robotBodies"].get(0)!;
    body.setTransform({x:-1.5,y:1.25},0);s.step();run(s,1,()=>({...controls,x:1}));
    expect(body.getLinearVelocity().length()).toBeLessThan(.09);
    run(s,59,()=>({...controls,x:1}));
    expect(body.getLinearVelocity().x).toBeCloseTo(driveSpeed,1);expect(body.getLinearVelocity().length()).toBeLessThanOrEqual(driveSpeed+1e-6);
  });
  it.each([Math.PI/6,3.2,2*Math.PI])("honors a %.2f rad/s turn limit",turnSpeed=>{
    const s=sim({...DEFAULT_ROBOT,turnSpeed}),body=s["robotBodies"].get(0)!;
    body.setTransform({x:1.15,y:0},0);s.step();run(s,120,()=>({...controls,turn:1}));
    expect(body.getAngularVelocity()).toBeCloseTo(turnSpeed,3);
  });
  it.each(["front","back"] as const)("finishes %s flower placement at the slowest supported turn speed",deposit=>{
    const s=sim({...DEFAULT_ROBOT,deposit,turnSpeed:ROBOT_LIMITS.turnSpeed.min}),r=s.robots[0],ball=s.balls[r.inventory[0]];
    run(s,1000,i=>({...controls,deposit:i===0}));
    expect(ball.location).toBe("flower");expect(s.flowers[1].balls).toContain(ball.id);expect(r.inventory).toHaveLength(3);
    expect(r.shotStatus).toBeUndefined();expect(s.balls).toHaveLength(56);
  });
  it.each(["front","back"] as const)("finishes a legacy %s assisted hive shot at the slowest turn speed",shooter=>{
    const s=sim({...DEFAULT_ROBOT,shooter,turnSpeed:ROBOT_LIMITS.turnSpeed.min}),r=s.robots[0],ball=s.balls[r.inventory[0]];
    run(s,1000,i=>({...NEUTRAL,aimHive:true,shoot:i===0}));
    expect(ball.location).toBe("hive");expect(r.inventory).toHaveLength(3);expect(r.shotStatus).toBeUndefined();
  });
  it("saves custom configuration in browser autos and refuses incompatible native exports",()=>{
    const auto=defaultAuto();auto.robotSetup={...DEFAULT_ROBOT,turret:true,driveSpeed:2.2,turnSpeed:Math.PI};
    expect(validateAuto(auto).robotSetup).toEqual(auto.robotSetup);expect(()=>nativeAuto(auto,"turret")).toThrow(/reference robot/);
    for(const key of ["driveSpeed","turnSpeed"] as const){auto.robotSetup={...DEFAULT_ROBOT,[key]:ROBOT_LIMITS[key].min};expect(()=>nativeAuto(auto,"slow")).toThrow(/default drive speeds/);}
    auto.robotSetup={...DEFAULT_ROBOT,turret:false,driveSpeed:1.8,turnSpeed:3.2};expect(nativeAuto(auto,"reference").routine.schemaVersion).toBe(2);
  });
  it("runs alliance bots with turrets through the same collection and scoring physics",()=>{
    const setup={...DEFAULT_ROBOT,turret:true};
    const s=new Simulation({timed:true,seats:["standard","empty","standard","empty"],robotSetups:[setup,null,setup,null]});
    for(let i=0;i<10080;i++)s.step();
    expect(s.phase).toBe("finished");expect(s.hives.every(h=>h.tips>=1)).toBe(true);
    expect(s.robots.every(r=>r.inventory.length<=4)).toBe(true);expect(s.balls).toHaveLength(56);
  },30000);
});
