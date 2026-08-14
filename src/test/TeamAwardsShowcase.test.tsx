import { render, screen, fireEvent, within, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AwardsPage from "@/app/awards/page";
import {
  AWARDS_DATA,
  filterAwards,
  getTrophyCaseStats,
  validateZeroPiiCompliance,
  type AwardHonor,
} from "@/lib/awardsData";

vi.mock("@/components/SEO", () => ({ default: () => null }));

class MockIntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];
  disconnect = vi.fn();
  observe = vi.fn();
  takeRecords = vi.fn().mockReturnValue([]);
  unobserve = vi.fn();
}

Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});

describe("Team Awards and Honors Showcase Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders page header, trophy case statistics, zero-PII notice, and banner wall", () => {
    render(
      <MemoryRouter>
        <AwardsPage />
      </MemoryRouter>
    );

    // Hero & Title
    expect(
      screen.getByRole("heading", { name: /Trophy Case & Citations/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/FIRST® Tech Challenge Honors Showcase/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Zero-PII Compliance/i)).toBeInTheDocument();

    // Statistics Counter
    const stats = getTrophyCaseStats(AWARDS_DATA);
    const statsSection = screen.getByTestId("trophy-case-stats");
    expect(within(statsSection).getByText(String(stats.totalAwards))).toBeInTheDocument();
    expect(within(statsSection).getByText("Honors Won")).toBeInTheDocument();
    expect(within(statsSection).getByText("Championship Banners")).toBeInTheDocument();
    expect(within(statsSection).getByText("Technical Awards")).toBeInTheDocument();
    expect(within(statsSection).getByText("Community & Culture")).toBeInTheDocument();

    // Championship Banner Wall
    const bannerWall = screen.getByTestId("championship-banners-wall");
    expect(
      within(bannerWall).getByRole("heading", { name: /Championship Banner Wall/i })
    ).toBeInTheDocument();
    expect(
      within(bannerWall).getByRole("heading", { name: /Regional Championship Winning Alliance/i })
    ).toBeInTheDocument();

    // Navigation Links
    expect(
      screen.getByRole("link", { name: /Explore Seasonal Timeline/i })
    ).toHaveAttribute("href", "/seasons");
    expect(
      screen.getByRole("link", { name: /Inspect Robot Fleet/i })
    ).toHaveAttribute("href", "/robots");
  });

  it("filters awards by season correctly when clicking season filter chips", () => {
    render(
      <MemoryRouter>
        <AwardsPage />
      </MemoryRouter>
    );

    const matrixGrid = screen.getByTestId("awards-matrix-grid");

    // Click 2024-2025 season chip
    const seasonButton2024 = screen.getByRole("button", { name: "2024-2025" });
    fireEvent.click(seasonButton2024);

    expect(
      within(matrixGrid).getByRole("heading", { name: "Innovate Award" })
    ).toBeInTheDocument();
    expect(
      within(matrixGrid).getByRole("heading", { name: "Design Award" })
    ).toBeInTheDocument();
    expect(
      within(matrixGrid).queryByRole("heading", { name: "Control Award (1st Place)" })
    ).not.toBeInTheDocument();

    // Click 2025-2026 season chip
    const seasonButton2025 = screen.getByRole("button", { name: "2025-2026" });
    fireEvent.click(seasonButton2025);

    expect(
      within(matrixGrid).getByRole("heading", { name: "Control Award (1st Place)" })
    ).toBeInTheDocument();
    expect(
      within(matrixGrid).getByRole("heading", { name: "Inspire Award Winner" })
    ).toBeInTheDocument();
    expect(
      within(matrixGrid).queryByRole("heading", { name: "Innovate Award" })
    ).not.toBeInTheDocument();

    // Click All to restore
    const seasonGroup = screen.getByRole("group", { name: "Season filter chips" });
    const allButton = within(seasonGroup).getByRole("button", { name: "All" });
    fireEvent.click(allButton);
    expect(
      within(matrixGrid).getByRole("heading", { name: "Innovate Award" })
    ).toBeInTheDocument();
  });

  it("filters awards by category when category filter chips are clicked", () => {
    render(
      <MemoryRouter>
        <AwardsPage />
      </MemoryRouter>
    );

    const matrixGrid = screen.getByTestId("awards-matrix-grid");

    // Click Technical category chip
    const technicalChip = screen.getByRole("button", { name: "Technical" });
    fireEvent.click(technicalChip);

    expect(
      within(matrixGrid).getByRole("heading", { name: "Control Award (1st Place)" })
    ).toBeInTheDocument();
    expect(
      within(matrixGrid).getByRole("heading", { name: "Innovate Award" })
    ).toBeInTheDocument();
    expect(
      within(matrixGrid).getByRole("heading", { name: "Design Award" })
    ).toBeInTheDocument();
    expect(
      within(matrixGrid).queryByRole("heading", { name: "Motivate Award" })
    ).not.toBeInTheDocument();

    // Click Community category chip
    const communityChip = screen.getByRole("button", { name: "Community" });
    fireEvent.click(communityChip);

    expect(
      within(matrixGrid).getByRole("heading", { name: "Motivate Award" })
    ).toBeInTheDocument();
    expect(
      within(matrixGrid).getByRole("heading", { name: "Dean's List Finalist" })
    ).toBeInTheDocument();
    expect(
      within(matrixGrid).queryByRole("heading", { name: "Control Award (1st Place)" })
    ).not.toBeInTheDocument();
  });

  it("filters awards with live keyword search and shows empty state when nothing matches", () => {
    render(
      <MemoryRouter>
        <AwardsPage />
      </MemoryRouter>
    );

    const matrixGrid = screen.getByTestId("awards-matrix-grid");
    const searchInput = screen.getByLabelText(/Search awards and honors/i);
    fireEvent.change(searchInput, { target: { value: "AprilTag" } });

    expect(
      within(matrixGrid).getByRole("heading", { name: "Control Award (1st Place)" })
    ).toBeInTheDocument();
    expect(
      within(matrixGrid).queryByRole("heading", { name: "Motivate Award" })
    ).not.toBeInTheDocument();

    // Type impossible search query
    fireEvent.change(searchInput, { target: { value: "NonExistentAwardSearchQuery999" } });

    expect(
      screen.getByRole("heading", { name: /No Matching Honors Found/i })
    ).toBeInTheDocument();
    const clearBtn = screen.getByRole("button", { name: /Clear All Filters/i });
    fireEvent.click(clearBtn);

    expect(
      within(screen.getByTestId("awards-matrix-grid")).getByRole("heading", { name: "Inspire Award Winner" })
    ).toBeInTheDocument();
  });

  it("opens modal on card click, displays judge citations, subsystems, portfolio refs, and closes via close button and Escape key", () => {
    render(
      <MemoryRouter>
        <AwardsPage />
      </MemoryRouter>
    );

    // Open Inspire Award modal from matrix
    const inspireButton = screen.getByRole("button", {
      name: /Open details and citation for Inspire Award Winner/i,
    });
    act(() => {
      fireEvent.click(inspireButton);
    });

    const modal = screen.getByRole("dialog");
    expect(modal).toBeInTheDocument();

    // Verify modal contents
    expect(
      within(modal).getByRole("heading", { name: "Inspire Award Winner" })
    ).toBeInTheDocument();
    expect(
      within(modal).getByText(/Official Judge Citation/i)
    ).toBeInTheDocument();
    expect(
      within(modal).getByText(/This team embodies the spirit of the FIRST® Tech Challenge in every dimension/i)
    ).toBeInTheDocument();
    expect(
      within(modal).getByText(/Key Robot Subsystem Achievements/i)
    ).toBeInTheDocument();
    expect(
      within(modal).getByText(/Comprehensive Engineering Journey & Mission Impact/i)
    ).toBeInTheDocument();
    expect(
      within(modal).getByRole("link", { name: /Open Season CAD in Onshape/i })
    ).toHaveAttribute("href", "https://cad.onshape.com/ares23247-intothedeep");

    // Test copy citation button
    const copyBtn = within(modal).getByRole("button", { name: /Copy citation text/i });
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
    fireEvent.click(copyBtn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("This team embodies the spirit of the FIRST® Tech Challenge")
    );

    // Close via close button in header
    const closeBtn = within(modal).getByRole("button", { name: /Close award details modal/i });
    act(() => {
      fireEvent.click(closeBtn);
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Reopen and test close via Escape key
    act(() => {
      fireEvent.click(inspireButton);
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    act(() => {
      fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("displays approved public leadership citation in modal for Dean's List Finalist", () => {
    render(
      <MemoryRouter>
        <AwardsPage />
      </MemoryRouter>
    );

    const deansListBtn = screen.getByRole("button", {
      name: /Open details and citation for Dean's List Finalist/i,
    });
    act(() => {
      fireEvent.click(deansListBtn);
    });

    const modal = screen.getByRole("dialog");
    expect(
      within(modal).getByText(/Approved Public Leadership Citation/i)
    ).toBeInTheDocument();
    expect(
      within(modal).getByText(/Lead Student Software Architect & Outreach Coordinator/i)
    ).toBeInTheDocument();
  });

  it("strictly enforces Zero-PII compliance across dataset and rendered DOM", () => {
    // 1. Data model zero PII assertion
    const isPiiCompliant = validateZeroPiiCompliance(AWARDS_DATA);
    expect(isPiiCompliant).toBe(true);

    // 2. DOM text zero PII assertion
    const { container } = render(
      <MemoryRouter>
        <AwardsPage />
      </MemoryRouter>
    );

    const domText = container.textContent || "";
    // Check no unauthorized private emails or phone numbers are rendered
    const emailMatches = domText.match(/[a-zA-Z0-9._%+-]+@(?!aresfirst.org)[a-zA-Z0-9.-]+.[a-zA-Z]{2,}/g);
    expect(emailMatches).toBeNull();

    const phoneMatches = domText.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g);
    expect(phoneMatches).toBeNull();
  });

  it("handles filterAwards helper edge cases correctly", () => {
    // Empty result test
    const noResults = filterAwards(AWARDS_DATA, "2023-2024", "Championship", "xyzNonExistentQuery");
    expect(noResults).toHaveLength(0);

    // Filter by category only
    const techOnly = filterAwards(AWARDS_DATA, "All", "Technical", "");
    expect(techOnly.every((a) => a.category === "Technical")).toBe(true);

    // Filter by season only
    const seasonOnly = filterAwards(AWARDS_DATA, "2024-2025", "All", "");
    expect(seasonOnly.every((a) => a.season === "2024-2025")).toBe(true);
  });

  it("detects PII violation when mock data with private info is tested", () => {
    const dirtyAwards: AwardHonor[] = [
      {
        ...AWARDS_DATA[0],
        id: "dirty-test-award",
        leadershipCitation: "Contact student at student.private@gmail.com or 555-123-4567",
      },
    ];

    expect(validateZeroPiiCompliance(dirtyAwards)).toBe(false);
  });
});
