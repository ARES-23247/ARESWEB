import { describe,expect,it } from "vitest";
import { Simulation } from "./engine";
import { clearHiveShot,planHiveShot,SHOOTER } from "./shooting";
import { NEUTRAL,type Ball } from "./types";

const advance=(s:Simulation,n:number)=>{for(let i=0;i<n;i++)s.step();};
describe("assisted hive shots",()=>{
  it.each(["pollen","red","blue"] as const)("finds clear bounded trajectories for %s at different distances and both hive positions",kind=>{
    const s=new Simulation(),angles=new Set<number>();
    for(const cell of [0,1])for(const pose of [{x:-1.1,y:1.59,heading:0},{x:-1.48,y:1.03,heading:0},{x:-1.42,y:1.42,heading:0}]){
      const h=s.hives[0];h.upward=cell;h.angle=cell===0?-Math.PI/6:Math.PI/6;pose.x=Math.abs(pose.x)*(cell===0?-1:1);
      const plan=planHiveShot(pose,kind,s.hives,0);
      expect(plan).not.toBeNull();expect(plan!.speed).toBeGreaterThanOrEqual(2);expect(plan!.speed).toBeLessThanOrEqual(5.8);
      expect(clearHiveShot(pose,kind,plan!,s.hives,0)).toBe(true);angles.add(plan!.elevation);
    }
    expect(angles.size).toBeGreaterThan(1);
  });
  it("rejects obstructed, too-close, moving-cell and wrong-target trajectories",()=>{
    const s=new Simulation(),pose={x:0,y:s.hives[0].y,heading:0};
    expect(planHiveShot(pose,"pollen",s.hives,0)).toBeNull();
    const start=s.robots[0],plan=planHiveShot(start,"pollen",s.hives,0)!;
    expect(clearHiveShot(start,"pollen",plan,s.hives,1)).toBe(false);
    expect(clearHiveShot(start,"pollen",{...plan,heading:Math.PI,speed:2,elevation:SHOOTER.elevation},s.hives,0)).toBe(false);
    s.hives[0].tipping=true;expect(planHiveShot(start,"pollen",s.hives,0)).toBeNull();
  });
  it("a single press turns the robot, chooses a launch and scores without holding Shoot",()=>{
    const s=new Simulation(),r=s.robots[0],initial=r.heading,ball=s.balls[r.inventory[0]];
    for(let i=0;i<240;i++){s.command(0,{...NEUTRAL,aimHive:true,shoot:i===0,intake:true});s.step();}
    expect(r.heading).not.toBeCloseTo(initial,1);expect(ball.location).toBe("hive");expect(r.inventory).toHaveLength(3);
    expect(r.shotStatus).toBeUndefined();expect(s.hives[0].cells[0]).toHaveLength(4);
    expect(s.events.filter(e=>e.message.includes("launched"))).toHaveLength(1);
  });
  it("reports a blocked shot without consuming its ball",()=>{
    const s=new Simulation(),r=s.robots[0];s["robotBodies"].get(0)!.setTransform({x:0,y:0.32385},0);s.step();
    s.command(0,{...NEUTRAL,aimHive:true,shoot:true});s.step();
    expect(r.shotStatus).toBe("blocked");expect(r.inventory).toHaveLength(4);
  });
  it.each(["second press","drive","manual","stale","invalid","disconnect","interrupt"])("cancels an unfinished shot on %s",reason=>{
    const s=new Simulation(),r=s.robots[0];s.command(0,{...NEUTRAL,aimHive:true,shoot:true});s.step();
    expect(r.shotStatus).toBe("aiming");
    if(reason==="second press") {s.command(0,{...NEUTRAL,aimHive:true});s.step();s.command(0,{...NEUTRAL,aimHive:true,shoot:true});s.step();}
    if(reason==="drive")s.command(0,{...NEUTRAL,aimHive:true,x:1});
    if(reason==="manual")s.command(0,{...NEUTRAL});
    if(reason==="stale")advance(s,16);
    if(reason==="invalid")s.command(0,{...NEUTRAL,x:NaN});
    if(reason==="disconnect")s.setController(0,"standard");
    if(reason==="interrupt")s.interrupt();
    expect(r.shotStatus).toBeUndefined();expect(r.inventory).toHaveLength(4);expect(s["aimedShots"].size).toBe(0);
  });
  it("times out an unaligned shot and neutralizes it at period deadlines",()=>{
    const s=new Simulation(),r=s.robots[0];s["robotBodies"].get(0)!.setFixedRotation(true);
    for(let i=0;i<303;i++){s.command(0,{...NEUTRAL,aimHive:true,shoot:i===0});s.step();}
    expect(r.shotStatus).toBeUndefined();expect(r.inventory).toHaveLength(4);
    for(const phase of ["auto","teleop"] as const){
      const match=new Simulation({timed:true,seats:["human","empty","empty","empty"]});
      match.phase="practice";match.command(0,{...NEUTRAL,aimHive:true,shoot:true});match.step();
      match.phase=phase;match.tick=phase==="auto"?1799:9479;match.step();
      expect(match.robots[0].shotStatus).toBeUndefined();expect(match.robots[0].inventory).toHaveLength(4);
    }
  });
  it("waits during a tip, and does not queue an empty robot",()=>{
    const s=new Simulation(),r=s.robots[0];s.hives[0].tipping=true;
    s.command(0,{...NEUTRAL,aimHive:true,shoot:true});s.step();expect(r.shotStatus).toBe("aiming");
    s.command(0,{...NEUTRAL});s.step();
    for(const id of [...r.inventory]){const b=s.balls[id] as Ball;s["detach"](b);b.location="reserve";}
    s.command(0,{...NEUTRAL,aimHive:true,shoot:true});s.step();expect(r.shotStatus).toBeUndefined();
  });
});
