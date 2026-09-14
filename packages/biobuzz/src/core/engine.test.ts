import { describe,it,expect } from "vitest";
import { Simulation, tipLoad, flowerStack, parked } from "./engine";
import { BALL, HALF, NEUTRAL, startingPose } from "./types";
import { defaultAuto } from "../AutoEditor";
import { nativeAuto, validateAuto, autoDuration } from "./auto";
import { navigation, shotSpeed } from "./bots";
const advance=(s:Simulation,n:number)=>{for(let i=0;i<n;i++)s.step();};
const empty=()=>new Simulation({timed:false,seats:["empty","empty","empty","empty"]});
describe("BIOBUZZ physics and rules",()=>{
 it("blocks bottom retrieval at nectar and releases pollen above it only after the obstruction is removed",()=>{
  const s=new Simulation(),r=s.robots[0],f=s.flowers[0];
  for(const id of [...r.inventory,...f.balls]){s["detach"](s.balls[id]);s.balls[id].location="reserve";}
  const nectar=s.balls.find(b=>b.kind==="red"&&b.location==="reserve")!,pollen=s.balls.find(b=>b.kind==="pollen"&&b.location==="reserve")!;
  s["store"](nectar,"flower",0);s["store"](pollen,"flower",0);
  s["robotBodies"].get(0)!.setTransform({x:f.x-0.4,y:f.y},0);
  for(let i=0;i<30;i++){s.command(0,{...NEUTRAL,intake:true});s.step();}
  expect(r.inventory).toHaveLength(0);expect(f.balls).toEqual([nectar.id,pollen.id]);
  s["detach"](nectar);nectar.location="reserve";
  s.command(0,{...NEUTRAL,intake:true});s.step();expect(r.inventory).toEqual([pollen.id]);
 });
 it("resolves two robots competing for one ball and keeps their colliding bodies separate",()=>{
  const s=new Simulation({timed:false,seats:["human","empty","human","empty"]});
  for(const r of s.robots){const b=s.balls[r.inventory[0]];s["detach"](b);b.location="reserve";s["robotBodies"].get(r.id)!.setTransform({x:1.2,y:r.id===0?0.27:-0.27},r.id===0?-Math.PI/2:Math.PI/2);}
  const contested=s.balls.find(b=>b.kind==="pollen"&&b.location==="reserve")!;s["floor"](contested,1.2,0);
  s.command(0,{...NEUTRAL,intake:true});s.command(2,{...NEUTRAL,intake:true});s.step();
  expect(s.robots.filter(r=>r.inventory.includes(contested.id))).toHaveLength(1);expect(s.robots.map(r=>r.inventory.length).sort()).toEqual([3,4]);
  for(let i=0;i<60;i++){s.command(0,{...NEUTRAL,y:-1});s.command(2,{...NEUTRAL,y:1});s.step();}
  expect(Math.abs(s.robots[0].y-s.robots[1].y)).toBeGreaterThan(0.43);expect(s.balls).toHaveLength(56);
 });
 it("counts only real robot contacts and applies all deterministic pin resets",()=>{
  const s=new Simulation({timed:false,seats:["human","empty","human","empty"]}),a=s.robots[0],b=s.robots[1];
  const position=(x:number,y:number)=>{s["robotBodies"].get(0)!.setTransform({x,y},0);s["robotBodies"].get(2)!.setTransform({x:x+0.44,y},0);s.world.step(1/60);Object.assign(a,{x,y,heading:0});Object.assign(b,{x:x+0.44,y,heading:0});};
  position(-1,0.9);
  const inputs=new Map([[0,{...NEUTRAL,x:1}],[2,{...NEUTRAL}]]);
  for(let i=0;i<180;i++)s["contactRules"](inputs);
  expect(s.tally.red.majorFouls).toBe(0);s["contactRules"](inputs);expect(s.tally.red.majorFouls).toBe(1);
  for(let i=0;i<180;i++)s["contactRules"](inputs);expect(s.tally.red.majorFouls).toBe(2);
  // Move the pinner two feet from its own initial position, then return before reset.
  a.x-=0.7;s["contactRules"](inputs);expect(s["pins"].get("0:2")?.clear).toBe(1);
  a.x+=0.7;s["contactRules"](inputs);expect(s["pins"].get("0:2")?.clear).toBe(0);
  // Reverse pressure pins the former pinner and ends its count (G421.C).
  s["contactRules"](new Map([[0,{...NEUTRAL}],[2,{...NEUTRAL,x:-1}]]));expect(s["pins"].has("0:2")).toBe(false);
  b.x+=0.7;for(let i=0;i<181;i++)s["contactRules"](new Map([[0,{...NEUTRAL}],[2,{...NEUTRAL}]]));expect(s["pins"].size).toBe(0);
  // Nearby diagonals without touching never count as interference.
  s.phase="auto";position(-1,-0.8);s["robotBodies"].get(2)!.setTransform({x:-0.5,y:-0.5},0);s.world.step(1/60);b.x=-0.5;b.y=-0.5;
  const before=s.tally.red.majorFouls;s["contactRules"](inputs);expect(s.tally.red.majorFouls).toBe(before);
  position(-1,-0.8);s["contactRules"](inputs);s["contactRules"](inputs);expect(s.tally.red.majorFouls).toBe(before+1);
 });
 it("retains all 56 identities and allocates exactly four preloads per active robot",()=>{
  const s=new Simulation();expect(s.balls).toHaveLength(56);expect(s.robots).toHaveLength(1);expect(s.robots[0].inventory).toHaveLength(4);
  expect(s.balls.filter(b=>b.kind==="pollen")).toHaveLength(40);expect(s.flowers.map(f=>f.balls.length)).toEqual([4,4,4,4]);
  expect(s.snapshot().score.red.total).toBe(10);expect(new Set(s.balls.map(b=>b.id)).size).toBe(56);
 });
 it.each([[0,8],[1,7],[2,5],[3,4],[4,2],[5,0]])("tips at mixed load %i nectar + %i pollen",(n,p)=>{
  expect(tipLoad([...Array(n).fill("red"),...Array(p).fill("pollen")])).toBe(true);
  if(p)expect(tipLoad([...Array(n).fill("red"),...Array(p-1).fill("pollen")])).toBe(false);
 });
 it("moves through Planck contacts and neutralizes stale commands",()=>{
  const s=new Simulation(),r=s.robots[0],start=r.y;
  for(let i=0;i<60;i++){s.command(0,{...NEUTRAL,y:-1});s.step();}
  expect(r.y).toBeLessThan(start-0.5);advance(s,60);expect(s["robotBodies"].get(0)!.getLinearVelocity().length()).toBeLessThan(0.05);
  s.command(0,{...NEUTRAL,x:NaN});advance(s,20);expect(Number.isFinite(r.x)).toBe(true);
 });
 it("neutralizes commands on bot substitution and keeps out-of-bounds recovery clear of robots",()=>{
  const s=new Simulation();s.command(0,{...NEUTRAL,x:1});s.setController(0,"standard");expect(s.robots[0].controller).toBe("standard");
  s.setController(0,"human");s.setController(9,"human");
  const p=s.balls.find(b=>b.kind==="pollen"&&b.location==="reserve")!;
  s["airborne"](p,HALF+0.1,0,1,0,0,0);s.step();advance(s,125);expect(p.location).toBe("floor");
 });
 it("does not drive through the perimeter",()=>{
  const s=new Simulation();for(let i=0;i<300;i++){s.command(0,{...NEUTRAL,y:1});s.step();}
  expect(s.robots[0].y).toBeLessThan(HALF-0.21);
 });
 it("launches by applied control, cannot intake a fifth ball, and retrieves floor balls",()=>{
  const s=new Simulation(),r=s.robots[0];
  s.command(0,{...NEUTRAL,intake:true});advance(s,2);expect(r.inventory).toHaveLength(4);
  s.command(0,{...NEUTRAL,shoot:true,speed:3.08});s.step();expect(r.inventory).toHaveLength(3);expect(s.balls.some(b=>b.location==="air")).toBe(true);
  const b=s.balls.find(b=>b.kind==="pollen"&&b.location==="reserve")!;s["floor"](b,r.x+Math.cos(r.heading)*0.27,r.y+Math.sin(r.heading)*0.27);
  s.command(0,{...NEUTRAL,intake:true});s.step();expect(r.inventory).toHaveLength(4);
 });
 it("retains nectar at the flower bottom and only counts balls overlapping the scoring volume",()=>{
  const s=empty(),f=s.flowers[0],n=s.balls.find(b=>b.kind==="red"&&b.location==="reserve")!;
  for(const id of [...f.balls])s["detach"](s.balls[id]);s["store"](n,"flower",0);
  const pollen=s.balls.find(b=>b.kind==="pollen"&&b.location==="reserve")!;s["store"](pollen,"flower",0);
  expect(flowerStack(s.balls,f.balls)[0].scoring).toBe(true);expect(s.snapshot().score.flowers[0].owner).toBe("red");
  expect(BALL.red.diameter).toBeGreaterThan(0.09017);
 });
 it("captures a descending flower shot and applies the early nectar major foul",()=>{
  const s=new Simulation({timed:true,seats:["empty","empty","empty","empty"]}),f=s.flowers[0];
  const b=s.balls.find(b=>b.kind==="blue"&&b.location==="reserve")!;
  s["airborne"](b,f.x,f.y,0.7,0,0,-1);advance(s,15);
  expect(b.location).toBe("flower");expect(s.tally.blue.majorFouls).toBe(1);expect(s.snapshot().score.red.penalties).toBe(20);
 });
 it("tips both ways only on completed motion and spills conserved balls",()=>{
  const s=empty(),h=s.hives[0];
  const add=()=>{for(const b of s.balls.filter(b=>b.kind==="pollen"&&b.location==="reserve").slice(0,4))s["store"](b,"hive",h.upward);};
  add();advance(s,20);expect(h.tipping).toBe(true);expect(h.tips).toBe(0);advance(s,40);expect(h.upward).toBe(1);expect(h.tips).toBe(1);
  for(const b of s.balls.filter(b=>b.kind==="pollen").slice(0,8))s["store"](b,"hive",1);
  advance(s,60);expect(h.upward).toBe(0);expect(h.tips).toBe(2);expect(s.balls).toHaveLength(56);
 });
 it("enforces nectar release credits and final-minute release",()=>{
  const s=new Simulation({timed:true,seats:["empty","empty","empty","empty"]});expect(s.release("red")).toBe(false);
  s.tick=2280;s.phase="teleop";expect(s.release("red")).toBe(false);s.credits.red=1;expect(s.release("red")).toBe(true);expect(s.credits.red).toBe(0);
  s.tick=5880;expect(s.release("blue")).toBe(true);
 });
 it("returns escaped pollen and nectar through their different legal paths",()=>{
  const s=empty(),p=s.balls[0],n=s.balls.find(b=>b.kind==="red")!;
  s["airborne"](p,HALF+0.1,0,1,0,0,0);s["airborne"](n,HALF+0.1,0,1,0,0,0);s.step();
  expect(p.location).toBe("out");expect(n.location).toBe("out");advance(s,122);
  expect(p.location).toBe("floor");expect(n.location).toBe("reserve");
 });
 it("assesses AUTO at its boundary, disables transition, and produces a settled final score",()=>{
  const s=new Simulation({timed:true,seats:["human","empty","empty","empty"]});
  advance(s,1800);expect(s.phase).toBe("transition");expect(s.tally.red.leave).toBe(0);
  const x=s.robots[0].x;s.command(0,{...NEUTRAL,x:1});advance(s,480);expect(s.phase).toBe("teleop");expect(s.robots[0].x).toBeCloseTo(x,2);
  advance(s,7200);expect(s.phase).toBe("settling");advance(s,35);expect(s.phase).toBe("finished");
 });
 it("recognizes partial parking and interrupts safely",()=>{
  const s=new Simulation(),r=s.robots[0];r.x=0.9;r.y=1.5;expect(parked(r)).toBe(true);
  s.interrupt();s.step();expect(s.phase).toBe("interrupted");expect(s.tick).toBe(0);
 });
 it("runs bots through the same driving and shooting interfaces",()=>{
  const s=new Simulation({timed:false,seats:["standard","easy","standard","easy"]});advance(s,1200);
  expect(s.robots.some(r=>Math.hypot(r.x-startingPose(r.id).x,r.y-startingPose(r.id).y)>0.3)).toBe(true);
  expect(s.balls).toHaveLength(56);expect(s.robots.every(r=>r.inventory.length<=4)).toBe(true);
 });
 it("completes a four-bot match with both hive and flower scoring",()=>{
  const s=new Simulation({timed:true,seats:["standard","standard","standard","standard"]});advance(s,10080);
  const final=s.snapshot();expect(final.phase).toBe("finished");
  expect(final.hives.every(h=>h.tips>=2)).toBe(true);
  expect(final.score.flowers.some(f=>f.owner!==null&&f.owner!==undefined)).toBe(true);
  const held=[...s.robots.flatMap(r=>r.inventory),...s.flowers.flatMap(f=>f.balls),...s.hives.flatMap(h=>h.cells.flat())];
  expect(new Set(held).size).toBe(held.length);expect(s.balls).toHaveLength(56);
 },30000);
});
describe("native autos and navigation",()=>{
 it("exports strict native schemas and real RobotBuilder action keys",()=>{
  const p=defaultAuto();p.steps=[{kind:"drive",target:{x:0,y:1,heading:0},preset:"safe"},{kind:"intake",enabled:true},{kind:"wait",seconds:0.5},{kind:"shoot",count:2,speed:3.08}];
  const n=nativeAuto(p,"biobuzz-example");
  expect(n.routine.schemaVersion).toBe(2);expect(n.catalog.schemaVersion).toBe(1);
  expect(n.catalog.entries[0].mirrorForOppositeAlliance).toBe(false);
  const drives = n.routine.steps.filter(s => s.kind === "DRIVE_TO").map(s => (s.drive as {target:{xMeters:number;yMeters:number;headingRadians:number}}).target);
  const bearing = Math.atan2(1-p.start.y, -p.start.x);
  expect(drives).toEqual([
    {xMeters:p.start.x,yMeters:p.start.y,headingRadians:bearing},
    {xMeters:0,yMeters:1,headingRadians:bearing},
    {xMeters:0,yMeters:1,headingRadians:0},
  ]);
  expect(nativeAuto({...p,steps:[{kind:"drive",target:{...p.start,heading:0},preset:"safe"}]},"rotation").routine.steps.filter(s=>s.kind==="DRIVE_TO")).toHaveLength(1);
  expect(n.routine.steps.some(s=>s.actionKey==="subsystem.biobuzz-shooter.set.transferVoltage")).toBe(true);
  expect(autoDuration(p.steps)).toBe(1.8);expect(n.routine.steps.at(-1)?.arguments).toEqual({value:"0"});
 });
 it("rejects malformed, out-of-field, and wrong-half autos",()=>{
  expect(()=>validateAuto(null)).toThrow();expect(()=>validateAuto({...defaultAuto(),start:{x:0,y:-1,heading:0}})).toThrow();
  expect(()=>validateAuto({...defaultAuto(),steps:[{kind:"wait",seconds:Infinity}]})).toThrow();
  expect(()=>nativeAuto(defaultAuto(),"../bad")).toThrow();
 });
 it("uses collision-aware navigation and bounded ballistic speed",()=>{
  const next=navigation({x:-1,y:0.7},{x:1,y:0.7});expect(Number.isFinite(next.x)).toBe(true);
  expect(shotSpeed(1.5,1.46)).toBeLessThanOrEqual(5.8);
 });
 it("executes the browser auto and stops actuator outputs at completion",()=>{
  const p=defaultAuto();p.steps=[{kind:"intake",enabled:true},{kind:"shoot",count:1,speed:3.08},{kind:"wait",seconds:0.1}];
  const s=new Simulation({timed:true,seats:["human","empty","empty","empty"],autos:[p]});advance(s,180);
  expect(s.robots[0].inventory).toHaveLength(3);expect(s["autoInput"](s.robots[0]).intake).toBe(false);
 });
});
