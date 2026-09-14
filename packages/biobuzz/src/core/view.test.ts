import { describe,it,expect } from "vitest";
import { driverInput,fieldToView,viewToField,viewRotation } from "./view";
import { HALF } from "./types";
describe("alliance driver perspective",()=>{
  it("places either driver's station at the bottom and its opponent at the top",()=>{
    expect(fieldToView({x:0,y:HALF},"red")).toEqual({x:0.5,y:1});
    expect(fieldToView({x:0,y:-HALF},"red")).toEqual({x:0.5,y:0});
    expect(fieldToView({x:0,y:-HALF},"blue")).toEqual({x:0.5,y:1});
    expect(fieldToView({x:0,y:HALF},"blue")).toEqual({x:0.5,y:0});
    expect(viewRotation("blue")-viewRotation("red")).toBe(Math.PI);
  });
  it.each(["red","blue"] as const)("keeps forward/left screen-relative in the %s view and preserves authored coordinates",alliance=>{
    const forward=fieldToView(driverInput(1,0,alliance),alliance);
    expect(forward.x).toBe(0.5);expect(forward.y).toBeLessThan(0.5);
    const left=fieldToView(driverInput(0,1,alliance),alliance);
    expect(left.x).toBeLessThan(0.5);expect(left.y).toBe(0.5);
    for(const p of [{x:-1.42,y:1.42},{x:HALF,y:-HALF},{x:0,y:0}]) {
      const restored=viewToField(fieldToView(p,alliance),alliance);
      expect(restored.x).toBeCloseTo(p.x,10);expect(restored.y).toBeCloseTo(p.y,10);
    }
  });
});
