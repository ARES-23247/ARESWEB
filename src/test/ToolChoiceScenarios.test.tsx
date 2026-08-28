import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ToolChoiceScenarios, { EMPTY_TOOL_EVIDENCE, reviewToolTask } from "@/sims/tool-choice-scenarios";

describe("ToolChoiceScenarios", () => {
  it("maps every task to a bounded review category", () => {
    expect(reviewToolTask("measure", EMPTY_TOOL_EVIDENCE).reviewPath).toContain("measurement and marking");
    expect(reviewToolTask("hold", EMPTY_TOOL_EVIDENCE).reviewPath).toContain("workholding and support");
    expect(reviewToolTask("shape", EMPTY_TOOL_EVIDENCE).reviewPath).toContain("material-shaping");
    expect(reviewToolTask("assemble", EMPTY_TOOL_EVIDENCE).reviewPath).toContain("assembly and fastener");
    expect(reviewToolTask("electrical", EMPTY_TOOL_EVIDENCE).reviewPath).toContain("electrical preparation");
  });

  it("reports ordered missing evidence and a bounded complete result", () => {
    expect(reviewToolTask("measure", EMPTY_TOOL_EVIDENCE)).toMatchObject({ ready: false, missingKey: "exactToolRecorded" });
    expect(reviewToolTask("measure", { ...EMPTY_TOOL_EVIDENCE, exactToolRecorded: true, materialAndTaskRecorded: true })).toMatchObject({ ready: false, missingKey: "approvedInstructionsAttached" });
    expect(reviewToolTask("measure", {
      exactToolRecorded: true,
      materialAndTaskRecorded: true,
      approvedInstructionsAttached: true,
      workAreaPlanRecorded: true,
      trainingAndProtectionRecorded: true,
      isolationAndStopRecorded: true,
    })).toMatchObject({ ready: true, nextAction: expect.stringContaining("does not authorize tool use") });
  });

  it("updates native controls and resets deterministically", () => {
    render(<ToolChoiceScenarios />);
    const task = screen.getByRole("combobox", { name: "Bounded task" });
    fireEvent.change(task, { target: { value: "shape" } });
    expect(screen.getByText(/material-shaping tool review/u)).toBeVisible();
    const checks = screen.getAllByRole("checkbox");
    checks.forEach((check) => fireEvent.click(check));
    expect(screen.getByText(/paper preflight is ready/u)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(task).toHaveValue("measure");
    checks.forEach((check) => expect(check).not.toBeChecked());
  });

  it("keeps tool-use authority limits visible", () => {
    render(<ToolChoiceScenarios />);
    expect(screen.getByRole("note")).toHaveTextContent("does not identify a real tool");
    expect(screen.getByRole("note")).toHaveTextContent("verify training");
    expect(screen.getByRole("note")).toHaveTextContent("authorize tool use");
  });
});
