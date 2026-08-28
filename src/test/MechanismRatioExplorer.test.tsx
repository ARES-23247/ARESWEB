import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MechanismRatioExplorer, { calculateMechanismRatio } from "@/sims/mechanism-ratio-explorer";

describe("MechanismRatioExplorer", () => {
  it("calculates ideal output speed and torque from tooth counts", () => {
    expect(calculateMechanismRatio(20, 40, 100)).toEqual({
      outputTurnsPerInputTurn: 0.5,
      idealTorqueMultiplier: 2,
      outputSpeed: 50,
    });
  });

  it("supports native keyboard controls, announces results, and resets deterministically", () => {
    render(<MechanismRatioExplorer />);
    const driver = screen.getByRole("slider", { name: "Driver gear teeth" });
    const driven = screen.getByRole("slider", { name: "Driven gear teeth" });

    fireEvent.change(driver, { target: { value: "40" } });
    fireEvent.change(driven, { target: { value: "20" } });
    expect(screen.getByText("200.0 RPM")).toBeVisible();
    expect(screen.getByText("0.50×")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(driver).toHaveValue("20");
    expect(driven).toHaveValue("40");
    expect(screen.getByText("50.0 RPM")).toBeVisible();
    expect(screen.getByText("2.00×")).toBeVisible();
  });

  it("states the model fidelity limit beside the activity", () => {
    render(<MechanismRatioExplorer />);
    expect(screen.getByRole("note")).toHaveTextContent("ignores friction");
    expect(screen.getByRole("note")).toHaveTextContent("does not prove a real mechanism");
  });
});
