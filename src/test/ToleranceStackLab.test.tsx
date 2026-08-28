import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ToleranceStackLab, { calculateToleranceStack } from "@/sims/tolerance-stack-lab";

describe("ToleranceStackLab", () => {
  it("calculates worst-case totals and required-range status", () => {
    const parts = [{ nominal: 40, tolerance: 0.2 }, { nominal: 30, tolerance: 0.2 }, { nominal: 20, tolerance: 0.2 }];
    expect(calculateToleranceStack(parts, 89, 91)).toEqual({
      valid: true,
      nominalTotal: 90,
      worstMinimum: 89.4,
      worstMaximum: 90.6,
      requiredMinimum: 89,
      requiredMaximum: 91,
      fitsWorstCase: true,
    });
    expect(calculateToleranceStack(parts, 89.5, 90.5)).toMatchObject({ valid: true, fitsWorstCase: false });
  });

  it("rejects missing, non-finite, negative, and reversed inputs", () => {
    expect(calculateToleranceStack([], 0, 1)).toEqual({ valid: false, reason: "Add at least one part." });
    expect(calculateToleranceStack([{ nominal: Number.NaN, tolerance: 0.1 }], 0, 1)).toEqual({ valid: false, reason: "Every value must be a finite number." });
    expect(calculateToleranceStack([{ nominal: 1, tolerance: -0.1 }], 0, 1)).toEqual({ valid: false, reason: "Part lengths and plus-or-minus tolerances cannot be negative." });
    expect(calculateToleranceStack([{ nominal: 1, tolerance: 0.1 }], 2, 1)).toEqual({ valid: false, reason: "The required minimum cannot be greater than the required maximum." });
  });

  it("updates through native inputs and resets deterministically", () => {
    render(<ToleranceStackLab />);
    expect(screen.getByText("The arithmetic range fits the lesson requirement.")).toBeVisible();
    fireEvent.change(screen.getByRole("spinbutton", { name: "Part 1 nominal length" }), { target: { value: "41" } });
    expect(screen.getByText("91.00 mm")).toBeVisible();
    const tolerance = screen.getByRole("spinbutton", { name: "Part 1 plus-or-minus tolerance" });
    fireEvent.change(tolerance, { target: { value: "2" } });
    expect(screen.getByText("The arithmetic range does not fit the lesson requirement.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(tolerance).toHaveValue(0.2);
    expect(screen.getByText("89.40–90.60 mm")).toBeVisible();
  });

  it("keeps the model fidelity boundary visible", () => {
    render(<ToleranceStackLab />);
    expect(screen.getByRole("note")).toHaveTextContent("ignores hole position");
    expect(screen.getByRole("note")).toHaveTextContent("cannot approve a CAD model");
  });
});
