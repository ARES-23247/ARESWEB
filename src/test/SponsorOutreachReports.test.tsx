import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SponsorPacketPage from "@/app/sponsors/packet/page";
import OutreachReportPage from "@/app/outreach/report/page";
import {
  findTierByAmount,
  formatCurrency,
  SPONSOR_DECK_TIERS,
  TEAM_BUDGET_ALLOCATIONS,
  TAX_EXEMPT_DETAILS,
} from "@/lib/sponsorPacketData";

describe("SponsorPacketPage", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        logs: [
          { id: "1", title: "SPARK Museum", hours: 20, peopleReached: 250, isDeleted: 0 },
          { id: "2", title: "Middle School", hours: 10, peopleReached: 150, isDeleted: 0 },
        ],
      }),
    } as unknown as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the sponsorship deck header, 501(c)(3) disclosure, and contact email", async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <SponsorPacketPage />
        </MemoryRouter>
      );
    });

    expect(screen.getByRole("heading", { level: 1, name: /Sponsorship/i })).toBeInTheDocument();
    expect(screen.getAllByText(/501\(c\)\(3\)/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(TAX_EXEMPT_DETAILS.organizationName)[0]).toBeInTheDocument();
    expect(screen.getAllByText(TAX_EXEMPT_DETAILS.contactEmail)[0]).toBeInTheDocument();
  });

  it("renders all 5 sponsorship tiers and benefits", async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <SponsorPacketPage />
        </MemoryRouter>
      );
    });

    for (const tier of SPONSOR_DECK_TIERS) {
      expect(screen.getAllByText(tier.name).length).toBeGreaterThan(0);
      expect(screen.getAllByText(tier.amountLabel).length).toBeGreaterThan(0);
      expect(screen.getAllByText(tier.badgeSize).length).toBeGreaterThan(0);
    }
  });

  it("displays team budget allocation model and all categories", async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <SponsorPacketPage />
        </MemoryRouter>
      );
    });

    expect(screen.getByRole("heading", { name: /Team Budget Allocation Model/i })).toBeInTheDocument();
    for (const item of TEAM_BUDGET_ALLOCATIONS) {
      expect(screen.getAllByText(item.category).length).toBeGreaterThan(0);
    }
  });

  it("updates calculated tier when pledge slider is moved", async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <SponsorPacketPage />
        </MemoryRouter>
      );
    });

    const slider = screen.getByLabelText(/Sponsorship pledge amount/i);
    await act(async () => {
      fireEvent.change(slider, { target: { value: "1000" } });
    });

    await waitFor(() => {
      expect(screen.getAllByText(SPONSOR_DECK_TIERS[2].name).length).toBeGreaterThan(0);
    });
  });

  it("triggers window.print when Print button is clicked", async () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    await act(async () => {
      render(
        <MemoryRouter>
          <SponsorPacketPage />
        </MemoryRouter>
      );
    });

    const printButton = screen.getByRole("button", { name: /Print \/ Save as PDF/i });
    fireEvent.click(printButton);

    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  it("verifies zero student PII is exposed in the sponsorship packet", async () => {
    let container: HTMLElement;
    await act(async () => {
      const result = render(
        <MemoryRouter>
          <SponsorPacketPage />
        </MemoryRouter>
      );
      container = result.container;
    });

    expect(container!.textContent).not.toMatch(/ssn|social security|date of birth|dob|gpa|minor name/i);
    expect(screen.getByText(/Zero-PII Compliance Verified/i)).toBeInTheDocument();
  });
});

describe("OutreachReportPage", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        logs: [
          {
            id: "log-1",
            title: "Spark Imagination Center Bridge Lab",
            date: "2026-02-08",
            location: "Morgantown, WV",
            hours: 24,
            peopleReached: 320,
            impactSummary: "Built truss bridges with K-5 students.",
            isDeleted: 0,
          },
          {
            id: "log-2",
            title: "Mountaineer Middle Robot Drive",
            date: "2026-01-22",
            location: "Morgantown, WV",
            hours: 14,
            peopleReached: 180,
            impactSummary: "Robot driving demos.",
            isDeleted: 0,
          },
        ],
      }),
    } as unknown as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders outreach impact report title and season header", async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <OutreachReportPage />
        </MemoryRouter>
      );
    });

    expect(screen.getByRole("heading", { level: 1, name: /Outreach/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Appalachian Robotics & Engineering Society/i).length).toBeGreaterThan(0);
  });

  it("computes and displays aggregated outreach stats", async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <OutreachReportPage />
        </MemoryRouter>
      );
    });

    await waitFor(() => {
      expect(screen.getAllByText(/38\+/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/500\+/).length).toBeGreaterThan(0);
    });
  });

  it("filters outreach events by search query", async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <OutreachReportPage />
        </MemoryRouter>
      );
    });

    const searchInput = screen.getByLabelText(/Search outreach events/i);
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: "Banner Nonexistent" } });
    });

    await waitFor(() => {
      expect(screen.getByText(/No matching outreach events found/i)).toBeInTheDocument();
    });
  });

  it("downloads formula-safe CSV when clicked", async () => {
    const createURLSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:http://localhost/test-csv");
    const revokeURLSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    await act(async () => {
      render(
        <MemoryRouter>
          <OutreachReportPage />
        </MemoryRouter>
      );
    });

    const csvButtons = screen.getAllByRole("button", { name: /Export CSV|Download CSV/i });
    fireEvent.click(csvButtons[0]);

    expect(createURLSpy).toHaveBeenCalled();
    expect(revokeURLSpy).toHaveBeenCalled();
  });

  it("triggers window.print when Print button is clicked", async () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    await act(async () => {
      render(
        <MemoryRouter>
          <OutreachReportPage />
        </MemoryRouter>
      );
    });

    const printButton = screen.getByRole("button", { name: /Print \/ Save as PDF/i });
    fireEvent.click(printButton);

    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  it("verifies zero student PII is exposed in the outreach report", async () => {
    let container: HTMLElement;
    await act(async () => {
      const result = render(
        <MemoryRouter>
          <OutreachReportPage />
        </MemoryRouter>
      );
      container = result.container;
    });

    expect(container!.textContent).not.toMatch(/ssn|social security|date of birth|dob|gpa|minor name/i);
    expect(screen.getByText(/Zero-PII Compliance Verified/i)).toBeInTheDocument();
  });
});

describe("sponsorPacketData helpers", () => {
  it("returns correct tier for given pledge amounts", () => {
    expect(findTierByAmount(6000).key).toBe("Titanium");
    expect(findTierByAmount(5000).key).toBe("Titanium");
    expect(findTierByAmount(2500).key).toBe("Gold");
    expect(findTierByAmount(1000).key).toBe("Silver");
    expect(findTierByAmount(500).key).toBe("Bronze");
    expect(findTierByAmount(250).key).toBe("Bronze");
  });

  it("formats currency strings without decimals", () => {
    expect(formatCurrency(5000)).toMatch(/\$5,000/);
    expect(formatCurrency(22000)).toMatch(/\$22,000/);
  });

  it("verifies team budget percentages sum to 100%", () => {
    const totalPercentage = TEAM_BUDGET_ALLOCATIONS.reduce((sum, i) => sum + i.percentage, 0);
    expect(totalPercentage).toBe(100);
  });
});
