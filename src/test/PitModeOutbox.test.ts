import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  enqueueTournamentMutation,
  flushTournamentOutbox,
  listTournamentOutbox,
} from "@/lib/pitModeOutbox";

describe("pitModeOutbox", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("coalesces duplicate pit_scouting for the same team and pit_state while keeping distinct stand_scouting entries", () => {
    enqueueTournamentMutation({
      tournamentId: "t1",
      kind: "pit_scouting",
      payload: {
        teamNumber: "11115",
        drivetrain: "Mecanum v1",
        canClearBarrierOrTrench: false,
      },
    });
    enqueueTournamentMutation({
      tournamentId: "t1",
      kind: "pit_scouting",
      payload: {
        teamNumber: "11115",
        drivetrain: "Mecanum v2",
        canClearBarrierOrTrench: true,
      },
    });
    enqueueTournamentMutation({
      tournamentId: "t1",
      kind: "stand_scouting",
      id: "stand_qm1",
      payload: {
        matchNumber: "QM1",
        teamNumber: "11115",
        alliance: "red",
        autoScoreEstimate: 30,
        teleopCycles: 9,
        endgameTier: "high",
        disconnected: false,
        penalties: "none",
        defenseRating: 0,
      },
    });
    enqueueTournamentMutation({
      tournamentId: "t1",
      kind: "pit_state",
      payload: { checklists: { QM1: ["battery"] }, batteries: [], triageItems: [] },
    });
    enqueueTournamentMutation({
      tournamentId: "t1",
      kind: "pit_state",
      payload: {
        checklists: { QM1: ["battery", "gamepads"] },
        batteries: [],
        triageItems: [],
      },
    });

    const queued = listTournamentOutbox("t1");
    expect(queued).toHaveLength(3);
    expect(queued[0]).toMatchObject({
      kind: "pit_scouting",
      payload: { drivetrain: "Mecanum v2" },
    });
    expect(queued[1]).toMatchObject({
      kind: "stand_scouting",
      id: "stand_qm1",
    });
    expect(queued[2]).toMatchObject({
      kind: "pit_state",
      payload: { checklists: { QM1: ["battery", "gamepads"] } },
    });
  });

  it("flushes succeeded items and retains failed mutations for retry", async () => {
    enqueueTournamentMutation({
      tournamentId: "t1",
      id: "stand_1",
      kind: "stand_scouting",
      payload: {
        matchNumber: "QM2",
        teamNumber: "14210",
        alliance: "blue",
        autoScoreEstimate: 24,
        teleopCycles: 8,
        endgameTier: "park",
        disconnected: false,
        penalties: "none",
        defenseRating: 1,
      },
    });
    enqueueTournamentMutation({
      tournamentId: "t1",
      kind: "pit_state",
      payload: { checklists: {}, batteries: [], triageItems: [] },
    });

    const submitPit = vi.fn().mockResolvedValue({});
    const submitStand = vi.fn().mockResolvedValue({});
    const savePitState = vi.fn().mockRejectedValue(new Error("Venue offline"));

    const firstAttempt = await flushTournamentOutbox("t1", {
      submitPit,
      submitStand,
      savePitState,
    });
    expect(firstAttempt.flushed).toBe(1);
    expect(firstAttempt.remaining).toHaveLength(1);
    expect(submitStand).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({ clientSubmissionId: "stand_1" }),
    );

    savePitState.mockResolvedValueOnce({});
    const secondAttempt = await flushTournamentOutbox("t1", {
      submitPit,
      submitStand,
      savePitState,
    });
    expect(secondAttempt.flushed).toBe(1);
    expect(secondAttempt.remaining).toHaveLength(0);
    expect(listTournamentOutbox("t1")).toEqual([]);

    const emptyAttempt = await flushTournamentOutbox("t1", {
      submitPit,
      submitStand,
      savePitState,
    });
    expect(emptyAttempt).toEqual({ flushed: 0, remaining: [] });

    enqueueTournamentMutation({
      tournamentId: "t1",
      kind: "pit_scouting",
      payload: {
        teamNumber: "19999",
        drivetrain: "Swerve",
        canClearBarrierOrTrench: true,
      },
    });
    const pitAttempt = await flushTournamentOutbox("t1", {
      submitPit,
      submitStand,
      savePitState,
    });
    expect(pitAttempt.flushed).toBe(1);
    expect(submitPit).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({ teamNumber: "19999" }),
    );
  });

  it("returns empty array when localStorage has malformed JSON", () => {
    window.localStorage.setItem("ares_pit_outbox_v1:corrupt", "{bad-json");
    expect(listTournamentOutbox("corrupt")).toEqual([]);
  });
});
