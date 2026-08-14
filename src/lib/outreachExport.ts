export interface OutreachExportRecord {
  title: string;
  date: string;
  location?: string | null;
  hours: number;
  peopleReached: number;
  impactSummary?: string | null;
  isDeleted: 0 | 1;
}

function nonnegativeFinite(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

export function computeOutreachStats<T extends OutreachExportRecord>(logs: T[]) {
  const activeLogs = logs.filter((log) => log.isDeleted !== 1);
  const totalHours = activeLogs.reduce((sum, log) => sum + nonnegativeFinite(log.hours), 0);
  const totalReached = activeLogs.reduce((sum, log) => sum + nonnegativeFinite(log.peopleReached), 0);
  return {
    activeLogs,
    totalHours,
    totalReached,
    totalEvents: activeLogs.length,
    averageReach: activeLogs.length > 0 ? Math.round(totalReached / activeLogs.length) : 0,
  };
}

export function escapeSpreadsheetCsvCell(value: unknown): string {
  let text = String(value ?? "").replace(/[\r\n]+/g, " ");
  if (/^\s*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildOutreachCsv(logs: OutreachExportRecord[]): string {
  const { activeLogs } = computeOutreachStats(logs);
  const rows: unknown[][] = [
    ["Title", "Date", "Location", "Volunteer Hours", "People Reached", "Impact Summary"],
    ...activeLogs.map((log) => [
      log.title,
      log.date,
      log.location || "",
      nonnegativeFinite(log.hours),
      nonnegativeFinite(log.peopleReached),
      log.impactSummary || "",
    ]),
  ];
  return rows.map((row) => row.map(escapeSpreadsheetCsvCell).join(",")).join("\r\n");
}

export function currentSeasonLabel(date: Date): string {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 6 ? year : year - 1;
  return `${startYear}–${startYear + 1}`;
}

export function outreachMetricValue(value: unknown): number {
  return nonnegativeFinite(value);
}
