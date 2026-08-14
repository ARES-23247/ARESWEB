import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AboutPage from "../app/about/page";

vi.mock("@/components/SEO", () => ({ default: () => null }));
vi.mock("@/components/GreekMeander", () => ({ GreekMeander: () => null }));

function jsonResponse(body: unknown, status = 200, statusText = "OK"): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

const mockRoster = {
  members: [
    {
      nickname: "Alex M.",
      pronouns: "they/them",
      subteams: ["Programming", "Strategy"],
      memberType: "student" as const,
      bio: "Autonomous pathing specialist.",
      funFact: "Solved a 1000-piece Rubik's cube equivalent in code.",
    },
    {
      nickname: "Dr. Dave",
      pronouns: "he/him",
      subteams: ["Mentorship", "Drive Practice"],
      memberType: "coach" as const,
      bio: "Lead FTC coach and systems mentor.",
      funFact: "Has coached FTC teams for over a decade.",
    },
    {
      nickname: "Sarah C.",
      pronouns: "she/her",
      subteams: ["CAD", "Fabrication"],
      memberType: "mentor" as const,
      bio: "Mechanical engineering industry mentor.",
    },
    {
      nickname: "Jason R.",
      subteams: ["Design"],
      memberType: "alumni" as const,
      colleges: ["WVU Engineering"],
      bio: "Founding member of ARES 23247.",
    },
  ],
};

describe("AboutPage Roster Presentation & Privacy", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders approved roster fields but ignores private fun facts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(mockRoster)));

    render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Alex M." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dr. Dave" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sarah C." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Jason R." })).toBeInTheDocument();

    // Verify role badges
    expect(screen.getByText("student")).toBeInTheDocument();
    expect(screen.getByText("coach")).toBeInTheDocument();
    expect(screen.getByText("mentor")).toBeInTheDocument();
    expect(screen.getByText("alumni")).toBeInTheDocument();

    expect(screen.queryByText("they/them")).not.toBeInTheDocument();
    expect(screen.queryByText("Autonomous pathing specialist.")).not.toBeInTheDocument();
    expect(screen.queryByText("Programming")).not.toBeInTheDocument();
    expect(screen.getByText(/he\/him/)).toBeInTheDocument();
    expect(screen.getByText("Lead FTC coach and systems mentor.")).toBeInTheDocument();
    expect(screen.queryByText(/Solved a 1000-piece Rubik's cube/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Has coached FTC teams for over a decade/i)).not.toBeInTheDocument();
  });

  it("filters roster members accurately when clicking category tabs", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(mockRoster)));

    render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    );

    await screen.findByRole("heading", { name: "Alex M." });

    // Filter by Coaches
    fireEvent.click(screen.getByRole("button", { name: /Coaches/i }));
    expect(screen.getByRole("heading", { name: "Dr. Dave" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Alex M." })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sarah C." })).not.toBeInTheDocument();

    // Filter by Mentors
    fireEvent.click(screen.getByRole("button", { name: /Mentors/i }));
    expect(screen.getByRole("heading", { name: "Sarah C." })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Dr. Dave" })).not.toBeInTheDocument();

    // Filter by Alumni
    fireEvent.click(screen.getByRole("button", { name: /Alumni/i }));
    expect(screen.getByRole("heading", { name: "Jason R." })).toBeInTheDocument();
    expect(screen.getByText("WVU Engineering")).toBeInTheDocument();
  });
});
