import { describe, expect, it } from "vitest";
import { buildTournamentMatchCsv, tournamentMatchCsvDataUrl } from "@/lib/tournamentMatchCsv";
import type { TournamentMatch } from "@/types/tournament";

function match(overrides: Partial<TournamentMatch> = {}): TournamentMatch {
  return {
    id: "match-1",
    tournamentId: "event-1",
    matchNumber: "QM3",
    alliance: "red",
    partner: "12345",
    opponents: ["111", "222"],
    scoreSelf: 87,
    scoreOpponent: 64,
    result: "won",
    completed: true,
    isDeleted: 0,
    notes: "Clean run",
    ...overrides,
  };
}

describe("tournament match CSV", () => {
  it("exports the event-day record in a stable column order", () => {
    expect(buildTournamentMatchCsv([match()])).toBe(
      '"Match","Status","Alliance","Partner","Opponents","Result","Our Score","Opponent Score","Notes"\r\n' +
        '"QM3","Complete","Red","12345","111, 222","won","87","64","Clean run"',
    );
  });

  it("preserves multiline notes, escapes quotes, and leaves absent scores empty", () => {
    const csv = buildTournamentMatchCsv([
      match({
        completed: false,
        alliance: "blue",
        result: "upcoming",
        scoreSelf: null,
        scoreOpponent: undefined,
        notes: 'Driver said "retry"\r\nCheck intake',
      }),
    ]);

    expect(csv).toContain('"Pending","Blue"');
    expect(csv).toContain('"Upcoming","",""');
    expect(csv).toContain('"Driver said ""retry""\nCheck intake"');
  });

  it("neutralizes spreadsheet formulas in user-controlled cells", () => {
    const csv = buildTournamentMatchCsv([
      match({
        matchNumber: "=HYPERLINK(\"https://example.test\")",
        partner: " +SUM(1,1)",
        opponents: ["@IMPORTDATA(example.test)"],
        notes: "-2+3",
      }),
    ]);

    expect(csv).toContain('"\'=HYPERLINK(""https://example.test"")"');
    expect(csv).toContain('"\' +SUM(1,1)"');
    expect(csv).toContain('"\'@IMPORTDATA(example.test)"');
    expect(csv).toContain('"\'-2+3"');
  });

  it("builds a UTF-8 CSV download URL", () => {
    const url = tournamentMatchCsvDataUrl([match({ notes: "café" })]);

    expect(url).toMatch(/^data:text\/csv;charset=utf-8,%EF%BB%BF/);
    expect(decodeURIComponent(url.split("%EF%BB%BF")[1])).toContain('"café"');
  });
});
