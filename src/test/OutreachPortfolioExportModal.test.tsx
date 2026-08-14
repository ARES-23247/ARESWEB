import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import OutreachPortfolioExportModal from "@/app/dashboard/outreach/components/OutreachPortfolioExportModal";
import type { OutreachLog } from "@/app/dashboard/outreach/components/OutreachLogsList";

describe("OutreachPortfolioExportModal", () => {
  const mockLogs: OutreachLog[] = [
    {
      id: "log-1",
      title: "Morgantown Public Library STEM Demo",
      date: "2026-01-15",
      location: "Morgantown Public Library",
      hours: 4,
      peopleReached: 85,
      impactSummary: "Demonstrated robot intake and taught block coding.",
      isDeleted: 0,
    },
    {
      id: "log-2",
      title: "North Elementary Robotics Workshop",
      date: "2026-02-01",
      location: "North Elementary School",
      hours: 3,
      peopleReached: 45,
      impactSummary: "Hands-on drive team workshop with 4th graders.",
      isDeleted: 0,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calculates and renders total impact statistics and event logs", () => {
    render(
      <OutreachPortfolioExportModal
        isOpen={true}
        onClose={vi.fn()}
        logs={mockLogs}
      />
    );

    expect(screen.getByText("FIRST Award & Outreach Impact Portfolio")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument(); // 4 + 3 hours
    expect(screen.getByText("130")).toBeInTheDocument(); // 85 + 45 reached
    expect(screen.getByText("2")).toBeInTheDocument(); // 2 events
    expect(screen.getByText("Morgantown Public Library STEM Demo")).toBeInTheDocument();
    expect(screen.getByText("North Elementary Robotics Workshop")).toBeInTheDocument();
  });

  it("switches to CSV export tab and triggers download", () => {
    const createObjectURLMock = vi.fn().mockReturnValue("blob:mock-url");
    const revokeObjectURLMock = vi.fn();
    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;

    render(
      <OutreachPortfolioExportModal
        isOpen={true}
        onClose={vi.fn()}
        logs={mockLogs}
      />
    );

    const csvTabBtn = screen.getByRole("button", { name: /CSV Data Export/i });
    fireEvent.click(csvTabBtn);

    expect(screen.getByText(/Spreadsheet Export/i)).toBeInTheDocument();
    const downloadBtn = screen.getByRole("button", { name: /Download CSV/i });
    fireEvent.click(downloadBtn);

    expect(createObjectURLMock).toHaveBeenCalled();
  });

  it("switches to certificate tab and updates recipient name", () => {
    render(
      <OutreachPortfolioExportModal
        isOpen={true}
        onClose={vi.fn()}
        logs={mockLogs}
      />
    );

    const certTabBtn = screen.getByRole("button", { name: /Volunteer Certificate/i });
    fireEvent.click(certTabBtn);

    const nameInput = screen.getByPlaceholderText("e.g. Alex Morgan");
    fireEvent.change(nameInput, { target: { value: "Sam Taylor" } });

    expect(screen.getByText("Sam Taylor")).toBeInTheDocument();
  });

  it("triggers window.print when print button is clicked", () => {
    const printMock = vi.fn();
    window.print = printMock;

    render(
      <OutreachPortfolioExportModal
        isOpen={true}
        onClose={vi.fn()}
        logs={mockLogs}
      />
    );

    const printBtn = screen.getByRole("button", { name: /Print \/ Save PDF/i });
    fireEvent.click(printBtn);

    expect(printMock).toHaveBeenCalled();
  });
});
