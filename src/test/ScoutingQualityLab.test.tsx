import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ScoutingQualityLab, { EMPTY_SCOUTING_EVIDENCE, reviewScoutingEvidence } from "@/sims/scouting-quality-lab";

describe("ScoutingQualityLab", () => {
  it("reports the first missing evidence check in order", () => {
    expect(reviewScoutingEvidence(EMPTY_SCOUTING_EVIDENCE)).toMatchObject({ ready: false, missingKey: "sourceRecorded" });
    expect(reviewScoutingEvidence({ ...EMPTY_SCOUTING_EVIDENCE, sourceRecorded: true })).toMatchObject({ ready: false, missingKey: "observationSeparated" });
    expect(reviewScoutingEvidence({ ...EMPTY_SCOUTING_EVIDENCE, sourceRecorded: true, observationSeparated: true, contextRecorded: true })).toMatchObject({ ready: false, missingKey: "sampleLimitsRecorded" });
  });

  it("recognizes a complete record without claiming strategy proof", () => {
    expect(reviewScoutingEvidence({
      sourceRecorded: true,
      observationSeparated: true,
      contextRecorded: true,
      sampleLimitsRecorded: true,
      missingDataVisible: true,
      personalDataRemoved: true,
    })).toEqual({
      ready: true,
      title: "The record contains every lesson evidence check.",
      nextAction: "Preserve it for team process review. It is evidence for a question, not a complete strategy or a judgment about people.",
    });
  });

  it("uses native checks, live ordered feedback, and deterministic reset", () => {
    render(<ScoutingQualityLab />);
    const checks = screen.getAllByRole("checkbox");
    checks.forEach((check) => fireEvent.click(check));
    expect(screen.getByText("The record contains every lesson evidence check.")).toBeVisible();
    fireEvent.click(checks[3]);
    expect(screen.getByText(/Record blocked at: Sample count/u)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    checks.forEach((check) => expect(check).not.toBeChecked());
  });

  it("keeps collection, privacy, and inference limits visible", () => {
    render(<ScoutingQualityLab />);
    expect(screen.getByRole("note")).toHaveTextContent("cannot watch a match");
    expect(screen.getByRole("note")).toHaveTextContent("remove private data");
    expect(screen.getByRole("note")).toHaveTextContent("create a match strategy");
  });
});
