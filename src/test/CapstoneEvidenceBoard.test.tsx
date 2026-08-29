import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CapstoneEvidenceBoard, { reviewCapstoneEvidence, type CapstoneEvidence } from "@/sims/capstone-evidence-board";

const empty: CapstoneEvidence = { requirement: false, design: false, implementation: false, tests: false, failure: false, safety: false, limits: false };

describe("CapstoneEvidenceBoard", () => {
  it("reports the first missing section in evidence order", () => {
    expect(reviewCapstoneEvidence(empty).next).toContain("measurable requirement");
    expect(reviewCapstoneEvidence({ ...empty, requirement: true }).next).toContain("design");
  });

  it("becomes ready only when every represented section is recorded", () => {
    const complete = Object.fromEntries(Object.keys(empty).map((key) => [key, true])) as CapstoneEvidence;
    expect(reviewCapstoneEvidence(complete)).toMatchObject({ complete: 7, total: 7, status: "READY FOR REVIEW" });
  });

  it("supports native checks, live results, and deterministic reset", () => {
    render(<CapstoneEvidenceBoard />);
    fireEvent.click(screen.getByLabelText("Requirement has a number, unit, and constraints"));
    expect(screen.getByText("1 of 7")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("0 of 7")).toBeVisible();
  });

  it("states that the self-check cannot approve or prove work", () => {
    render(<CapstoneEvidenceBoard />);
    expect(screen.getByRole("note")).toHaveTextContent("approve website publication");
    expect(screen.getByRole("note")).toHaveTextContent("authorize physical operation");
    expect(screen.getByRole("note")).toHaveTextContent("prove a capstone claim");
  });
});
