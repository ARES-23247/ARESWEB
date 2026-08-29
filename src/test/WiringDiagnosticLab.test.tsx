import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import WiringDiagnosticLab, { EMPTY_WIRING_REVIEW, reviewWiringPlan } from "@/sims/wiring-diagnostic-lab";

describe("WiringDiagnosticLab", () => {
  it("reports the first missing plan check in order", () => {
    expect(reviewWiringPlan(EMPTY_WIRING_REVIEW)).toMatchObject({ ready: false, missingKey: "sourceIsolated" });
    expect(reviewWiringPlan({ ...EMPTY_WIRING_REVIEW, sourceIsolated: true })).toMatchObject({ ready: false, missingKey: "identityMatches" });
    expect(reviewWiringPlan({ ...EMPTY_WIRING_REVIEW, sourceIsolated: true, identityMatches: true, polarityRecorded: true })).toMatchObject({ ready: false, missingKey: "connectionPlanRecorded" });
  });

  it("recognizes a complete paper record without claiming physical proof", () => {
    expect(reviewWiringPlan({
      sourceIsolated: true,
      identityMatches: true,
      polarityRecorded: true,
      connectionPlanRecorded: true,
      routingAndReliefRecorded: true,
      protectionSourceRecorded: true,
    })).toEqual({
      ready: true,
      title: "The paper plan contains every lesson check.",
      nextAction: "Preserve the record for team review. It still needs authentic inspection and physical evidence.",
    });
  });

  it("uses native checks, live ordered feedback, and deterministic reset", () => {
    render(<WiringDiagnosticLab />);
    const checks = screen.getAllByRole("checkbox");
    checks.forEach((check) => fireEvent.click(check));
    expect(screen.getByText("The paper plan contains every lesson check.")).toBeVisible();
    fireEvent.click(checks[2]);
    expect(screen.getByText(/Plan blocked at: Polarity or direction-sensitive pins/u)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    checks.forEach((check) => expect(check).not.toBeChecked());
  });

  it("keeps the physical evidence boundary visible", () => {
    render(<WiringDiagnosticLab />);
    expect(screen.getByRole("note")).toHaveTextContent("Every box is self-reported");
    expect(screen.getByRole("note")).toHaveTextContent("cannot inspect a wire");
    expect(screen.getByRole("note")).toHaveTextContent("prove that a robot is wired correctly");
  });
});
