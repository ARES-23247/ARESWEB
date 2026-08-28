import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SysIdTuningLab, { classifyExperiment } from "@/sims/sysid-tuning-lab";

describe("SysIdTuningLab", () => {
  it("classifies improvement, regression, and inconclusive evidence", () => {
    expect(classifyExperiment({ baseline: 1.2, candidate: 1, threshold: 0.1, direction: "LOWER", changeCount: "ONE" }).classification).toBe("IMPROVED");
    expect(classifyExperiment({ baseline: 1.2, candidate: 1.4, threshold: 0.1, direction: "LOWER", changeCount: "ONE" }).classification).toBe("REGRESSED");
    expect(classifyExperiment({ baseline: 1.2, candidate: 1.15, threshold: 0.1, direction: "LOWER", changeCount: "ONE" }).classification).toBe("INCONCLUSIVE");
    expect(classifyExperiment({ baseline: 1, candidate: 1.2, threshold: 0.1, direction: "HIGHER", changeCount: "ONE" }).classification).toBe("IMPROVED");
  });

  it("blocks invalid or confounded records", () => {
    expect(classifyExperiment({ baseline: 1, candidate: 2, threshold: 0, direction: "HIGHER", changeCount: "ONE" }).classification).toBe("BLOCKED");
    expect(classifyExperiment({ baseline: 1, candidate: 2, threshold: 0.1, direction: "HIGHER", changeCount: "MULTIPLE" }).classification).toBe("BLOCKED");
  });

  it("supports native controls, live classification, and reset", () => {
    render(<SysIdTuningLab />);
    expect(screen.getByText("IMPROVED")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Parameters changed"), { target: { value: "MULTIPLE" } });
    expect(screen.getByText("BLOCKED")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByLabelText("Parameters changed")).toHaveValue("ONE");
  });

  it("states the boundaries of the invented experiment", () => {
    render(<SysIdTuningLab />);
    expect(screen.getByRole("note")).toHaveTextContent("does not run SysId");
    expect(screen.getByRole("note")).toHaveTextContent("prove causation");
    expect(screen.getByRole("note")).toHaveTextContent("certify safety");
  });
});
