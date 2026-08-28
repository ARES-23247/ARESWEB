import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MotionProfileLab, { calculateConceptMotionProfile } from "@/sims/motion-profile-lab";

describe("MotionProfileLab", () => {
  it("builds deterministic triangular and trapezoidal rest-to-rest profiles", () => {
    const trapezoid = calculateConceptMotionProfile(3, 2, 1.5);
    expect(trapezoid.kind).toBe("trapezoidal");
    expect(trapezoid.samples).toHaveLength(61);
    expect(trapezoid.samples.at(-1)).toMatchObject({ position: 3, velocity: 0, phase: "complete" });
    expect(trapezoid.samples.every((sample) => sample.velocity <= 2 + Number.EPSILON)).toBe(true);
    const triangle = calculateConceptMotionProfile(0.5, 4, 1);
    expect(triangle.kind).toBe("triangular");
    expect(triangle.peakVelocity).toBeCloseTo(Math.sqrt(0.5));
    expect(trapezoid).toEqual(calculateConceptMotionProfile(3, 2, 1.5));
  });

  it("rejects invalid limits", () => {
    expect(() => calculateConceptMotionProfile(0, 1, 1)).toThrow("positive finite");
    expect(() => calculateConceptMotionProfile(1, Number.NaN, 1)).toThrow("positive finite");
  });

  it("supports native controls, a text table, and deterministic reset", () => {
    render(<MotionProfileLab />);
    const distance = screen.getByRole("slider", { name: "Move distance" });
    fireEvent.change(distance, { target: { value: "1.5" } });
    expect(distance).toHaveValue("1.5");
    fireEvent.click(screen.getByText("Open the numeric result table"));
    expect(screen.getByRole("table")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(distance).toHaveValue("3");
  });

  it("states the model and hardware limits", () => {
    render(<MotionProfileLab />);
    expect(screen.getByRole("note")).toHaveTextContent("one-dimensional");
    expect(screen.getByRole("note")).toHaveTextContent("not safe limits for a physical robot");
  });
});
