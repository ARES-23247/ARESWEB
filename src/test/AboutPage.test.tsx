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

const mockComprehensiveRoster = {
  members: [
    {
      nickname: "Dr. Dave",
      pronouns: "he/him",
      subteams: ["Strategy", "Drive Coaching"],
      memberType: "coach" as const,
      avatar: "https://example.com/avatars/dr-dave.webp",
      bio: "Lead FTC coach and systems architect.",
      funFact: "Has coached robotics teams for over a decade.",
    },
    {
      nickname: "Sarah C.",
      pronouns: "she/her",
      subteams: ["CAD", "Fabrication"],
      memberType: "mentor" as const,
      avatar: "https://example.com/avatars/sarah.webp",
      bio: "Industry mechanical engineering mentor.",
      funFact: "Mentored 3 championship robot designs.",
    },
    {
      nickname: "Alex M.",
      pronouns: "they/them",
      subteams: ["Programming", "Autonomous"],
      memberType: "student" as const,
      avatar: "https://example.com/avatars/alex.webp",
      bio: "Autonomous pathing specialist.",
      funFact: "Programmed pure pursuit algorithms from scratch.",
      colleges: ["Should Be Hidden College"],
    },
    {
      nickname: "Bob T.",
      subteams: ["Hardware", "Wiring"],
      memberType: "student" as const,
      // Insecure avatar url (http instead of https)
      avatar: "http://insecure.example.com/bob.jpg",
      bio: "Drivetrain assembly lead.",
    },
    {
      nickname: "Maya K.",
      pronouns: "she/her",
      subteams: ["Strategy"],
      memberType: "student" as const,
      // No avatar provided
      bio: "Match scouting and strategy lead.",
    },
    {
      nickname: "Jason R.",
      subteams: ["Design", "Strategy"],
      memberType: "alumni" as const,
      avatar: "https://example.com/avatars/jason.webp",
      bio: "Founding student lead, now mentoring collegiate robotics.",
      colleges: ["WVU Engineering"],
      funFact: "Built the team's first custom chassis.",
    },
    {
      // Parent role or unapproved member type should be filtered out
      nickname: "Unapproved Parent",
      memberType: "parent" as const,
      bio: "Team parent booster.",
    },
  ],
};

