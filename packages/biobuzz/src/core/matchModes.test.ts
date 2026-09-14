import { describe, expect, it } from "vitest";
import { Simulation } from "./engine";
import { MATCH_TIME, nectarPlacementOpen } from "./timing";
import { NEUTRAL, type Config } from "./types";
import { defaultAuto } from "../AutoEditor";

const seats:Config["seats"]=["human","empty","empty","empty"];
function advance(s:Simulation,ticks:number){for(let i=0;i<ticks;i++)s.step();}

describe("local timer modes",()=>{
  it("ends AUTO at 30 seconds, settles, and never enables driver control",()=>{
    const auto={...defaultAuto(),steps:[{kind:"shoot" as const,count:1,speed:3.08}]};
    const s=new Simulation({timed:true,matchMode:"auto",seats,autos:[auto]});
    expect(s.snapshot().remaining).toBe(30);
    advance(s,120);expect(s.robots[0].inventory).toHaveLength(3);
    advance(s,1680);expect(s.phase).toBe("settling");
    expect(s.tally.red.teleopPark).toBe(0);
    advance(s,600);expect(s.phase).toBe("finished");
    const stopped=s.snapshot();s.command(0,{...NEUTRAL,x:1,shoot:true});advance(s,7200);
    expect(s.snapshot()).toEqual(stopped);
    expect(s.events.some(e=>e.message==="TELEOP started.")).toBe(false);
  });
  it("keeps a slow-settling AUTO out of TELEOP and bounds settling to ten seconds",()=>{
    const s=new Simulation({timed:true,matchMode:"auto",seats});
    s.tick=1799;s.step();
    // A ball far above the field cannot settle within the remaining deadline.
    s["airborne"](s.balls[0],0,0,10000,0,0,0);
    advance(s,600);
    expect(s.phase).toBe("interrupted");expect(s.tick).toBe(2400);
    expect(s.events.some(e=>e.message==="TELEOP started.")).toBe(false);
  });
  it("starts TELEOP with two minutes, accepts driving, and unlocks nectar after one minute",()=>{
    const s=new Simulation({timed:true,matchMode:"teleop",seats});
    expect(s.phase).toBe("teleop");expect(s.snapshot().remaining).toBe(120);
    expect(nectarPlacementOpen(true,s.tick)).toBe(false);
    const y=s.robots[0].y;s.command(0,{...NEUTRAL,y:-1});advance(s,12);
    expect(s.robots[0].y).toBeLessThan(y);
    advance(s,3587);expect(s.snapshot().remaining).toBeCloseTo(60+1/60);
    expect(nectarPlacementOpen(true,s.tick)).toBe(false);
    s.step();expect(s.snapshot().remaining).toBe(60);expect(nectarPlacementOpen(true,s.tick)).toBe(true);
    advance(s,3600);expect(s.phase).toBe("settling");advance(s,600);expect(s.phase).toBe("finished");
    expect(s.tally.red.leave).toBe(0);expect(s.tally.red.autoPark).toBe(0);expect(s.tally.red.autoTips).toBe(0);
  });
  it("preserves combined timing by default and ignores modes in untimed practice",()=>{
    for(const matchMode of [undefined,"combined"] as const){
      const s=new Simulation({timed:true,matchMode,seats});
      advance(s,MATCH_TIME.autoEnd*60);expect(s.phase).toBe("transition");
      advance(s,8*60);expect(s.phase).toBe("teleop");expect(s.snapshot().remaining).toBe(120);
    }
    const s=new Simulation({timed:false,matchMode:"teleop",seats});
    expect(s.phase).toBe("practice");expect(s.tick).toBe(0);
    expect(()=>new Simulation({timed:true,matchMode:"invalid" as Config["matchMode"],seats})).toThrow("Select a valid timer mode");
  });
});
