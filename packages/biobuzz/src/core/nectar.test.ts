import { describe,it,expect } from "vitest";
import { Simulation } from "./engine";
import { inZone,ZONES } from "./field";
import type { Alliance,Phase } from "./types";

const advance=(s:Simulation,ticks:number)=>{for(let i=0;i<ticks;i++)s.step();};
const reserve=(s:Simulation,a:Alliance)=>s.balls.filter(b=>b.kind===a&&b.location==="reserve");
function fill(s:Simulation,alliance:Alliance){
  const index=alliance==="red"?0:1,h=s.hives[index];
  // Reuse real pollen, retaining its identity and normal container ownership.
  for(const b of s.balls.filter(b=>b.kind==="pollen").slice(0,8))s["store"](b,"hive",index*2+h.upward);
}
describe("simulated drive-team nectar release",()=>{
  it.each(["red","blue"] as const)("releases exactly one %s nectar on each completed tip, in both positions",alliance=>{
    const s=new Simulation({timed:true,seats:["empty","empty","empty","empty"]}),h=s.hives[alliance==="red"?0:1];
    const start=h.upward;
    expect(s.release(alliance)).toBe(false);
    for(let tips=1;tips<=2;tips++){
      fill(s,alliance);advance(s,30);
      expect(h.tips).toBe(tips-1);expect(reserve(s,alliance)).toHaveLength(6-tips);
      advance(s,30);
      expect(h.tips).toBe(tips);expect(h.upward).toBe(tips%2?1-start:start);
      expect(reserve(s,alliance)).toHaveLength(5-tips);expect(s.credits[alliance]).toBe(0);
      expect(s.balls.filter(b=>b.kind===alliance&&b.location==="floor"&&inZone(b,ZONES[alliance].loading))).toHaveLength(tips);
      advance(s,60);expect(reserve(s,alliance)).toHaveLength(5-tips);
    }
    expect(s.balls).toHaveLength(56);expect(reserve(s,alliance==="red"?"blue":"red")).toHaveLength(5);
  });
  it("queues a blocked loading zone without losing the credit and retries after the robot leaves",()=>{
    const s=new Simulation(),r=s.robots[0],z=ZONES.red.loading,body=s["robotBodies"].get(0)!;
    body.setTransform({x:z.x,y:z.y},0);r.x=z.x;r.y=z.y;r.heading=0;
    fill(s,"red");advance(s,75);
    expect(reserve(s,"red")).toHaveLength(5);expect(s.credits.red).toBe(1);
    body.setTransform({x:1.2,y:1},0);advance(s,16);
    expect(reserve(s,"red")).toHaveLength(4);expect(s.credits.red).toBe(0);
    advance(s,120);expect(reserve(s,"red")).toHaveLength(4);
  });
  it("keeps practice reserves outside play until a tip or manual request",()=>{
    const s=new Simulation();advance(s,600);
    expect(reserve(s,"red")).toHaveLength(5);expect(reserve(s,"blue")).toHaveLength(5);
    fill(s,"red");advance(s,60);expect(reserve(s,"red")).toHaveLength(4);
    expect(s.release("red")).toBe(true);expect(reserve(s,"red")).toHaveLength(3);
  });
  it("automatically releases all remaining reserves at the final-minute boundary, never early",()=>{
    const s=new Simulation({timed:true,seats:["empty","empty","empty","empty"]});
    s.phase="teleop";s.tick=98*60-1;s.step();
    expect(reserve(s,"red")).toHaveLength(5);expect(reserve(s,"blue")).toHaveLength(5);
    advance(s,61);
    expect(reserve(s,"red")).toHaveLength(0);expect(reserve(s,"blue")).toHaveLength(0);
    expect(s.balls.filter(b=>b.kind!=="pollen"&&b.location==="floor")).toHaveLength(10);
    expect(s.balls).toHaveLength(56);expect(s.release("red")).toBe(false);
  });
  it("can complete the drive-team handoff during the motionless transition",()=>{
    const s=new Simulation({timed:true,seats:["empty","empty","empty","empty"]});
    s.phase="transition";s.tick=1800;s.credits.blue=1;s.step();
    expect(reserve(s,"blue")).toHaveLength(4);expect(s.credits.blue).toBe(0);
  });
  it.each(["settling","finished","interrupted"] as Phase[])("never introduces nectar after the deadline in %s",phase=>{
    const s=new Simulation({timed:true,seats:["empty","empty","empty","empty"]});
    s.phase=phase;s.tick=158*60;s.credits.red=1;fill(s,"red");advance(s,60);
    expect(reserve(s,"red")).toHaveLength(5);expect(s.release("red")).toBe(false);
  });
});
