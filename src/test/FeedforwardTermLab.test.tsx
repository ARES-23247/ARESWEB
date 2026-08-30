import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FeedforwardTermLab, {
  TEAM_PROFILE_SNAPSHOT,
  TEAM_MAX_WHEEL_SPEED_MPS,
  calculateFeedforwardStep,
  type FeedforwardStepInput,
} from "@/sims/feedforward-term-lab";

const steadyInput: FeedforwardStepInput = {
  ...TEAM_PROFILE_SNAPSHOT,
  targetVelocityMps: 1,
  previousTargetVelocityMps: 1,
  dtSeconds: 0.02,
  batteryVolts: 12,
};

describe("FeedforwardTermLab", () => {
  it("traces the checked-in steady-speed profile values", () => {
    const result = calculateFeedforwardStep(steadyInput);
    expect(result).toMatchObject({
      accelerationMps2: 0,
      maxWheelSpeedMps: TEAM_MAX_WHEEL_SPEED_MPS,
      staticTerm: 0.05,
      velocityTerm: 0.638,
      accelerationTerm: 0,
      voltageCompensationFactor: 1,
      saturated: false,
      failedClosed: false,
    });
    expect(result.rawRequest).toBeCloseTo(0.688);
    expect(result.output).toBeCloseTo(0.688);
  });

  it("matches the source acceleration term and final clamp for a start step", () => {
    const result = calculateFeedforwardStep({
      ...steadyInput,
      previousTargetVelocityMps: 0,
    });
    expect(result).toMatchObject({
      accelerationMps2: 50,
      accelerationTerm: 1,
      output: 1,
      saturated: true,
    });
    expect(result.rawRequest).toBeCloseTo(1.688);
  });

  it("copies the zero-target, invalid-time, speed-clamp, and invalid-battery boundaries", () => {
    expect(calculateFeedforwardStep({
      ...steadyInput,
      targetVelocityMps: 0,
      previousTargetVelocityMps: 1,
    })).toMatchObject({
      accelerationMps2: 0,
      rawRequest: 0,
      output: 0,
    });

    expect(calculateFeedforwardStep({
      ...steadyInput,
      targetVelocityMps: 99,
      previousTargetVelocityMps: -99,
      dtSeconds: Number.NaN,
    })).toMatchObject({
      targetVelocityMps: TEAM_MAX_WHEEL_SPEED_MPS,
      previousTargetVelocityMps: -TEAM_MAX_WHEEL_SPEED_MPS,
      usedDtSeconds: 0.02,
      output: 1,
    });

    expect(calculateFeedforwardStep({
      ...steadyInput,
      batteryVolts: Number.NaN,
    })).toMatchObject({
      output: 0,
      failedClosed: true,
    });
  });

  it("provides accessible presets, a live result, and deterministic reset", () => {
    render(<FeedforwardTermLab />);
    const target = screen.getByRole("spinbutton", { name: "Target wheel speed" });
    const previous = screen.getByRole("spinbutton", { name: "Previous target speed" });
    const battery = screen.getByRole("spinbutton", { name: "Battery input" });

    fireEvent.click(screen.getByRole("button", { name: "Start step" }));
    expect(target).toHaveValue(1);
    expect(previous).toHaveValue(0);
    expect(screen.getByRole("status")).toHaveTextContent("clamps it");
    expect(screen.getAllByText("1.000", { selector: "dd" })).not.toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Lower voltage" }));
    expect(battery).toHaveValue(9);
    expect(screen.getAllByText("0.917", { selector: "dd" })).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Invalid battery" }));
    expect(battery).toHaveValue(0);
    expect(screen.getByRole("status")).toHaveTextContent("rejects this battery input");
    expect(screen.getAllByText("0.000", { selector: "dd" }).length).toBeGreaterThan(1);

    fireEvent.click(screen.getByRole("button", { name: "Reset trace" }));
    expect(target).toHaveValue(1);
    expect(previous).toHaveValue(1);
    expect(battery).toHaveValue(12);
  });

  it("keeps the source disagreement and physical model limits visible", () => {
    render(<FeedforwardTermLab />);
    expect(screen.getByText("request units")).toBeVisible();
    expect(screen.getByRole("note")).toHaveTextContent("does not run Kotlin");
    expect(screen.getByRole("note")).toHaveTextContent("positive-kV speed-cap rule");
    expect(screen.getByRole("note")).toHaveTextContent("checked-in cap as the known prior value");
    expect(screen.getByRole("note")).toHaveTextContent("read the robot");
    expect(screen.getByRole("note")).toHaveTextContent("approve physical use");
  });

  it("uses the current checked-in drivebase maximum", () => {
    expect(TEAM_MAX_WHEEL_SPEED_MPS).toBeCloseTo(1.56739811912226);
  });

  it("recalculates the runtime speed cap when kV changes", () => {
    expect(calculateFeedforwardStep({
      ...steadyInput,
      kV: 1,
      targetVelocityMps: 1.5,
      previousTargetVelocityMps: 1.5,
    })).toMatchObject({
      maxWheelSpeedMps: 1,
      targetVelocityMps: 1,
      previousTargetVelocityMps: 1,
      velocityTerm: 1,
    });
  });
});
