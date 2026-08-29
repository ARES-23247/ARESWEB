import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PostMatchTriageLab, { EMPTY_POST_MATCH_RECORD, reviewPostMatchRecord } from "@/sims/post-match-triage-lab";

describe("PostMatchTriageLab", () => {
  it("reports the first missing handoff record in order", () => {
    expect(reviewPostMatchRecord(EMPTY_POST_MATCH_RECORD)).toMatchObject({ ready: false, missingKey: "safeStateRecorded" });
    expect(reviewPostMatchRecord({ ...EMPTY_POST_MATCH_RECORD, safeStateRecorded: true })).toMatchObject({ ready: false, missingKey: "observationRecorded" });
    expect(reviewPostMatchRecord({ ...EMPTY_POST_MATCH_RECORD, safeStateRecorded: true, observationRecorded: true, sourcePreserved: true })).toMatchObject({ ready: false, missingKey: "inspectionBoundaryRecorded" });
  });

  it("recognizes a complete paper handoff without authorizing return", () => {
    expect(reviewPostMatchRecord({
      safeStateRecorded: true,
      observationRecorded: true,
      sourcePreserved: true,
      inspectionBoundaryRecorded: true,
      ownerAndStopRecorded: true,
      nextTestRecorded: true,
      returnDecisionRecorded: true,
    })).toEqual({
      ready: true,
      title: "The lesson handoff contains every required record.",
      nextAction: "Preserve it for team process review. The checklist does not authorize repair, powered testing, or return to play.",
    });
  });

  it("uses native checks, live ordered feedback, and deterministic reset", () => {
    render(<PostMatchTriageLab />);
    const checks = screen.getAllByRole("checkbox");
    checks.forEach((check) => fireEvent.click(check));
    expect(screen.getByText("The lesson handoff contains every required record.")).toBeVisible();
    fireEvent.click(checks[4]);
    expect(screen.getByText(/Handoff blocked at: Each next action/u)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    checks.forEach((check) => expect(check).not.toBeChecked());
  });

  it("keeps physical authority and diagnosis limits visible", () => {
    render(<PostMatchTriageLab />);
    expect(screen.getByRole("note")).toHaveTextContent("cannot disable or inspect a robot");
    expect(screen.getByRole("note")).toHaveTextContent("diagnose a cause");
    expect(screen.getByRole("note")).toHaveTextContent("return to play");
  });
});
