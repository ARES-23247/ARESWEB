import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  enqueueTournamentMutation,
  flushTournamentOutbox,
  isPermanentOutboxError,
  listTournamentOutbox,
  PitOutboxQuotaError,
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
    expect(emptyAttempt).toEqual({ flushed: 0, remaining: [], rejected: [] });

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

  it("isolates outbox queues by authenticated user uid", () => {
    enqueueTournamentMutation(
      {
        tournamentId: "t1",
        id: "stand_u1",
        kind: "stand_scouting",
        payload: {
          matchNumber: "QM1",
          teamNumber: "23247",
          alliance: "red",
          autoScoreEstimate: 12,
          teleopCycles: 4,
          endgameTier: "none",
          disconnected: false,
          penalties: "none",
          defenseRating: 0,
        },
      },
      "uid_scout_1",
    );

    expect(listTournamentOutbox("t1", "uid_scout_1")).toHaveLength(1);
    expect(listTournamentOutbox("t1", "uid_scout_2")).toEqual([]);
    expect(listTournamentOutbox("t1")).toEqual([]);
  });

  it("drops permanent 4xx rejections while preserving mid-flush concurrent mutations and retrying transient failures", async () => {
    enqueueTournamentMutation(
      {
        tournamentId: "t1",
        id: "stand_bad",
        kind: "stand_scouting",
        payload: {
          matchNumber: "QM3",
          teamNumber: "11115",
          alliance: "red",
          autoScoreEstimate: 10,
          teleopCycles: 2,
          endgameTier: "none",
          disconnected: false,
          penalties: "none",
          defenseRating: 0,
        },
      },
      "uid_a",
    );
    enqueueTournamentMutation(
      {
        tournamentId: "t1",
        id: "stand_rate",
        kind: "stand_scouting",
        payload: {
          matchNumber: "QM4",
          teamNumber: "11115",
          alliance: "blue",
          autoScoreEstimate: 20,
          teleopCycles: 3,
          endgameTier: "park",
          disconnected: false,
          penalties: "none",
          defenseRating: 2,
        },
      },
      "uid_a",
    );

    const submitStand = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("Invalid match"), { status: 400 }))
      .mockImplementationOnce(async () => {
        // Simulate a scout queuing a new observation while flush is mid-flight
        enqueueTournamentMutation(
          {
            tournamentId: "t1",
            id: "stand_concurrent",
            kind: "stand_scouting",
            payload: {
              matchNumber: "QM5",
              teamNumber: "19999",
              alliance: "red",
              autoScoreEstimate: 18,
              teleopCycles: 5,
              endgameTier: "high",
              disconnected: false,
              penalties: "none",
              defenseRating: 0,
            },
          },
          "uid_a",
        );
        throw Object.assign(new Error("Rate limited"), { status: 429 });
      });

    const result = await flushTournamentOutbox(
      "t1",
      {
        submitPit: vi.fn().mockResolvedValue({}),
        submitStand,
        savePitState: vi.fn().mockResolvedValue({}),
      },
      "uid_a",
    );

    expect(result.flushed).toBe(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].item.id).toBe("stand_bad");
    expect(result.remaining.map((m) => m.id)).toEqual([
      "stand_rate",
      "stand_concurrent",
    ]);
    expect(isPermanentOutboxError({ status: 403 })).toBe(true);
    expect(isPermanentOutboxError({ status: 408 })).toBe(false);
    expect(isPermanentOutboxError({ status: 429 })).toBe(false);
    expect(isPermanentOutboxError(null)).toBe(false);
  });

  it("throws PitOutboxQuotaError when localStorage quota is exceeded", () => {
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

    expect(() =>
      enqueueTournamentMutation({
        tournamentId: "t1",
        kind: "pit_state",
        payload: { checklists: {}, batteries: [], triageItems: [] },
      }),
    ).toThrow(PitOutboxQuotaError);

    spy.mockRestore();
  });

  it("ignores malformed or cross-tournament entries and invalid JSON", () => {
    window.localStorage.setItem("ares_pit_outbox_v2:corrupt:anon", "{bad-json");
    expect(listTournamentOutbox("corrupt")).toEqual([]);
    window.localStorage.setItem(
      "ares_pit_outbox_v2:t1:anon",
      JSON.stringify([
        { id: "x", tournamentId: "other_t", kind: "pit_state", queuedAt: "2026-01-01", payload: {} },
        { id: "y", tournamentId: "t1", kind: "unknown_kind", queuedAt: "2026-01-01", payload: {} },
      ]),
    );
    expect(listTournamentOutbox("t1")).toEqual([]);
  });

  it("supersedes retryable pit_state and matching pit_scouting when newer writes arrive mid-flush", async () => {
    enqueueTournamentMutation(
      {
        tournamentId: "t1",
        id: "pit_state_1",
        kind: "pit_state",
        payload: { checklists: { pre: ["bolts"] }, batteries: [], triageItems: [] },
      },
      "uid_b",
    );
    enqueueTournamentMutation(
      {
        tournamentId: "t1",
        id: "pit_scout_1",
        kind: "pit_scouting",
        payload: {
          teamNumber: "23247",
          drivetrain: "Mecanum",
          canClearBarrierOrTrench: false,
        },
      },
      "uid_b",
    );

    const savePitState = vi.fn().mockImplementationOnce(async () => {
      enqueueTournamentMutation(
        {
          tournamentId: "t1",
          id: "pit_state_2",
          kind: "pit_state",
          payload: { checklists: { pre: ["wires"] }, batteries: [], triageItems: [] },
        },
        "uid_b",
      );
      enqueueTournamentMutation(
        {
          tournamentId: "t1",
          id: "pit_scout_2",
          kind: "pit_scouting",
          payload: {
            teamNumber: "23247",
            drivetrain: "Swerve",
            canClearBarrierOrTrench: true,
          },
        },
        "uid_b",
      );
      throw new Error("Transient offline error");
    });
    const submitPit = vi.fn().mockRejectedValueOnce(new Error("Transient offline error"));

    const res = await flushTournamentOutbox(
      "t1",
      {
        savePitState,
        submitPit,
        submitStand: vi.fn().mockResolvedValue({}),
      },
      "uid_b",
    );

    expect(res.flushed).toBe(0);
    expect(res.remaining.map((m) => m.id)).toEqual(["pit_state_2", "pit_scout_2"]);
  });
});
