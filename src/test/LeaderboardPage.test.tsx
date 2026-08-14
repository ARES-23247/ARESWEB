import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LeaderboardPage from "../app/leaderboard/page";

const mockSeo = vi.fn();
vi.mock("@/components/SEO", () => ({
  default: (props: { title: string; description: string }) => {
    mockSeo(props);
    return <div data-testid="mock-seo" data-title={props.title} data-description={props.description} />;
  },
}));

vi.mock("@/components/GreekMeander", () => ({
  GreekMeander: (props: { variant?: string; opacity?: string; className?: string }) => (
    <div data-testid="greek-meander" className={props.className} />
  ),
}));

describe("LeaderboardPage STEM Recognition & Truthful Standings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders hero titles, trophy icon, decorative meander, and core disclaimer", () => {
    render(
      <MemoryRouter>
        <LeaderboardPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Recognition program/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: /Team Recognition/i })).toBeInTheDocument();
    expect(
      screen.getByText(/ARES has not published an official member ranking\. We will only show results after the team approves clear rules and verifies the data\./i)
    ).toBeInTheDocument();
    expect(screen.getByTestId("greek-meander")).toBeInTheDocument();
  });

  it("renders the truthfulness status container and FIRST values commitment", () => {
    render(
      <MemoryRouter>
        <LeaderboardPage />
      </MemoryRouter>
    );

    const statusHeading = screen.getByRole("heading", { level: 2, name: /No standings are published/i });
    expect(statusHeading).toBeInTheDocument();
    expect(statusHeading).toHaveAttribute("id", "recognition-status");

    expect(
      screen.getByText(/We removed placeholder names, avatars, badge totals, and ranks\. This page will stay unranked until every result comes from an approved source\./i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/When the program launches, it will support FIRST® values and reward teamwork, inclusion, discovery, and service\./i)
    ).toBeInTheDocument();
  });

  it("renders all three core recognition pillars with headers and descriptions", () => {
    render(
      <MemoryRouter>
        <LeaderboardPage />
      </MemoryRouter>
    );

    // Pillar 1: Teamwork
    expect(screen.getByRole("heading", { level: 2, name: "Teamwork" })).toBeInTheDocument();
    expect(
      screen.getByText("We celebrate members who help the whole team learn and improve.")
    ).toBeInTheDocument();

    // Pillar 2: Impact
    expect(screen.getByRole("heading", { level: 2, name: "Impact" })).toBeInTheDocument();
    expect(
      screen.getByText("Outreach, mentoring, and service matter as much as robot results.")
    ).toBeInTheDocument();

    // Pillar 3: Growth
    expect(screen.getByRole("heading", { level: 2, name: "Growth" })).toBeInTheDocument();
    expect(
      screen.getByText("Recognition should show effort, new skills, and steady progress.")
    ).toBeInTheDocument();
  });

  it("strictly prohibits unverified ranking tables, fake badge counters, or PII leakage", () => {
    render(
      <MemoryRouter>
        <LeaderboardPage />
      </MemoryRouter>
    );

    // Ensure no unverified tables or ranking leaderboards exist
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("row")).not.toBeInTheDocument();
    expect(screen.queryByText(/rank\s*#?[0-9]+/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/badge\s*count/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/points/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/internal-user-id/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/@example\.org/i)).not.toBeInTheDocument();
  });

  it("supplies canonical SEO metadata for public recognition policies", () => {
    render(
      <MemoryRouter>
        <LeaderboardPage />
      </MemoryRouter>
    );

    expect(mockSeo).toHaveBeenCalledWith({
      title: "Team Recognition",
      description:
        "Learn how ARES 23247 plans to recognize teamwork, community impact, and growth without publishing unverified rankings.",
    });
    const seoElement = screen.getByTestId("mock-seo");
    expect(seoElement).toHaveAttribute("data-title", "Team Recognition");
  });

  it("maintains accessible landmark hierarchy and aria labels", () => {
    const { container } = render(
      <MemoryRouter>
        <LeaderboardPage />
      </MemoryRouter>
    );

    const sectionWithLabel = container.querySelector('section[aria-labelledby="recognition-status"]');
    expect(sectionWithLabel).toBeInTheDocument();
    const articles = container.querySelectorAll("article");
    expect(articles).toHaveLength(3);
  });
});
