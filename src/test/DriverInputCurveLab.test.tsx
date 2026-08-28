import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DriverInputCurveLab, { shapeDriverAxis } from "@/sims/driver-input-curve-lab";

describe("DriverInputCurveLab", () => {
  it("matches the pinned one-axis shaping order", () => {
    const result = shapeDriverAxis(0.5, 3, 0, "RED", "FIELD_RELATIVE");
    const deadband = (0.5 - 0.05) / 0.95;
    expect(result.afterDeadband).toBeCloseTo(deadband);
    expect(result.shaped).toBeCloseTo(deadband ** 3);
    expect(result.smoothed).toBeCloseTo(deadband ** 3 * 0.4);
    expect(result.final).toBe(result.smoothed);
  });

  it("clamps, rejects noise, and applies a safe fallback", () => {
    expect(shapeDriverAxis(2, 1, 0, "RED", "FIELD_RELATIVE").bounded).toBe(1);
    expect(shapeDriverAxis(0.03, 3, 0, "RED", "FIELD_RELATIVE").final).toBe(0);
    expect(shapeDriverAxis(Number.NaN, -1, Number.NaN, "RED", "FIELD_RELATIVE").final).toBe(0);
  });

  it("mirrors blue field translation but not robot-relative translation", () => {
    const red = shapeDriverAxis(0.5, 3, 0, "RED", "FIELD_RELATIVE").final;
    expect(shapeDriverAxis(0.5, 3, 0, "BLUE", "FIELD_RELATIVE").final).toBeCloseTo(-red);
    expect(shapeDriverAxis(0.5, 3, 0, "BLUE", "ROBOT_RELATIVE").final).toBeCloseTo(red);
  });

  it("supports native controls, live math, reset, and visible limits", () => {
    render(<DriverInputCurveLab />);
    fireEvent.change(screen.getByLabelText("Alliance"), { target: { value: "BLUE" } });
    expect(screen.getByText("-0.0425")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Drive frame"), { target: { value: "ROBOT_RELATIVE" } });
    expect(screen.getAllByText("0.0425")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByLabelText("Alliance")).toHaveValue("RED");
    expect(screen.getByRole("note")).toHaveTextContent("does not read a gamepad");
    expect(screen.getByRole("note")).toHaveTextContent("prove driving behavior");
  });
});
