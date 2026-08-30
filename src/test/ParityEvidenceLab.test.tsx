import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ParityEvidenceLab, {
  classifyParityEvidence,
} from "@/sims/parity-evidence-lab";

describe("ParityEvidenceLab", () => {
  it("keeps current generated and lifecycle artifacts at their actual evidence levels", () => {
    expect(
      classifyParityEvidence("generated-contract", "matches", "matches"),
    ).toMatchObject({
      status: "Compile evidence only",
      limit: "No adapter behavior or output was compared.",
    });
    expect(
      classifyParityEvidence("generated-behavior", "matches", "matches"),
    ).toMatchObject({
      status: "Mock behavior evidence",
      limit: "The FTC or FRC platform adapter did not run.",
    });
    expect(
      classifyParityEvidence("ftc-lifecycle", "matches", "matches"),
    ).toMatchObject({
      status: "Lifecycle integration evidence",
      supports: "One registered instance received read, write, then close.",
    });
  });

  it("classifies every paired runtime outcome without hiding gaps", () => {
    expect(
      classifyParityEvidence("paired-runtime", "untested", "matches").status,
    ).toBe("Incomplete evidence");
    expect(
      classifyParityEvidence("paired-runtime", "matches", "matches").status,
    ).toBe("Aligned for this case");
    expect(
      classifyParityEvidence("paired-runtime", "differs", "differs").status,
    ).toBe("Shared expectation failure");
    expect(
      classifyParityEvidence("paired-runtime", "matches", "differs").status,
    ).toBe("Adapter mismatch");
  });

  it("enables adapter results only for a paired runtime test", () => {
    render(<ParityEvidenceLab />);
    expect(screen.getByLabelText("Platform boundary")).toBeDisabled();
    expect(screen.getByLabelText("Mock or simulated boundary")).toBeDisabled();
    expect(screen.getByText("Compile evidence only")).toBeVisible();

    fireEvent.change(screen.getByLabelText("Evidence artifact"), {
      target: { value: "paired-runtime" },
    });
    expect(screen.getByLabelText("Platform boundary")).toBeEnabled();
    expect(screen.getByLabelText("Mock or simulated boundary")).toBeEnabled();
  });

  it("shows source-derived cases, reports a mismatch, and resets", () => {
    render(<ParityEvidenceLab />);
    fireEvent.change(screen.getByLabelText("Contract case"), {
      target: { value: "write-fault" },
    });
    expect(
      screen.getByText("Safe output and declared fault policy"),
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText("Evidence artifact"), {
      target: { value: "paired-runtime" },
    });
    fireEvent.change(screen.getByLabelText("Platform boundary"), {
      target: { value: "matches" },
    });
    fireEvent.change(screen.getByLabelText("Mock or simulated boundary"), {
      target: { value: "differs" },
    });
    expect(screen.getByText("Adapter mismatch")).toBeVisible();

    fireEvent.click(screen.getByText("Open the comparison rules"));
    expect(
      screen.getByText("Compile parity is not runtime parity."),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByLabelText("Evidence artifact")).toHaveValue(
      "generated-contract",
    );
    expect(screen.getByLabelText("Contract case")).toHaveValue("startup");
    expect(screen.getByText("Compile evidence only")).toBeVisible();
  });

  it("states the planner fidelity boundary", () => {
    render(<ParityEvidenceLab />);
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent("does not run Gradle");
    expect(note).toHaveTextContent("inject faults");
    expect(note).toHaveTextContent("prove physical behavior");
  });
});
