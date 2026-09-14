import { afterEach,expect,it,vi } from "vitest";
import { cleanup,render,screen,within } from "@testing-library/react";
import Field from "./Field";
import { Simulation } from "./core/engine";

afterEach(()=>{cleanup();vi.restoreAllMocks();});
it("shows mixed flower and separate cell contents and updates them after retrieval and spilling",()=>{
  // Counts are semantic DOM alongside the independent animation loop.
  vi.spyOn(window,"requestAnimationFrame").mockReturnValue(1);
  const s=new Simulation({timed:false,seats:["empty","empty","empty","empty"]});
  const red=s.balls.find(b=>b.kind==="red"&&b.location==="reserve")!,blue=s.balls.find(b=>b.kind==="blue"&&b.location==="reserve")!;
  s["store"](red,"flower",0);s["store"](blue,"flower",0);
  const {rerender}=render(<Field state={s.snapshot()}/>);
  const flower=()=>within(screen.getByRole("group",{name:"Flower 1 contents"}));
  expect(flower().getByLabelText("4 pollen")).toBeVisible();
  expect(flower().getByLabelText("1 red nectar")).toBeVisible();
  expect(flower().getByLabelText("1 blue nectar")).toBeVisible();
  expect(within(screen.getByRole("group",{name:"red hive cell 1 contents"})).getByLabelText("3 red nectar")).toBeVisible();
  expect(within(screen.getByRole("group",{name:"red hive cell 2 contents"})).getByLabelText("0 red nectar")).toBeVisible();
  for(const b of s.balls.filter(b=>b.kind==="pollen").slice(0,8))s["store"](b,"hive",0);
  for(let i=0;i<60;i++)s.step();
  rerender(<Field state={s.snapshot()} view="blue"/>);
  expect(flower().getByLabelText("0 pollen")).toBeVisible();
  expect(flower().getByLabelText("1 red nectar")).toBeVisible();
  expect(flower().getByLabelText("1 blue nectar")).toBeVisible();
  const cell1=within(screen.getByRole("group",{name:"red hive cell 1 contents"}));
  expect(cell1.getByText("Red C1 · Down")).toBeVisible();expect(cell1.getByLabelText("0 red nectar")).toBeVisible();
  expect(screen.getByText("Red C2 · Open")).toBeVisible();
});
