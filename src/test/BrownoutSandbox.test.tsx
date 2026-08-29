import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BrownoutSandbox, { evaluateBrownout } from "@/sims/brownout-sandbox";

describe("BrownoutSandbox", () => {
  it("matches healthy, warning, and critical ARES guard zones", () => {
    expect(evaluateBrownout("HEALTHY", 10.5)).toMatchObject({ valid: true, state: "HEALTHY", powerScale: 1 });
    const warning = evaluateBrownout("HEALTHY", 9.1);
    expect(warning).toMatchObject({ valid: true, state: "WARNING" });
    expect(warning.powerScale).toBeCloseTo(0.65, 8);
    expect(evaluateBrownout("HEALTHY", 8.2)).toMatchObject({ valid: true, state: "CRITICAL", powerScale: 0 });
  });

  it("uses hysteresis when warning and critical states recover", () => {
    expect(evaluateBrownout("WARNING", 10.2)).toMatchObject({ valid: true, state: "WARNING" });
    expect(evaluateBrownout("WARNING", 10.5)).toMatchObject({ valid: true, state: "HEALTHY" });
    expect(evaluateBrownout("CRITICAL", 8.5)).toMatchObject({ valid: true, state: "CRITICAL" });
    expect(evaluateBrownout("CRITICAL", 8.7)).toMatchObject({ valid: true, state: "WARNING" });
  });

  it("fails closed on invalid voltage or profile configuration", () => {
    expect(evaluateBrownout("HEALTHY", Number.NaN)).toEqual({ valid: false, state: "CRITICAL", powerScale: 0, reason: "Invalid voltage fails closed." });
    expect(evaluateBrownout("HEALTHY", 10, { warningVoltage: 8, criticalVoltage: 9, minimumScale: 0.3, hysteresisVoltage: 0.4 })).toEqual({ valid: false, state: "CRITICAL", powerScale: 0, reason: "Invalid profile fails closed." });
  });

  it("supports native controls and a deterministic reset", () => {
    render(<BrownoutSandbox />);
    const state = screen.getByRole("combobox", { name: "Previous guard state" });
    const voltage = screen.getByRole("spinbutton", { name: "Example voltage" });
    fireEvent.change(state, { target: { value: "CRITICAL" } });
    fireEvent.change(voltage, { target: { value: "8.5" } });
    expect(screen.getByText("CRITICAL")).toBeVisible();
    expect(screen.getByText("0%")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(state).toHaveValue("HEALTHY");
    expect(voltage).toHaveValue(10.5);
    expect(screen.getByText("100%")).toBeVisible();
  });

  it("keeps league and physical fidelity limits visible", () => {
    render(<BrownoutSandbox />);
    expect(screen.getByRole("note")).toHaveTextContent("not current league rules");
    expect(screen.getByRole("note")).toHaveTextContent("does not read a battery");
    expect(screen.getByRole("note")).toHaveTextContent("size a breaker or fuse");
  });
});
