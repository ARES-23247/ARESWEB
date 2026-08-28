import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FaultTreeLab, { analyzeFaultEvidence, type FaultEvidence } from "@/sims/fault-tree-lab";

const unknown: FaultEvidence = { request: "UNKNOWN", write: "UNKNOWN", motion: "UNKNOWN", current: "UNKNOWN" };

describe("FaultTreeLab", () => {
  it("narrows branches in evidence order without naming a cause", () => {
    expect(analyzeFaultEvidence(unknown).openBranches).toContain("input or state");
    expect(analyzeFaultEvidence({ ...unknown, request: "NOT_CHANGED" }).openBranches).toContain("action or reducer");
    expect(analyzeFaultEvidence({ ...unknown, request: "CHANGED", write: "FAILED" }).openBranches).toContain("communication");
    expect(analyzeFaultEvidence({ request: "CHANGED", write: "SUCCEEDED", motion: "STILL", current: "HIGH" }).openBranches).toContain("jam or blocked mechanism");
  });

  it("keeps competing explanations after a high-current observation", () => {
    const result = analyzeFaultEvidence({ request: "CHANGED", write: "SUCCEEDED", motion: "STILL", current: "HIGH" });
    expect(result.openBranches).toHaveLength(3);
    expect(result.nextTest).toContain("competing sensor-evidence explanation");
  });

  it("supports native choices, live results, and reset", () => {
    render(<FaultTreeLab />);
    fireEvent.change(screen.getByLabelText("Requested target"), { target: { value: "CHANGED" } });
    fireEvent.change(screen.getByLabelText("Output write"), { target: { value: "FAILED" } });
    expect(screen.getByText("The output adapter reported a failed write.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByLabelText("Requested target")).toHaveValue("UNKNOWN");
  });

  it("states that the model cannot find a cause or authorize output", () => {
    render(<FaultTreeLab />);
    expect(screen.getByRole("note")).toHaveTextContent("identify a root cause");
    expect(screen.getByRole("note")).toHaveTextContent("authorize output");
    expect(screen.getByRole("note")).toHaveTextContent("prove a repair");
  });
});
