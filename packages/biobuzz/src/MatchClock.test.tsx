import { afterEach,expect,it } from "vitest";
import { cleanup,render,screen } from "@testing-library/react";
import MatchClock from "./MatchClock";
import { Simulation } from "./core/engine";
import { BALL,FLOWER_TOP,type Phase } from "./core/types";

afterEach(cleanup);
it("shows the authoritative countdown and unlocks nectar at the exact final-minute boundary",()=>{
  const s=new Simulation({timed:true,seats:["empty","empty","empty","empty"]});
  const {rerender}=render(<MatchClock {...s.snapshot()}/>);
  expect(screen.getByRole("timer")).toHaveTextContent("AUTO0:30remaining");
  expect(screen.getByTestId("nectar-countdown")).toHaveTextContent("1:38");
  s.tick=1799;s.step();rerender(<MatchClock {...s.snapshot()}/>);
  expect(screen.getByRole("timer")).toHaveTextContent("TRANSITION0:08");
  s.tick=2279;s.step();rerender(<MatchClock {...s.snapshot()}/>);
  expect(screen.getByRole("timer")).toHaveTextContent("TELEOP2:00");
  s.tick=5879;rerender(<MatchClock {...s.snapshot()} paused/>);
  expect(screen.getByRole("timer")).toHaveTextContent("TELEOP · PAUSED1:01");
  expect(screen.getByRole("status")).toHaveTextContent("Nectar flowers locked");
  expect(screen.getByTestId("nectar-countdown")).toHaveTextContent("0:01");
  s.step();rerender(<MatchClock {...s.snapshot()}/>);
  expect(screen.getByRole("timer")).toHaveTextContent("TELEOP1:00");
  expect(screen.getByRole("status")).toHaveTextContent("Final minute · nectar flowers open");
  expect(screen.queryByTestId("nectar-countdown")).not.toBeInTheDocument();
  expect(screen.getByText(/Remaining reserve nectar releases/)).toBeVisible();
  expect(s.events.filter(e=>e.message.startsWith("Final minute:"))).toHaveLength(1);
  s.step();expect(s.events.filter(e=>e.message.startsWith("Final minute:"))).toHaveLength(1);
});
it.each(["practice","settling","finished","interrupted","waiting","loading"] as const)("describes %s without claiming an active match countdown",phase=>{
  render(<MatchClock phase={phase} tick={125*60}/>);
  expect(screen.getByRole("timer")).toHaveTextContent(phase.toUpperCase());
  expect(screen.getByRole("timer")).toHaveTextContent(phase==="practice"?"2:05":"0:00");
  expect(screen.queryByTestId("nectar-countdown")).not.toBeInTheDocument();
  expect(screen.getByRole("status")).not.toHaveTextContent("Nectar flowers locked");
});
it.each(["red","blue"] as const)("counts %s flower nectar but penalizes entry only before TELEOP 1:00",alliance=>{
  for(const tick of [5879,5880]){
    const s=new Simulation({timed:true,seats:["empty","empty","empty","empty"]});
    s.phase="teleop" as Phase;s.tick=tick;
    const b=s.balls.find(b=>b.kind===alliance&&b.location==="reserve")!,f=s.flowers[0];
    s["airborne"](b,f.x,f.y,FLOWER_TOP+BALL[alliance].diameter/2+.001,0,0,-1);s.step();
    expect(b.location).toBe("flower");expect(s.snapshot().tally.flowers[0]).toContain(alliance);
    expect(s.snapshot().score.flowers[0].owner).toBe(alliance);
    expect(s.tally[alliance].majorFouls).toBe(tick<5880?1:0);
    expect(s.snapshot().score[alliance==="red"?"blue":"red"].penalties).toBe(tick<5880?20:0);
  }
});
