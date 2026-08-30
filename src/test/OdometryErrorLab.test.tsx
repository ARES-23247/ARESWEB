import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import OdometryErrorLab, {
  calculateOdometryTrial,
  updateOdometrySource,
  type OdometrySourceState,
} from "@/sims/odometry-error-lab";

describe("OdometryErrorLab", () => {
  it("calculates signed residuals in each field direction", () => {
    expect(calculateOdometryTrial(3, 0, 0)).toEqual({
      trueX: 3,
      trueY: 0,
      estimatedX: 3,
      estimatedY: 0,
      residualX: 0,
      residualY: 0,
      endpointError: 0,
    });
    expect(calculateOdometryTrial(2, 10, 0).residualX).toBeCloseTo(0.2);
    expect(calculateOdometryTrial(2, 0, 0, 90)).toMatchObject({
      trueX: 0,
      trueY: 2,
    });
    expect(calculateOdometryTrial(2, 0, 0, 180)).toMatchObject({
      trueX: -2,
      trueY: 0,
    });
    expect(calculateOdometryTrial(2, 0, 5)).toEqual(
      calculateOdometryTrial(2, 0, 5),
    );
  });

  it("rejects invalid trial input", () => {
    expect(() => calculateOdometryTrial(0, 0, 0)).toThrow(
      "distance must be positive",
    );
    expect(() => calculateOdometryTrial(1, Number.NaN, 0)).toThrow("finite");
    expect(() =>
      calculateOdometryTrial(1, 0, 0, Number.POSITIVE_INFINITY),
    ).toThrow("finite");
  });

  it("matches the FTC immediate failover and consecutive-sample recovery rule", () => {
    let state: OdometrySourceState = {
      activeSource: "UNINITIALIZED",
      healthyRecoverySamples: 0,
    };
    expect(updateOdometrySource(state, false, false)).toEqual({
      activeSource: "DRIVETRAIN_FALLBACK",
      healthyRecoverySamples: 0,
    });
    state = updateOdometrySource(state, true, true);
    expect(state).toEqual({
      activeSource: "PINPOINT",
      healthyRecoverySamples: 0,
    });
    state = updateOdometrySource(state, true, false);
    expect(state).toEqual({
      activeSource: "DRIVETRAIN_FALLBACK",
      healthyRecoverySamples: 0,
    });

    for (let sample = 1; sample <= 4; sample += 1) {
      state = updateOdometrySource(state, true, true);
      expect(state).toEqual({
        activeSource: "DRIVETRAIN_FALLBACK",
        healthyRecoverySamples: sample,
      });
    }
    state = updateOdometrySource(state, true, false);
    expect(state.healthyRecoverySamples).toBe(0);

    for (let sample = 0; sample < 5; sample += 1)
      state = updateOdometrySource(state, true, true);
    expect(state).toEqual({
      activeSource: "PINPOINT",
      healthyRecoverySamples: 0,
    });
    expect(updateOdometrySource(state, false, false)).toEqual({
      activeSource: "DRIVETRAIN_FALLBACK",
      healthyRecoverySamples: 0,
    });
  });

  it("exposes native route controls, signed text data, and deterministic reset", () => {
    render(<OdometryErrorLab />);
    const direction = screen.getByRole("combobox", {
      name: "Surveyed route direction",
    });
    const scale = screen.getByRole("slider", { name: "Distance scale error" });

    fireEvent.change(direction, { target: { value: "negative-x" } });
    fireEvent.change(scale, { target: { value: "5" } });
    expect(direction).toHaveValue("negative-x");
    expect(scale).toHaveValue("5");

    expect(screen.getByText(/Surveyed \(-3\.00, 0\.00\) m/u)).toBeVisible();
    expect(screen.getByText(/Residual \(-0\.15, 0\.00\) m/u)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(direction).toHaveValue("positive-x");
    expect(scale).toHaveValue("0");
  });

  it("lets students trace source failover and recovery", () => {
    render(<OdometryErrorLab />);
    expect(screen.getByText("UNINITIALIZED")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Healthy sample" }));
    expect(screen.getByText("PINPOINT")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Bad sample" }));
    expect(screen.getByText("DRIVETRAIN_FALLBACK")).toBeVisible();
    expect(screen.getByText(/Recovery 0\/5/u)).toBeVisible();

    const healthy = screen.getByRole("button", { name: "Healthy sample" });
    for (let sample = 0; sample < 4; sample += 1) fireEvent.click(healthy);
    expect(screen.getByText(/Recovery 4\/5/u)).toBeVisible();
    fireEvent.click(healthy);
    expect(screen.getByText("PINPOINT")).toBeVisible();
  });

  it("states its missing estimator, handoff, and hardware behavior", () => {
    render(<OdometryErrorLab />);
    expect(screen.getByRole("note")).toHaveTextContent(
      "do not run the estimator",
    );
    expect(screen.getByRole("note")).toHaveTextContent(
      "rebases each source during handoff",
    );
    expect(screen.getByRole("note")).toHaveTextContent(
      "do not run the estimator, inspect Pinpoint or IMU hardware",
    );
    expect(screen.getByRole("note")).toHaveTextContent("prove accuracy");
  });
});
