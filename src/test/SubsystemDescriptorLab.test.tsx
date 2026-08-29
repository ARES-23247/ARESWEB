import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SubsystemDescriptorLab, { calculateIndicatorPreview } from "@/sims/subsystem-descriptor-lab";

describe("SubsystemDescriptorLab", () => {
  it("keeps target channels independent and fails to safe off in the teaching model", () => {
    expect(calculateIndicatorPreview(0.2, 0.8, true)).toEqual({ leftApplied: 0.2, rightApplied: 0.8, decision: "Independent targets" });
    expect(calculateIndicatorPreview(0.2, 0.8, false)).toEqual({ leftApplied: 0, rightApplied: 0, decision: "Safe off" });
  });

  it("rejects invalid target values", () => {
    expect(() => calculateIndicatorPreview(Number.NaN, 0.5, true)).toThrow("finite");
    expect(() => calculateIndicatorPreview(-0.1, 0.5, true)).toThrow("between zero and one");
  });

  it("supports native controls, text results, trace, and reset", () => {
    render(<SubsystemDescriptorLab />);
    const left = screen.getByRole("slider", { name: "Left target" });
    fireEvent.change(left, { target: { value: "0.2" } });
    expect(left).toHaveValue("0.2");
    expect(screen.getAllByText("0.200")).toHaveLength(2);
    fireEvent.click(screen.getByRole("checkbox", { name: /Outputs enabled/u }));
    expect(screen.getByText("Safe off")).toBeVisible();
    fireEvent.click(screen.getByText("Open the descriptor-to-output trace"));
    expect(screen.getByText("Two hardware IDs, two target fields, two direct loops, and zero safe outputs.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(left).toHaveValue("0.472");
  });

  it("states the project and hardware fidelity limits", () => {
    render(<SubsystemDescriptorLab />);
    expect(screen.getByRole("note")).toHaveTextContent("does not load or validate an `.aressubsystem`");
    expect(screen.getByRole("note")).toHaveTextContent("prove physical wiring");
  });
});
