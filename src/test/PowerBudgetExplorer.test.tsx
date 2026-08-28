import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PowerBudgetExplorer, { calculatePowerBudget } from "@/sims/power-budget-explorer";

describe("PowerBudgetExplorer", () => {
  it("calculates total current, power, and energy from explicit inputs", () => {
    expect(calculatePowerBudget(12, [8, 4, 1], 5)).toEqual({
      totalCurrent: 13,
      powerWatts: 156,
      energyWattHours: 13,
    });
  });

  it("uses native controls and resets to the documented example", () => {
    render(<PowerBudgetExplorer />);
    fireEvent.change(screen.getByRole("slider", { name: "Drive current" }), { target: { value: "10" } });
    expect(screen.getByText("180.0 W")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByRole("slider", { name: "Drive current" })).toHaveValue("8");
    expect(screen.getByText("156.0 W")).toBeVisible();
  });

  it("labels the values as invented and refuses real-system approval claims", () => {
    render(<PowerBudgetExplorer />);
    expect(screen.getByRole("note")).toHaveTextContent("invented lesson values");
    expect(screen.getByRole("note")).toHaveTextContent("Never use it to approve a real electrical system");
  });
});
