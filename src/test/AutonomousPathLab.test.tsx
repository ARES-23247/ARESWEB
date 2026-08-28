import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AutonomousPathLab, { calculatePathClearance } from "@/sims/autonomous-path-lab";

describe("AutonomousPathLab", () => {
  it("computes deterministic center-line clearance", () => { const blocked = calculatePathClearance(4.5, 2.5, 0.3); expect(blocked.pathLength).toBeCloseTo(Math.hypot(4, 2)); expect(blocked.safe).toBe(false); const clear = calculatePathClearance(4.5, 0.5, 0.3); expect(clear.safe).toBe(true); expect(clear).toEqual(calculatePathClearance(4.5, 0.5, 0.3)); });
  it("rejects invalid inputs", () => { expect(() => calculatePathClearance(1, 1, -0.1)).toThrow("cannot be negative"); expect(() => calculatePathClearance(Number.NaN, 1, 0.2)).toThrow("finite"); });
  it("supports controls, text data, and reset", () => { render(<AutonomousPathLab />); const goalY = screen.getByRole("slider", { name: "Goal field Y" }); fireEvent.change(goalY, { target: { value: "0.5" } }); expect(goalY).toHaveValue("0.5"); fireEvent.click(screen.getByText("Open the path data table")); expect(screen.getByRole("table")).toBeVisible(); fireEvent.click(screen.getByRole("button", { name: "Reset" })); expect(goalY).toHaveValue("2.5"); });
  it("states that it is not ARES or physical validation", () => { render(<AutonomousPathLab />); expect(screen.getByRole("note")).toHaveTextContent("does not parse `.aresroutine` files"); expect(screen.getByRole("note")).toHaveTextContent("validate physical clearance"); });
});