describe("AboutPage Comprehensive Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Hero, Branding & Institutional Legacy", () => {
    it("renders hero section with title, heritage banner, and mission statement", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ members: [] })));

      render(
        <MemoryRouter>
          <AboutPage />
        </MemoryRouter>
      );

      expect(await screen.findByText("No published team members match this filter.")).toBeInTheDocument();
      expect(screen.getByText(/Our Community & Heritage/i)).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 1, name: /About ARES/i })).toBeInTheDocument();
      expect(screen.getByText(/Appalachian Robotics & Engineering Society/i)).toBeInTheDocument();
      expect(screen.getByText(/FTC #23247/i)).toBeInTheDocument();
      expect(screen.getByText(/incubator for West Virginia's next generation of technical leaders/i)).toBeInTheDocument();
    });

    it("renders Mountaineer Mindset Ethos and FRC 2614 MARS legacy support", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ members: [] })));

      render(
        <MemoryRouter>
          <AboutPage />
        </MemoryRouter>
      );

      expect(await screen.findByText("No published team members match this filter.")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /The Mountaineer Mindset Ethos/i })).toBeInTheDocument();
      expect(screen.getByText(/Supported by FRC 2614 MARS/i)).toBeInTheDocument();
      expect(screen.getByText(/Robotics is hard. Code breaks, gears slip, and systems bind/i)).toBeInTheDocument();
      expect(screen.getByText(/high-frequency, telemetry-driven systems from scratch/i)).toBeInTheDocument();
    });

    it("renders core principle vehicle/cargo quote and link to join application", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ members: [] })));

      render(
        <MemoryRouter>
          <AboutPage />
        </MemoryRouter>
      );

      expect(await screen.findByText("No published team members match this filter.")).toBeInTheDocument();
      expect(screen.getByText("Our Primary Principle")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: /The robots are the vehicle; the students are the cargo/i })
      ).toBeInTheDocument();

      const joinLink = screen.getByRole("link", { name: /Apply to Join the Roster/i });
      expect(joinLink).toBeInTheDocument();
      expect(joinLink).toHaveAttribute("href", "/join");
    });
  });

  describe("Leadership Tier Cards & Role Hierarchy Sorting", () => {
    it("renders members in canonical role order (Coach -> Mentor -> Student -> Alumni) then alphabetically", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(mockComprehensiveRoster)));

      render(
        <MemoryRouter>
          <AboutPage />
        </MemoryRouter>
      );

      expect(await screen.findByRole("heading", { name: "Dr. Dave" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Sarah C." })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Alex M." })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Bob T." })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Maya K." })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Jason R." })).toBeInTheDocument();

      // Ensure headings in DOM follow coach -> mentor -> students (Alex, Bob, Maya) -> alumni (Jason)
      const memberHeadings = screen
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent?.trim())
        .filter((name) => ["Dr. Dave", "Sarah C.", "Alex M.", "Bob T.", "Maya K.", "Jason R."].includes(name ?? ""));

      expect(memberHeadings).toEqual([
        "Dr. Dave", // coach
        "Sarah C.", // mentor
        "Alex M.", // student (A)
        "Bob T.", // student (B)
        "Maya K.", // student (M)
        "Jason R.", // alumni
      ]);
    });

    it("displays member role badges, pronouns, bios, fun facts, and subteams", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(mockComprehensiveRoster)));

      render(
        <MemoryRouter>
          <AboutPage />
        </MemoryRouter>
      );

      await screen.findByRole("heading", { name: "Dr. Dave" });

      // Badges
      expect(screen.getByText("coach")).toBeInTheDocument();
      expect(screen.getByText("mentor")).toBeInTheDocument();
      expect(screen.getAllByText("student").length).toBe(3);
      expect(screen.getByText("alumni")).toBeInTheDocument();

      // Pronouns
      expect(screen.getByText("(he/him)")).toBeInTheDocument();
      expect(screen.getByText("(they/them)")).toBeInTheDocument();
      expect(screen.getAllByText("(she/her)").length).toBe(2);

      // Bios
      expect(screen.getByText("Lead FTC coach and systems architect.")).toBeInTheDocument();
      expect(screen.getByText("Autonomous pathing specialist.")).toBeInTheDocument();

      // Fun facts
      expect(screen.getByText(/Has coached robotics teams for over a decade/i)).toBeInTheDocument();
      expect(screen.getByText(/Programmed pure pursuit algorithms from scratch/i)).toBeInTheDocument();

      // Subteam pills
      expect(screen.getByText("Drive Coaching")).toBeInTheDocument();
      expect(screen.getByText("Autonomous")).toBeInTheDocument();
      expect(screen.getByText("Drivetrain assembly lead.")).toBeInTheDocument();
    });
  });

  describe("Interactive Filtering & Roster Refresh", () => {
    it("filters members by category tabs and updates the view", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(mockComprehensiveRoster)));

      render(
        <MemoryRouter>
          <AboutPage />
        </MemoryRouter>
      );

      await screen.findByRole("heading", { name: "Dr. Dave" });

      // Filter: Students
      fireEvent.click(screen.getByRole("button", { name: /Students/i }));
      expect(screen.getByRole("heading", { name: "Alex M." })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Bob T." })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Maya K." })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Dr. Dave" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Sarah C." })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Jason R." })).not.toBeInTheDocument();

      // Filter: Mentors
      fireEvent.click(screen.getByRole("button", { name: /Mentors/i }));
      expect(screen.getByRole("heading", { name: "Sarah C." })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Alex M." })).not.toBeInTheDocument();

      // Filter: Coaches
      fireEvent.click(screen.getByRole("button", { name: /Coaches/i }));
      expect(screen.getByRole("heading", { name: "Dr. Dave" })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Sarah C." })).not.toBeInTheDocument();

      // Filter: Alumni
      fireEvent.click(screen.getByRole("button", { name: /Alumni/i }));
      expect(screen.getByRole("heading", { name: "Jason R." })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Dr. Dave" })).not.toBeInTheDocument();

      // Return to All Members
      fireEvent.click(screen.getByRole("button", { name: /All Members/i }));
      expect(screen.getByRole("heading", { name: "Dr. Dave" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Alex M." })).toBeInTheDocument();
    });

    it("displays empty state message when a filtered category has no members", async () => {
      const rosterWithoutCoaches = {
        members: [
          {
            nickname: "Alex M.",
            memberType: "student" as const,
            subteams: ["Programming"],
          },
        ],
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(rosterWithoutCoaches)));

      render(
        <MemoryRouter>
          <AboutPage />
        </MemoryRouter>
      );

      await screen.findByRole("heading", { name: "Alex M." });

      // Click Coaches filter
      fireEvent.click(screen.getByRole("button", { name: /Coaches/i }));
      expect(screen.getByText("No published team members match this filter.")).toBeInTheDocument();
    });

    it("allows refreshing the roster via the refresh button", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(mockComprehensiveRoster))
        .mockResolvedValueOnce(
          jsonResponse({
            members: [
              ...mockComprehensiveRoster.members,
              {
                nickname: "New Mentor",
                memberType: "mentor" as const,
                subteams: ["Outreach"],
              },
            ],
          })
        );

      vi.stubGlobal("fetch", fetchMock);

      render(
        <MemoryRouter>
          <AboutPage />
        </MemoryRouter>
      );

      await screen.findByRole("heading", { name: "Dr. Dave" });
      expect(screen.queryByRole("heading", { name: "New Mentor" })).not.toBeInTheDocument();

      const refreshButton = screen.getByRole("button", { name: /Refresh roster/i });
      fireEvent.click(refreshButton);

      expect(await screen.findByRole("heading", { name: "New Mentor" })).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("Youth Safety & Student Privacy Boundaries", () => {
    it("strictly hides college affiliations for students while preserving them for alumni", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(mockComprehensiveRoster)));

      render(
        <MemoryRouter>
          <AboutPage />
        </MemoryRouter>
      );

      await screen.findByRole("heading", { name: "Alex M." });

      // Student Alex M had "Should Be Hidden College" in API response - MUST NOT appear
      expect(screen.queryByText(/Should Be Hidden College/i)).not.toBeInTheDocument();

      // Alumni Jason R had "WVU Engineering" - MUST appear
      expect(screen.getByText(/WVU Engineering/i)).toBeInTheDocument();
    });

    it("sanitizes avatar URLs: renders approved https images, rejects http/insecure URLs and provides accessible fallback icon", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(mockComprehensiveRoster)));

      render(
        <MemoryRouter>
          <AboutPage />
        </MemoryRouter>
      );

      await screen.findByRole("heading", { name: "Dr. Dave" });

      // Dr. Dave has valid https avatar
      const drDaveAvatar = screen.getByAltText("Dr. Dave's approved avatar");
      expect(drDaveAvatar).toBeInTheDocument();
      expect(drDaveAvatar).toHaveAttribute("src", "https://example.com/avatars/dr-dave.webp");
      expect(drDaveAvatar).toHaveAttribute("loading", "lazy");

      // Bob T had http:// (insecure) avatar -> rejected, fallback icon used
      expect(screen.queryByAltText("Bob T's approved avatar")).not.toBeInTheDocument();

      // Maya K had no avatar -> fallback icon used
      expect(screen.queryByAltText("Maya K's approved avatar")).not.toBeInTheDocument();

      // Fallback icon aria-labels exist for members without secure avatars
      const fallbackAvatars = screen.getAllByLabelText("Approved avatar not provided");
      expect(fallbackAvatars.length).toBeGreaterThanOrEqual(2);
    });

    it("filters out unapproved member types such as parents from public roster", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(mockComprehensiveRoster)));

      render(
        <MemoryRouter>
          <AboutPage />
        </MemoryRouter>
      );

      await screen.findByRole("heading", { name: "Dr. Dave" });

      // "Unapproved Parent" has memberType="parent" which is not a public member type
      expect(screen.queryByRole("heading", { name: "Unapproved Parent" })).not.toBeInTheDocument();
      expect(screen.queryByText("Team parent booster.")).not.toBeInTheDocument();
    });

    it("handles missing nicknames and bios defensively without leaking raw IDs", async () => {
      const defensiveRoster = {
        members: [
          {
            memberType: "student" as const,
            subteams: ["Strategy"],
          },
        ],
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(defensiveRoster)));

      render(
        <MemoryRouter>
          <AboutPage />
        </MemoryRouter>
      );

      expect(await screen.findByRole("heading", { name: "ARES Member" })).toBeInTheDocument();
      expect(screen.getByText("Bio not provided")).toBeInTheDocument();
    });
  });

  describe("Error & Loading UX States", () => {
    it("renders loading state while fetch is in-flight", () => {
      vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));

      render(
        <MemoryRouter>
          <AboutPage />
        </MemoryRouter>
      );

      expect(screen.getByText("Loading the public roster…")).toBeInTheDocument();
    });

    it("renders PublicDataState on network error and allows retry", async () => {
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new Error("Failed to fetch public roster"))
        .mockResolvedValueOnce(jsonResponse(mockComprehensiveRoster));

      vi.stubGlobal("fetch", fetchMock);

      render(
        <MemoryRouter>
          <AboutPage />
        </MemoryRouter>
      );

      expect(await screen.findByText("Unable to load the public roster")).toBeInTheDocument();
      expect(screen.getByText(/Diagnostic code: unavailable/i)).toBeInTheDocument();

      const retryBtn = screen.getByRole("button", { name: /Try again/i });
      fireEvent.click(retryBtn);

      expect(await screen.findByRole("heading", { name: "Dr. Dave" })).toBeInTheDocument();
      expect(screen.queryByText("Unable to load the public roster")).not.toBeInTheDocument();
    });

    it("handles non-200 HTTP responses gracefully", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 500, "Internal Server Error")));

      render(
        <MemoryRouter>
          <AboutPage />
        </MemoryRouter>
      );

      expect(await screen.findByText("Unable to load the public roster")).toBeInTheDocument();
      expect(screen.getByText(/Diagnostic code: HTTP 500/i)).toBeInTheDocument();
    });

    it("handles refresh failure gracefully while retaining visible roster", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(mockComprehensiveRoster))
        .mockRejectedValueOnce(new Error("Failed to refresh"));

      vi.stubGlobal("fetch", fetchMock);

      render(
        <MemoryRouter>
          <AboutPage />
        </MemoryRouter>
      );

      expect(await screen.findByRole("heading", { name: "Dr. Dave" })).toBeInTheDocument();

      const refreshBtn = screen.getByRole("button", { name: /Refresh roster/i });
      fireEvent.click(refreshBtn);

      expect(await screen.findByText("The roster could not refresh")).toBeInTheDocument();
      expect(screen.getByText("The last published roster remains visible below.")).toBeInTheDocument();
      // Ensure previous roster members remain in DOM
      expect(screen.getByRole("heading", { name: "Dr. Dave" })).toBeInTheDocument();
    });
  });

  describe("Quick FAQs Section", () => {
    it("renders all 6 frequently asked questions and detailed answers", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ members: [] })));

      render(
        <MemoryRouter>
          <AboutPage />
        </MemoryRouter>
      );

      expect(await screen.findByText("No published team members match this filter.")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /Quick Answers/i })).toBeInTheDocument();
      expect(screen.getByText(/Frequently Asked Questions/i)).toBeInTheDocument();

      expect(screen.getByRole("heading", { name: "Our Core Mission?" })).toBeInTheDocument();
      expect(screen.getByText(/To establish a premium robotics pipeline for West Virginia students/i)).toBeInTheDocument();

      expect(screen.getByRole("heading", { name: "Technical Prerequisites?" })).toBeInTheDocument();
      expect(screen.getByText(/Zero. Most members start with no programming or manufacturing experience/i)).toBeInTheDocument();

      expect(screen.getByRole("heading", { name: "Geographic Limits?" })).toBeInTheDocument();
      expect(screen.getByText(/Monongalia, Harrison, and SW Pennsylvania/i)).toBeInTheDocument();

      expect(screen.getByRole("heading", { name: "Costs to Participate?" })).toBeInTheDocument();
      expect(screen.getByText(/None. All parts, entry fees, hotel travel, and tools are funded/i)).toBeInTheDocument();

      expect(screen.getByRole("heading", { name: "The Build Season?" })).toBeInTheDocument();
      expect(screen.getByText(/Games reveal in September/i)).toBeInTheDocument();

      expect(screen.getByRole("heading", { name: "Time Commitments?" })).toBeInTheDocument();
      expect(screen.getByText(/One major unified laboratory session each weekend/i)).toBeInTheDocument();
    });
  });
});
