import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ParityEvidenceLab, { classifyParityEvidence } from "@/sims/parity-evidence-lab";

describe("ParityEvidenceLab", () => {
  it("keeps incomplete, aligned, shared-failure, and mismatch findings separate", () => {
    expect(classifyParityEvidence("untested", "matches").status).toBe("Incomplete evidence");
    expect(classifyParityEvidence("matches", "matches").status).toBe("Aligned with expected contract");
    expect(classifyParityEvidence("differs", "differs").status).toBe("Shared contract failure");
    expect(classifyParityEvidence("matches", "differs").status).toBe("Adapter mismatch");
  });

  it("supports native selects, evidence disclosure, and deterministic reset", () => {
    render(<ParityEvidenceLab />);
    fireEvent.change(screen.getByLabelText("Contract case"), { target: { value: "write-fault" } });
    expect(screen.getByText("Attempt neutral and latch the fault")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Evidence stage"), { target: { value: "simulation" } });
    expect(screen.getByText(/real season logic and mock adapters/u)).toBeVisible();
    expect(screen.getByText(/Real wiring, radio traffic/u)).toBeVisible();
    fireEvent.change(screen.getByLabelText("Platform adapter test"), { target: { value: "matches" } });
    fireEvent.change(screen.getByLabelText("Simulated adapter test"), { target: { value: "differs" } });
    expect(screen.getByText("Adapter mismatch")).toBeVisible();
    fireEvent.click(screen.getByText("Open the parity evidence rules"));
    expect(screen.getByText(/same input, units, clock/u)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByLabelText("Contract case")).toHaveValue("startup");
    expect(screen.getByLabelText("Evidence stage")).toHaveValue("unit");
    expect(screen.getByText("Incomplete evidence")).toBeVisible();
  });

  it("states that the form runs no tests and proves no hardware behavior", () => {
    render(<ParityEvidenceLab />);
    expect(screen.getByRole("note")).toHaveTextContent("does not run Gradle");
    expect(screen.getByRole("note")).toHaveTextContent("prove physical behavior");
  });
});
