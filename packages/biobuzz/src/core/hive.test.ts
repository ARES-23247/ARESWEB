import { describe, expect, it } from "vitest";
import { HIVE, hitHive, hiveOutline, hivePoint, hiveTarget } from "./hive";
import { Simulation } from "./engine";
import { BALL, NEUTRAL, distance, type Hive } from "./types";
import { shotSpeed } from "./bots";

const empty=()=>new Simulation({timed:false,seats:["empty","empty","empty","empty"]});
const advance=(s:Simulation,n:number)=>{for(let i=0;i<n;i++)s.step();};
const sample=(h:Hive,cell:number,x:number,y=0,z=HIVE.bottom+0.1)=>hivePoint(h,cell,{x,y,z});

describe("tilted BIOBUZZ cells",()=>{
  it("matches the manual opening elevations and the supplied CAD front/back depth",()=>{
    const h=empty().hives[0],front=hiveOutline(h,0),back=hiveOutline(h,0,true);
    expect(front[0].z).toBeCloseTo(1.359,2);expect(front[3].z).toBeCloseTo(1.666,2);
    expect(Math.hypot(front[0].x-back[0].x,front[0].z-back[0].z)).toBeCloseTo(0.3058,6);
    expect(hiveTarget(h).z).toBeGreaterThan(front[0].z);
  });
  it.each(["pollen","red","blue"] as const)("admits %s through either alliance's upward front opening in both positions",kind=>{
    for(const h of empty().hives)for(let cell=0;cell<2;cell++){
      h.upward=cell;h.angle=cell===0?-Math.PI/6:Math.PI/6;
      const hit=hitHive(h,sample(h,cell,0.65),sample(h,cell,0.50),BALL[kind].diameter/2);
      expect(hit).toMatchObject({capture:true,cell});
    }
  });
  it("does not capture a ball leaving the opening, in the down cell, or during a tip",()=>{
    const h=empty().hives[0];
    expect(hitHive(h,sample(h,0,0.52),sample(h,0,0.65),0.03556)).toBeNull();
    expect(hitHive(h,sample(h,1,0.65),sample(h,1,0.50),0.03556)).toBeNull();
    h.tipping=true;
    expect(hitHive(h,sample(h,0,0.65),sample(h,0,0.50),0.03556)).toBeNull();
    expect(hitHive(h,sample(h,0,0.52),sample(h,0,0.1),0.03556)).toMatchObject({capture:false});
  });
  it("collides with the back, bottom, side walls, sloped roof and opening rim without tunneling",()=>{
    const h=empty().hives[0];
    for(const [from,to] of [
      [sample(h,0,0.1),sample(h,0,0.4)],
      [sample(h,0,0.4,0,-0.2),sample(h,0,0.4,0,0.1)],
      [sample(h,0,0.4,0.5),sample(h,0,0.4,0)],
      [sample(h,0,0.4,-0.5),sample(h,0,0.4,0)],
      [sample(h,0,0.4,0.1,0.6),sample(h,0,0.4,0.1,0.1)],
      [sample(h,0,0.4,-0.1,0.6),sample(h,0,0.4,-0.1,0.1)],
      [sample(h,0,0.8,0.24),sample(h,0,0.1,0.24)],
    ]) expect(hitHive(h,from,to,0.03556)).toMatchObject({capture:false,cell:0});
    // The pentagonal shoulders are solid even within the bounding rectangle.
    expect(hitHive(h,sample(h,0,0.7,0.2,0.27),sample(h,0,0.3,0.2,0.27),0.03556)?.capture).not.toBe(true);
    expect(hitHive(h,{x:-1,y:1,z:2},{x:1,y:1,z:2},0.03556)).toBeNull();
  });
  it.each([0,1,2,3])("scores a real controlled shot into hive/cell configuration %i",configuration=>{
    const alliance=configuration<2?"red":"blue",cell=configuration%2,id=alliance==="red"?0:2;
    const seats=["empty","empty","empty","empty"] as const;
    const s=new Simulation({timed:false,seats:seats.map((seat,i)=>i===id?"human":seat)}),h=s.hives[alliance==="red"?0:1];
    for(const ball of [...h.cells.flat()]){s["detach"](s.balls[ball]);s.balls[ball].location="reserve";}
    h.upward=cell;h.angle=cell===0?-Math.PI/6:Math.PI/6;
    const r=s.robots[0],target=hiveTarget(h),pose={x:(cell===0?-1:1)*1.48,y:alliance==="red"?1.48:-1.48};
    const heading=Math.atan2(target.y-pose.y,target.x-pose.x);
    s["robotBodies"].get(id)!.setTransform(pose,heading);
    const ball=s.balls[r.inventory[0]];
    s.command(id,{...NEUTRAL,shoot:true,speed:shotSpeed(distance(pose,target),target.z)});s.step();advance(s,90);
    expect(ball.location).toBe("hive");expect(ball.container).toBe((alliance==="red"?0:2)+cell);
    expect(s.snapshot().tally[alliance].cell).toBe(1);expect(r.inventory).toHaveLength(3);
  });
  it("deflects a fast skin impact and preserves legal over/under misses without phantom scoring",()=>{
    const s=empty(),h=s.hives[0],ball=s.balls.find(b=>b.location==="reserve")!;
    const from=sample(h,0,0.4,0.4),to=sample(h,0,0.4,0.1);
    s["airborne"](ball,from.x,from.y,from.z,0,(to.y-from.y)*60,0);s.step();
    expect(ball.vy).toBeGreaterThan(0);expect(ball.location).toBe("air");expect(h.tips).toBe(0);
    for(const z of [0.5,2]){
      s["airborne"](ball,-0.8,h.y,z,60,0,0);s.step();
      expect(ball.x).toBeCloseTo(0.2);expect(ball.vx).toBe(60);expect(ball.location).toBe("air");
    }
    expect(s.balls).toHaveLength(56);
  });
  it("shoots, tips, then intakes and shoots eight pollen to refill and tip the opposite cell",()=>{
    const s=new Simulation(),r=s.robots[0],h=s.hives[0];
    for(const [cell,count] of [[0,4],[1,8]]) {
      expect(h.upward).toBe(cell);
      const target=hiveTarget(h),pose={x:cell===0?-1.42:1.42,y:1.42};
      const heading=Math.atan2(target.y-pose.y,target.x-pose.x),speed=shotSpeed(distance(pose,target),target.z);
      s["robotBodies"].get(0)!.setTransform(pose,heading);s.step();
      for(let shot=0;shot<count;shot++) {
        if(!r.inventory.length)for(let i=0;i<4;i++) {
          const ball=s.balls.find(b=>b.kind==="pollen"&&b.location==="reserve")!;
          s["floor"](ball,r.x+Math.cos(r.heading)*0.27,r.y+Math.sin(r.heading)*0.27);
          s.command(0,{...NEUTRAL,intake:true});advance(s,14);
        }
        s.command(0,{...NEUTRAL,shoot:true,speed});s.step();
        s.command(0,{...NEUTRAL});advance(s,24);
      }
      advance(s,110);
      expect(h.tips).toBe(cell+1);expect(h.upward).toBe(1-cell);
      expect(h.cells[cell]).toHaveLength(0);expect(r.inventory).toHaveLength(0);
    }
    expect(s.credits.red).toBe(0);expect(s.balls.filter(b=>b.kind==="red"&&b.location==="reserve")).toHaveLength(3);expect(s.balls).toHaveLength(56);
    const held=[...s.robots.flatMap(robot=>robot.inventory),...s.flowers.flatMap(f=>f.balls),...s.hives.flatMap(hive=>hive.cells.flat())];
    expect(new Set(held).size).toBe(held.length);
  });
});
