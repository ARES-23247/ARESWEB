import { afterEach,expect,it } from "vitest";
import { cleanup,fireEvent,render,screen } from "@testing-library/react";
import MatchClock from "./MatchClock";
import { Simulation } from "./core/engine";
import { BALL,FLOWER_TOP,type Phase } from "./core/types";

afterEach(cleanup);
it("describes AUTO-only without promising a TELEOP nectar unlock",()=>{
  render(<MatchClock mode="auto" phase="auto" remaining={30}/>);
  expect(screen.getByRole("timer")).toHaveTextContent("AUTO0:30");
  expect(screen.getByTestId("nectar-countdown")).toHaveTextContent("stays locked throughout AUTO");
  expect(screen.getByText(/AUTO only: 0:30/)).toBeVisible();
});
it("shows TELEOP-only's two minutes and one-minute nectar countdown",()=>{
  const s=new Simulation({timed:true,matchMode:"teleop",seats:["empty","empty","empty","empty"]});
  render(<MatchClock mode="teleop" {...s.snapshot()}/>);
  expect(screen.getByRole("timer")).toHaveTextContent("TELEOP2:00");
  expect(screen.getByTestId("nectar-countdown")).toHaveTextContent("unlocks in 1:00");
  expect(screen.getByText(/TELEOP only: 2:00/)).toBeVisible();
});
it("keeps the compact clock and eligibility visible while rules can be expanded",()=>{
  render(<MatchClock compact phase="practice"/>);
  expect(screen.getByRole("timer")).toHaveTextContent("PRACTICEUNTIMEDno time limit");
  expect(screen.getByRole("status")).toHaveTextContent("nectar flowers open");
  const summary=screen.getByText("Timing and scoring rules");
  expect(summary.closest("details")).not.toHaveAttribute("open");
  fireEvent.click(summary);
  expect(summary.closest("details")).toHaveAttribute("open");
  expect(screen.getByText(/Pollen can score/)).toBeVisible();
});
it("shows the authoritative countdown and unlocks nectar at the exact final-minute boundary",()=>{
  const s=new Simulation({timed:true,seats:["empty","empty","empty","empty"]});
  const {rerender}=render(<MatchClock {...s.snapshot()}/>);
  expect(screen.getByRole("timer")).toHaveTextContent("AUTO2:30match remaining");
  expect(screen.getByTestId("period-clock")).toHaveTextContent("AUTO 0:30");
  expect(screen.getByTestId("nectar-countdown")).toHaveTextContent("1:38");
  s.tick=59;s.step();rerender(<MatchClock {...s.snapshot()}/>);
  expect(screen.getByTestId("match-time")).toHaveTextContent("2:29");
  expect(screen.getByTestId("period-clock")).toHaveTextContent("AUTO 0:29");
  s.tick=1799;s.step();rerender(<MatchClock {...s.snapshot()}/>);
  expect(screen.getByRole("timer")).toHaveTextContent("TRANSITION2:00");
  expect(screen.getByRole("timer")).toHaveTextContent("match paused");
  expect(screen.getByTestId("period-clock")).toHaveTextContent("Transition 0:08");
  s.tick=2219;s.step();rerender(<MatchClock {...s.snapshot()}/>);
  expect(screen.getByTestId("match-time")).toHaveTextContent("2:00");
  expect(screen.getByTestId("period-clock")).toHaveTextContent("Transition 0:01");
  s.tick=2279;s.step();rerender(<MatchClock {...s.snapshot()}/>);
  expect(screen.getByRole("timer")).toHaveTextContent("TELEOP2:00");
  expect(screen.queryByTestId("period-clock")).not.toBeInTheDocument();
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
  s.tick=9479;s.step();rerender(<MatchClock {...s.snapshot()}/>);
  expect(screen.getByRole("timer")).toHaveTextContent("SETTLING0:00");
  expect(screen.queryByTestId("period-clock")).not.toBeInTheDocument();
});
it.each(["practice","settling","finished","interrupted","waiting","loading"] as const)("describes %s without claiming an active match countdown",phase=>{
  render(<MatchClock phase={phase} tick={125*60}/>);
  expect(screen.getByRole("timer")).toHaveTextContent(phase.toUpperCase());
  expect(screen.getByRole("timer")).toHaveTextContent(phase==="practice"?"UNTIMED":"0:00");
  expect(screen.queryByTestId("nectar-countdown")).not.toBeInTheDocument();
  expect(screen.getByRole("status")).not.toHaveTextContent("Nectar flowers locked");
});
it.each(["auto","teleop"] as const)("counts %s down to zero using the authoritative period clock",mode=>{
  const s=new Simulation({timed:true,matchMode:mode,seats:["empty","empty","empty","empty"]});
  const {rerender}=render(<MatchClock mode={mode} {...s.snapshot()}/>);
  expect(screen.getByTestId("match-time")).toHaveTextContent(mode==="auto"?"0:30":"2:00");
  for(let i=0;i<60;i++)s.step();
  rerender(<MatchClock mode={mode} {...s.snapshot()}/>);
  expect(screen.getByTestId("match-time")).toHaveTextContent(mode==="auto"?"0:29":"1:59");
  s.tick=(mode==="auto"?30:158)*60-1;s.step();
  rerender(<MatchClock mode={mode} {...s.snapshot()}/>);
  expect(screen.getByRole("timer")).toHaveTextContent("SETTLING0:00");
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
