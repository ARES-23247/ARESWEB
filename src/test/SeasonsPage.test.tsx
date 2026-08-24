import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SeasonsPage from "../app/seasons/page";
import { fetchPublicAwards, fetchPublicSeasons } from "@/lib/publicContentApi";

vi.mock("@/components/SEO", () => ({ default: () => null }));
vi.mock("@/lib/publicContentApi", () => ({
  fetchPublicAwards: vi.fn(),
  fetchPublicSeasons: vi.fn(),
}));

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

const mockSeasons = [
  {
    id: "season-1",
    startYear: 2025,
    endYear: 2026,
    challengeName: "INTO THE DEEP",
    robotName: "PROMETHEUS",
    robotImage: "https://example.com/robot.jpg",
    robotCadUrl: "https://cad.onshape.com/prometheus",
    summary: "ARES rookie season pushing submersible manipulation boundaries.",
    status: "published",
  },
];

const mockAwards = [
  {
    id: "award-1",
    title: "Innovate Award Winner",
    eventName: "WV State Championship",
    date: "2026-03-01",
    description: "Celebrates a team with ingenuity and innovation in mechanical design.",
    iconType: "trophy",
    status: "published",
    seasonId: "season-1",
  },
];

describe("SeasonsPage Team Legacy & Trophy Case UX", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders seasonal timeline, designated robot assets, and digital trophy case", async () => {
    vi.mocked(fetchPublicSeasons).mockResolvedValue(mockSeasons);
    vi.mocked(fetchPublicAwards).mockResolvedValue(mockAwards);

    render(
      <MemoryRouter>
        <SeasonsPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "INTO THE DEEP" })).toBeInTheDocument();
    expect(screen.getByText("PROMETHEUS")).toBeInTheDocument();
    expect(screen.getByText(/ARES rookie season pushing submersible manipulation boundaries/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /CAD REPOSITORY/i })).toHaveAttribute("href", "https://cad.onshape.com/prometheus");

    expect(await screen.findByRole("heading", { name: "Innovate Award Winner" })).toBeInTheDocument();
    expect(screen.getByText(/WV State Championship/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /SPONSOR ARES/i })).toHaveAttribute("href", "/sponsors");
    expect(screen.getByRole("link", { name: /JOIN THE TEAM/i })).toHaveAttribute("href", "/join");
  });

  it("displays cataloging placeholders when seasons and awards are empty", async () => {
    vi.mocked(fetchPublicSeasons).mockResolvedValue([]);
    vi.mocked(fetchPublicAwards).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <SeasonsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Legacy records are currently being cataloged...")).toBeInTheDocument();
    expect(screen.getByText("The Case is Open.")).toBeInTheDocument();
  });

  it("displays PublicDataState error component when the DTO APIs fail to load", async () => {
    vi.mocked(fetchPublicSeasons).mockRejectedValue(new Error("Content API timeout"));
    vi.mocked(fetchPublicAwards).mockRejectedValue(new Error("Content API timeout"));

    render(
      <MemoryRouter>
        <SeasonsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Unable to load team seasons")).toBeInTheDocument();
    expect(screen.getByText("Unable to load team awards")).toBeInTheDocument();
  });
});
