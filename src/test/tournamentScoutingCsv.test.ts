import { describe, it, expect } from "vitest";
import {
  buildTournamentScoutingCsv,
  tournamentScoutingCsvDataUrl,
} from "@/lib/tournamentScoutingCsv";
import type { Tournament } from "@/types/tournament";

describe("tournamentScoutingCsv", () => {
  const mockTournament: Tournament = {
    id: "test-tourney",
    name: "WV State Championship",
    date: "2026-03-01",
    location: "Fairmont, WV",
    status: "upcoming",
    opr: 185.4,
    oprList: [
      { teamNumber: "23247", teamName: "ARES", opr: 185.4 },
      { teamNumber: "14210", teamName: "Quantum Leap", opr: 192.1 },
      { teamNumber: "18214", teamName: "=SUM(A1:A5)", opr: 160.0 },
    ],
    isDeleted: 0,
  };

  it("sorts teams by OPR descending and formats CSV rows correctly", () => {
    const csv = buildTournamentScoutingCsv(mockTournament);
    const lines = csv.split("\r\n");

    expect(lines[0]).toBe('"Rank","Team Number","Team Name","OPR","Is ARES"');
    // Quantum Leap is Rank 1 with 192.1
    expect(lines[1]).toBe('"1","14210","Quantum Leap","192.1","No"');
    // ARES is Rank 2 with 185.4
    expect(lines[2]).toBe('"2","23247","ARES","185.4","Yes"');
    // Formula injected name is escaped with single quote
    expect(lines[3]).toBe('"3","18214","\'=SUM(A1:A5)","160","No"');
  });

  it("handles tournament with empty oprList gracefully", () => {
    const emptyTourney: Tournament = {
      id: "empty",
      name: "Empty Event",
      date: "2026-03-01",
      location: "Morgantown",
      status: "upcoming",
      isDeleted: 0,
    };
    const csv = buildTournamentScoutingCsv(emptyTourney);
    expect(csv).toBe('"Rank","Team Number","Team Name","OPR","Is ARES"');
  });

  it("generates a valid data URL with UTF-8 BOM", () => {
    const dataUrl = tournamentScoutingCsvDataUrl(mockTournament);
    expect(dataUrl.startsWith("data:text/csv;charset=utf-8,%EF%BB%BF")).toBe(true);
    expect(dataUrl).toContain(encodeURIComponent("Quantum Leap"));
  });
});
