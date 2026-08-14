import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SeasonsPage from "../app/seasons/page";
import { getDocs } from "firebase/firestore";

vi.mock("@/components/SEO", () => ({ default: () => null }));
vi.mock("@/lib/firebaseFirestore", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn(),
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
    startYear: 2025,
    endYear: 2026,
    challengeName: "INTO THE DEEP",
    robotName: "PROMETHEUS",
    robotImage: "https://example.com/robot.jpg",
    robotCadUrl: "https://cad.onshape.com/prometheus",
    summary: "ARES rookie season pushing submersible manipulation boundaries.",
    status: "published",
    isDeleted: 0,
  },
];

const mockAwards = [
  {
    id: 1,
    title: "Innovate Award Winner",
    eventName: "WV State Championship",
    date: "2026-03-01",
    description: "Celebrates a team with ingenuity and innovation in mechanical design.",
    iconType: "trophy",
    status: "published",
    isDeleted: 0,
    seasonId: 1,
  },
];

describe("SeasonsPage Team Legacy & Trophy Case UX", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders seasonal timeline, designated robot assets, and digital trophy case", async () => {
    let callCount = 0;
    vi.mocked(getDocs).mockImplementation(async () => {
      callCount += 1;
      if (callCount % 2 === 1) {
        return {
          docs: mockSeasons.map((data) => ({ id: "season-1", data: () => data })),
        } as unknown as Awaited<ReturnType<typeof getDocs>>;
      }
      return {
        docs: mockAwards.map((data) => ({ id: "award-1", data: () => data })),
      } as unknown as Awaited<ReturnType<typeof getDocs>>;
    });

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
    vi.mocked(getDocs).mockImplementation(async () => {
      return {
        docs: [],
      } as unknown as Awaited<ReturnType<typeof getDocs>>;
    });

    render(
      <MemoryRouter>
        <SeasonsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Legacy records are currently being cataloged...")).toBeInTheDocument();
    expect(screen.getByText("The Case is Open.")).toBeInTheDocument();
  });

  it("displays PublicDataState error component when Firestore fails to load", async () => {
    vi.mocked(getDocs).mockRejectedValue(new Error("Firestore query timeout"));

    render(
      <MemoryRouter>
        <SeasonsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Unable to load team seasons")).toBeInTheDocument();
    expect(screen.getByText("Unable to load team awards")).toBeInTheDocument();
  });
});
