import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OutreachPortfolioExportModal from "@/app/dashboard/outreach/components/OutreachPortfolioExportModal";
import {
  buildOutreachCsv,
  computeOutreachStats,
  currentSeasonLabel,
} from "@/lib/outreachExport";
import type { OutreachLog } from "@/app/dashboard/outreach/components/OutreachLogsList";

describe("OutreachPortfolioExportModal", () => {
  const logs: OutreachLog[] = [
    {
      id: "log-1",
      title: "Library STEM Demo",
      date: "2026-01-15",
      location: "Morgantown Public Library",
      hours: 4,
      peopleReached: 85,
      impactSummary: "Demonstrated the robot.",
      isDeleted: 0,
    },
    {
      id: "log-2",
      title: "Archived Workshop",
      date: "2026-02-01",
      hours: 3,
      peopleReached: 45,
      isDeleted: 1,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("summarizes only active records without claiming third-party verification", () => {
    render(<OutreachPortfolioExportModal isOpen onClose={vi.fn()} logs={logs} />);

    expect(screen.getByRole("dialog", { name: "Outreach impact report" })).toBeInTheDocument();
    expect(screen.getByText("Library STEM Demo")).toBeInTheDocument();
    expect(screen.queryByText("Archived Workshop")).not.toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getAllByText("85")).toHaveLength(2);
    expect(screen.queryByText(/certificate|verified volunteer/i)).not.toBeInTheDocument();
  });

  it("supports keyboard tab navigation and downloads a CSV", () => {
    Object.defineProperty(URL, "createObjectURL", { value: vi.fn(() => "blob:report"), configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    render(<OutreachPortfolioExportModal isOpen onClose={vi.fn()} logs={logs} />);

    const reportTab = screen.getByRole("tab", { name: "Impact report" });
    reportTab.focus();
    fireEvent.keyDown(reportTab, { key: "ArrowRight" });

    expect(screen.getByRole("tab", { name: "CSV data export" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("button", { name: "Download CSV" }));
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:report");
  });

  it("prints the report and closes with Escape", () => {
    const onClose = vi.fn();
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    render(<OutreachPortfolioExportModal isOpen onClose={onClose} logs={logs} />);

    fireEvent.click(screen.getByRole("button", { name: "Print / Save PDF" }));
    expect(print).toHaveBeenCalled();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("neutralizes spreadsheet formulas and quotes every CSV cell", () => {
    const malicious: OutreachLog = {
      ...logs[0],
      id: "formula",
      title: "=HYPERLINK(\"https://evil.example\")",
      location: "+SUM(1,1)",
      impactSummary: "@cmd",
    };
    const csv = buildOutreachCsv([malicious]);

    expect(csv).toContain("\"'=HYPERLINK(\"\"https://evil.example\"\")\"");
    expect(csv).toContain("\"'+SUM(1,1)\"");
    expect(csv).toContain("\"'@cmd\"");
    expect(csv.split("\r\n")).toHaveLength(2);
  });

  it("normalizes non-finite or negative aggregate values", () => {
    const invalid = { ...logs[0], hours: Number.POSITIVE_INFINITY, peopleReached: -5 };
    expect(computeOutreachStats([invalid])).toMatchObject({ totalHours: 0, totalReached: 0 });
  });

  it("derives the season label from the report date", () => {
    expect(currentSeasonLabel(new Date("2026-08-14T12:00:00Z"))).toBe("2026–2027");
    expect(currentSeasonLabel(new Date("2026-02-14T12:00:00Z"))).toBe("2025–2026");
  });
});
