import { describe, expect, it } from "vitest";
import { summarizeTournamentMatches } from "@/lib/tournamentStats";
import type { TournamentMatch } from "@/types/tournament";

const match = (overrides: Partial<TournamentMatch>): TournamentMatch => ({
  id: "match",
  tournamentId: "event",
  matchNumber: "QM1",
  alliance: "red",
  partner: "12345",
  opponents: ["54321"],
  result: "upcoming",
  completed: false,
  isDeleted: 0,
  ...overrides,
});

describe("tournament match summaries", () => {
  it("reports checklist progress, recorded outcomes, and scored-match average", () => {
    const summary = summarizeTournamentMatches([
      match({ id: "one", completed: true, result: "won", scoreSelf: 120 }),
      match({ id: "two", completed: true, result: "lost", scoreSelf: 80 }),
      match({ id: "three", completed: false, result: "tie", scoreSelf: null }),
      match({ id: "four", completed: false, result: "upcoming", scoreSelf: 0 }),
    ]);

    expect(summary).toEqual({
      total: 4,
      completed: 2,
      pending: 2,
      wins: 1,
      losses: 1,
      ties: 1,
      recordedOutcomes: 3,
      averageScore: 100,
    });
  });

  it("does not fabricate an average or record for unscored upcoming matches", () => {
    expect(summarizeTournamentMatches([match({})])).toMatchObject({
      total: 1,
      completed: 0,
      pending: 1,
      recordedOutcomes: 0,
      averageScore: null,
    });
  });
});
