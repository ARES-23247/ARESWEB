export interface OutreachExportRecord {
  id?: string | null;
  key?: string;
  title: string;
  date?: string | null;
  location?: string | null;
  hours?: number | null;
  peopleReached?: number | null;
  impactSummary?: string | null;
  isDeleted?: 0 | 1;
}

export function outreachMetricValue(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

export function computeOutreachStats<T extends OutreachExportRecord>(logs: T[]) {
  const activeLogs = logs.filter((log) => log.isDeleted !== 1);
  const totalHours = activeLogs.reduce((sum, log) => sum + outreachMetricValue(log.hours), 0);
  const totalReached = activeLogs.reduce((sum, log) => sum + outreachMetricValue(log.peopleReached), 0);
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
      log.date ?? "",
      log.location ?? "",
      outreachMetricValue(log.hours),
      outreachMetricValue(log.peopleReached),
      log.impactSummary ?? "",
    ]),
  ];

  return rows
    .map((row) => row.map(escapeSpreadsheetCsvCell).join(","))
    .join("\r\n");
}

export function createOutreachCsvDataUrl(logs: OutreachExportRecord[]): string {
  const csv = buildOutreachCsv(logs);
  return `data:text/csv;charset=utf-8,${encodeURIComponent(`\uFEFF${csv}`)}`;
}

export function currentSeasonLabel(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  const startYear = month >= 7 ? year : year - 1;
  return `${startYear}–${startYear + 1}`;
}
