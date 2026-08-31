import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AresPidTraceLab, { calculateAresPidTrace } from "@/sims/ares-pid-trace-lab";

describe("AresPidTraceLab", () => {
  it("matches the lesson's worked ARES source step", () => {
    const trace = calculateAresPidTrace({
      p: 0.5,
      i: 0.25,
      d: 0.4,
      measurement: 0.6,
      setpoint: 1,
      dtSeconds: 0.1,
      previousMeasurement: 0.5,
      previousFilteredDerivative: 0,
      totalError: 0.1,
    });
    expect(trace.error).toBeCloseTo(0.4);
    expect(trace.proposedIntegral).toBeCloseTo(0.14);
    expect(trace.storedIntegral).toBeCloseTo(0.14);
    expect(trace.filteredMeasurementRate).toBeCloseTo(0.2);
    expect(trace.pTerm).toBeCloseTo(0.2);
    expect(trace.iTerm).toBeCloseTo(0.035);
    expect(trace.dTerm).toBeCloseTo(-0.08);
    expect(trace.output).toBeCloseTo(0.155);
    expect(trace.integratorFrozen).toBe(false);
  });

  it("copies reset, anti-windup, deadzone, and invalid-input boundaries", () => {
    const base = {
      p: 1,
      i: 1,
      d: 1,
      measurement: 0,
      setpoint: 1,
      dtSeconds: 1,
      previousMeasurement: -1,
      previousFilteredDerivative: 2,
      totalError: 0,
    };
    const resetTrace = calculateAresPidTrace({ ...base, isFirstStep: true });
    expect(resetTrace.filteredMeasurementRate).toBe(0);
    expect(Math.abs(resetTrace.dTerm)).toBe(0);
    expect(calculateAresPidTrace({ ...base, setpoint: 10, maxOutput: 1 })).toMatchObject({
      proposedIntegral: 10,
      storedIntegral: 0,
      output: 1,
      integratorFrozen: true,
    });
    expect(calculateAresPidTrace({ ...base, measurement: 0.95, deadzone: 0.1 })).toMatchObject({
      output: 0,
      reason: expect.stringContaining("Deadzone"),
    });
    expect(calculateAresPidTrace({ ...base, dtSeconds: 0 })).toMatchObject({
      output: 0,
      reason: expect.stringContaining("Invalid"),
    });
  });

  it("lets students compare every fixed source case and states its limits", () => {
    render(<AresPidTraceLab />);
    expect(screen.getByText("ARES 13.0.0 source trace")).toBeVisible();
    expect(screen.getAllByText("0.155", { selector: "dd" })).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Output limited" }));
    expect(screen.getByText(/stored error freezes/u)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Invalid loop time" }));
    expect(screen.getByText(/Invalid input/u)).toBeVisible();
    expect(screen.getByRole("note")).toHaveTextContent("not Kotlin");
    expect(screen.getByRole("note")).toHaveTextContent("hardware");
    expect(screen.getByRole("note")).toHaveTextContent("safe gains");
  });
});
