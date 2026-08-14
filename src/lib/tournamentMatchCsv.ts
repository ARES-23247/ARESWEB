import type { TournamentMatch } from "@/types/tournament";

const CSV_HEADERS = [
  "Match",
  "Status",
  "Alliance",
  "Partner",
  "Opponents",
  "Result",
  "Our Score",
  "Opponent Score",
  "Notes",
] as const;

function csvCell(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value).replace(/\r\n?/g, "\n");
  const protectedValue =
    typeof value === "string" && /^[\t ]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${protectedValue.replace(/"/g, '""')}"`;
}

export function buildTournamentMatchCsv(matches: readonly TournamentMatch[]): string {
  const rows = matches.map((match) => [
    match.matchNumber,
    match.completed ? "Complete" : "Pending",
    match.alliance === "red" ? "Red" : "Blue",
    match.partner,
    match.opponents.join(", "),
    match.result === "upcoming" ? "Upcoming" : match.result,
    match.scoreSelf,
    match.scoreOpponent,
    match.notes,
  ]);

  return [CSV_HEADERS, ...rows]
    .map((row) => row.map((value) => csvCell(value)).join(","))
    .join("\r\n");
}

export function tournamentMatchCsvDataUrl(matches: readonly TournamentMatch[]): string {
  return `data:text/csv;charset=utf-8,%EF%BB%BF${encodeURIComponent(buildTournamentMatchCsv(matches))}`;
}
