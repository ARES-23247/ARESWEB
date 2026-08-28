import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MechanismMotionExplorer, { calculateMechanismMotion } from "@/sims/mechanism-motion-explorer";

describe("MechanismMotionExplorer", () => {
  it("calculates ideal arm, elevator, and roller motion", () => {
    expect(calculateMechanismMotion("arm", 2, 4, 0.04)).toMatchObject({
      valid: true,
      mechanismTurns: 0.5,
      primaryValue: 180,
      primaryUnit: "degrees",
    });
    expect(calculateMechanismMotion("elevator", 2, 4, 0.04)).toMatchObject({
      valid: true,
      mechanismTurns: 0.5,
      primaryValue: Math.PI * 0.04,
      primaryUnit: "meters",
    });
    expect(calculateMechanismMotion("roller", 4, 2, 0.05)).toMatchObject({
      valid: true,
      mechanismTurns: 2,
      primaryValue: 0.2 * Math.PI,
      primaryUnit: "meters",
    });
  });

  it("rejects non-finite and non-positive model inputs", () => {
    expect(calculateMechanismMotion("arm", Number.NaN, 4, 0.04)).toEqual({ valid: false, reason: "Every input must be a finite number." });
    expect(calculateMechanismMotion("arm", 2, 0, 0.04)).toEqual({ valid: false, reason: "The ratio must be greater than zero." });
    expect(calculateMechanismMotion("elevator", 2, 4, 0)).toEqual({ valid: false, reason: "The radius must be greater than zero." });
  });

  it("supports native controls, announces results, and resets deterministically", () => {
    render(<MechanismMotionExplorer />);
    fireEvent.change(screen.getByRole("combobox", { name: "Mechanism type" }), { target: { value: "elevator" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Motor rotations" }), { target: { value: "4" } });
    expect(screen.getByText("Ideal elevator travel")).toBeVisible();
    expect(screen.getByText("0.25 meters")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByRole("combobox", { name: "Mechanism type" })).toHaveValue("arm");
    expect(screen.getByRole("spinbutton", { name: "Motor rotations" })).toHaveValue(2);
    expect(screen.getByText("180.00 degrees")).toBeVisible();
  });

  it("states the model fidelity boundary beside the activity", () => {
    render(<MechanismMotionExplorer />);
    expect(screen.getByRole("note")).toHaveTextContent("ignores gravity");
    expect(screen.getByRole("note")).toHaveTextContent("cannot choose hardware");
    expect(screen.getByRole("note")).toHaveTextContent("prove safe motion");
  });
});
