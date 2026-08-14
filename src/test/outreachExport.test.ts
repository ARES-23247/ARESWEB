import { describe, expect, it } from "vitest";
import {
  buildOutreachCsv,
  computeOutreachStats,
  createOutreachCsvDataUrl,
  currentSeasonLabel,
  escapeSpreadsheetCsvCell,
  outreachMetricValue,
  type OutreachExportRecord,
} from "../lib/outreachExport";

describe("outreachExport utilities", () => {
  const sampleLogs: OutreachExportRecord[] = [
    {
      title: "Hands-on Robotics Workshop",
      date: "2026-03-20",
      location: "Fairmont Activity Center",
      hours: 5.5,
      peopleReached: 65,
      impactSummary: "Guided middle-school teams through autonomous pathing.",
      isDeleted: 0,
    },
    {
      title: "Archived Event",
      date: "2026-01-10",
      hours: 2,
      peopleReached: 10,
      isDeleted: 1,
    },
  ];

  it("filters out deleted records and computes aggregate statistics correctly", () => {
    const stats = computeOutreachStats(sampleLogs);
    expect(stats.activeLogs).toHaveLength(1);
    expect(stats.totalHours).toBe(5.5);
    expect(stats.totalReached).toBe(65);
    expect(stats.totalEvents).toBe(1);
    expect(stats.averageReach).toBe(65);
  });

  it("builds RFC-4180 compliant CSV lines", () => {
    const csv = buildOutreachCsv(sampleLogs);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe('"Title","Date","Location","Volunteer Hours","People Reached","Impact Summary"');
    expect(lines[1]).toContain('"Hands-on Robotics Workshop"');
    expect(lines[1]).toContain('"Fairmont Activity Center"');
    expect(lines[1]).toContain('"5.5"');
    expect(lines[1]).toContain('"65"');
    expect(lines).toHaveLength(2); // header + 1 active log
  });

  it("generates a valid data URL containing UTF-8 BOM", () => {
    const dataUrl = createOutreachCsvDataUrl(sampleLogs);
    expect(dataUrl.startsWith("data:text/csv;charset=utf-8,")).toBe(true);

    const decoded = decodeURIComponent(dataUrl.replace("data:text/csv;charset=utf-8,", ""));
    expect(decoded.startsWith("\uFEFF")).toBe(true);
    expect(decoded).toContain("Hands-on Robotics Workshop");
  });

  it("neutralizes formula injection characters", () => {
    expect(escapeSpreadsheetCsvCell("=SUM(1,2)")).toBe("\"'=SUM(1,2)\"");
    expect(escapeSpreadsheetCsvCell("+12345")).toBe("\"'+12345\"");
    expect(escapeSpreadsheetCsvCell("-DANGEROUS")).toBe("\"'-DANGEROUS\"");
    expect(escapeSpreadsheetCsvCell("@HYPERLINK")).toBe("\"'@HYPERLINK\"");
  });

  it("normalizes non-finite or negative values safely", () => {
    expect(outreachMetricValue(NaN)).toBe(0);
    expect(outreachMetricValue(-10)).toBe(0);
    expect(outreachMetricValue(Infinity)).toBe(0);
    expect(outreachMetricValue("invalid")).toBe(0);
    expect(outreachMetricValue(12)).toBe(12);
  });

  it("computes season labels from dates correctly", () => {
    expect(currentSeasonLabel(new Date("2026-09-01T00:00:00Z"))).toBe("2026–2027");
    expect(currentSeasonLabel(new Date("2026-03-01T00:00:00Z"))).toBe("2025–2026");
  });
});
