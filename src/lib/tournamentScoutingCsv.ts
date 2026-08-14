import type { Tournament } from "@/types/tournament";

const CSV_HEADERS = [
  "Rank",
  "Team Number",
  "Team Name",
  "OPR",
  "Is ARES",
] as const;

function csvCell(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value).replace(/\r\n?/g, "\n");
  const protectedValue =
    typeof value === "string" && /^[\t ]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${protectedValue.replace(/"/g, '""')}"`;
}

export function buildTournamentScoutingCsv(tournament: Tournament): string {
  const sortedOpr = [...(tournament.oprList ?? [])].sort(
    (a, b) => (Number(b.opr) || 0) - (Number(a.opr) || 0)
  );

  const rows = sortedOpr.map((entry, index) => {
    const isAres = entry.teamNumber === "23247" ? "Yes" : "No";
    return [
      index + 1,
      entry.teamNumber,
      entry.teamName,
      entry.opr,
      isAres,
    ];
  });

  return [CSV_HEADERS, ...rows]
    .map((row) => row.map((value) => csvCell(value)).join(","))
    .join("\r\n");
}

export function tournamentScoutingCsvDataUrl(tournament: Tournament): string {
  return `data:text/csv;charset=utf-8,%EF%BB%BF${encodeURIComponent(buildTournamentScoutingCsv(tournament))}`;
}
