import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MatchCycleScenarios, {
  EMPTY_MATCH_CYCLE_RECORD,
  reviewMatchCycleHandoff,
} from "@/sims/match-cycle-scenarios";

describe("MatchCycleScenarios", () => {
  it("reports the first missing rehearsal fact for each phase", () => {
    expect(reviewMatchCycleHandoff("pit-to-queue", EMPTY_MATCH_CYCLE_RECORD)).toMatchObject({
      ready: false,
      missingKey: "safeStateRecorded",
    });
    expect(reviewMatchCycleHandoff("field-setup", {
      ...EMPTY_MATCH_CYCLE_RECORD,
      safeStateRecorded: true,
    })).toMatchObject({
      ready: false,
      missingKey: "phasePlanRecorded",
    });
    expect(reviewMatchCycleHandoff("post-match-return", {
      ...EMPTY_MATCH_CYCLE_RECORD,
      safeStateRecorded: true,
      phasePlanRecorded: true,
    })).toMatchObject({
      ready: false,
      missingKey: "changedFactRecorded",
    });
  });

  it("recognizes a complete paper handoff without approving an event process", () => {
    expect(reviewMatchCycleHandoff("pit-to-queue", {
      safeStateRecorded: true,
      phasePlanRecorded: true,
      changedFactRecorded: true,
      receiverRepeatRecorded: true,
      writtenRecordSaved: true,
    })).toEqual({
      ready: true,
      title: "The rehearsal handoff records all five lesson facts.",
      nextAction: "Repeat it aloud, preserve the paper record, and send the proposed process for team review before using it at an event.",
    });
  });

  it("uses native phase and evidence controls with deterministic reset", () => {
    render(<MatchCycleScenarios />);
    const pitPhase = screen.getByRole("radio", { name: "Pit to queue" });
    const fieldPhase = screen.getByRole("radio", { name: "Queue to field setup" });
    expect(pitPhase).toBeChecked();

    let checks = screen.getAllByRole("checkbox");
    checks.forEach((check) => fireEvent.click(check));
    expect(screen.getByText("The rehearsal handoff records all five lesson facts.")).toBeVisible();
    expect(screen.getByText("5 of 5")).toBeVisible();

    fireEvent.click(fieldPhase);
    expect(fieldPhase).toBeChecked();
    expect(screen.getByText("Rehearse the last transfer before the practice match begins.")).toBeVisible();
    checks = screen.getAllByRole("checkbox");
    checks.forEach((check) => expect(check).not.toBeChecked());

    fireEvent.click(checks[0]);
    fireEvent.click(screen.getByRole("button", { name: "Reset rehearsal" }));
    expect(pitPhase).toBeChecked();
    screen.getAllByRole("checkbox").forEach((check) => expect(check).not.toBeChecked());
  });

  it("keeps robot, event-rule, role, and approval limits visible", () => {
    render(<MatchCycleScenarios />);
    expect(screen.getByRole("note")).toHaveTextContent("cannot read a robot or event system");
    expect(screen.getByRole("note")).toHaveTextContent("current game or queue rules");
    expect(screen.getByRole("note")).toHaveTextContent("assign real team roles");
    expect(screen.getByRole("note")).toHaveTextContent("approve an event procedure");
  });
});
