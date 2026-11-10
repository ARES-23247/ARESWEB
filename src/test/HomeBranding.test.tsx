import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Home from "@/app/page";
import { useAuth } from "@/context/AuthContext";
import { fetchPublicEvents } from "@/app/calendar/api";
import {
  fetchPublicBlogPosts,
  fetchPublicSeasons,
  fetchPublicSponsors,
} from "@/lib/publicContentApi";

vi.mock("@/context/AuthContext", () => ({
  useAuth: vi.fn(),
  useOptionalAuth: () => undefined,
}));

vi.mock("@/app/calendar/api", () => ({
  fetchPublicEvents: vi.fn(),
}));

vi.mock("@/lib/publicContentApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/publicContentApi")>();
  return {
    ...actual,
    fetchPublicBlogPosts: vi.fn(),
    fetchPublicSeasons: vi.fn(),
    fetchPublicSponsors: vi.fn(),
  };
});

describe("Home page branding, public-first IA, and OAuth truthfulness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchPublicEvents).mockResolvedValue({ events: [], nextCursor: null });
    vi.mocked(fetchPublicBlogPosts).mockResolvedValue([]);
    vi.mocked(fetchPublicSeasons).mockResolvedValue([]);
    vi.mocked(fetchPublicSponsors).mockResolvedValue([]);
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      authorizedUser: null,
      loading: false,
      authError: null,
      clearAuthError: vi.fn(),
      loginWithGoogle: vi.fn(),
      logout: vi.fn(),
      loginWithMockUser: vi.fn(),
    });
  });

  afterEach(cleanup);

  it("renders public-first Hero CTAs, OAuth Studio compliance, all 6 Arcade games, and zero auth-walled links when signed out", async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    // Primary team identity
    expect(screen.getByText("Appalachian Robotics & Engineering Society")).toBeInTheDocument();
    expect(screen.getByText("Engineered")).toBeInTheDocument();
    expect(screen.getByText("To Inspire")).toBeInTheDocument();
    expect(screen.getByText(/Mountaineer Mindset/i)).toBeInTheDocument();

    // Public-first Hero CTAs
    expect(screen.getByRole("link", { name: "Join the Team" })).toHaveAttribute("href", "/join");
    expect(screen.getByRole("link", { name: "Explore Robots & Legacy" })).toHaveAttribute(
      "href",
      "/robots",
    );
    expect(screen.getByRole("link", { name: "View Schedule" })).toHaveAttribute(
      "href",
      "/calendar",
    );

    // Truthful empty states in "Live from ARES"
    await waitFor(() => {
      expect(
        screen.getByText(/No upcoming public events are currently published/i),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(/No engineering dispatches are currently published/i),
    ).toBeInTheDocument();

    // ARES Robotics Studio product section & Google OAuth compliance
    expect(
      screen.getByRole("heading", { name: "ARES Robotics Studio" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Local-first:/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");

    // Full 6-game ARES Games collection + online safety notice
    expect(screen.getByRole("heading", { name: "ARES Games" })).toBeInTheDocument();
    for (const [label, href] of [
      ["Play BIOBUZZ Simulator", "/biobuzz/simulator"],
      ["Play Waggle Way", "/waggle-way"],
      ["Play BUZZHEX", "/buzzhex"],
      ["Play BUZZLE", "/buzzle"],
      ["Play BUZZELLO", "/buzzello"],
      ["Play Pollinator Pile-Up", "/pollen"],
    ] as const) {
      expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
    expect(
      screen.getByText(/No chat, public lobby, player profile, or spectator mode/i),
    ).toBeInTheDocument();

    // Signed-out homepage must not expose broken /dashboard/* links
    const allLinks = screen.getAllByRole("link");
    for (const link of allLinks) {
      expect(link.getAttribute("href") ?? "").not.toMatch(/^\/dashboard/);
    }
  });

  it("preserves signed-in member quick-jump to Portal alongside View Schedule", async () => {
    const logout = vi.fn();
    vi.mocked(useAuth).mockReturnValue({
      user: {
        uid: "member-1",
        email: "student@example.org",
        displayName: "Mountaineer Coder",
        photoURL: null,
      } as never,
      authorizedUser: {
        email: "student@example.org",
        role: "member",
      } as never,
      loading: false,
      authError: null,
      clearAuthError: vi.fn(),
      loginWithGoogle: vi.fn(),
      logout,
      loginWithMockUser: vi.fn(),
    });

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    expect(screen.getByText("Mountaineer Coder")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Portal" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.getByRole("link", { name: "View Schedule" })).toHaveAttribute(
      "href",
      "/calendar",
    );

    fireEvent.click(screen.getByRole("button", { name: "Logout" }));
    expect(logout).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(
        screen.getByText(/No upcoming public events are currently published/i),
      ).toBeInTheDocument();
    });
  });

  it("renders verified Live from ARES event, blog dispatch, and season/sponsor records", async () => {
    const futureDate = new Date(Date.now() + 86_400_000 * 3).toISOString();
    vi.mocked(fetchPublicEvents).mockResolvedValue({
      events: [
        {
          id: "evt-qualifier",
          title: "WV State Championship Qualifier",
          dateStart: futureDate,
          category: "competition",
          publicVenue: {
            name: "Morgantown High Gymnasium",
            address: "109 Wilson Ave, Morgantown, WV",
          },
          isPotluck: 0,
          isVolunteer: 0,
          isDeleted: 0,
        },
      ],
      nextCursor: null,
    });
    vi.mocked(fetchPublicBlogPosts).mockResolvedValue([
      {
        slug: "swerve-odometry-tuning",
        title: "Tuning Dead-Wheel Odometry for BIOBUZZ",
        date: "2026-10-15",
        author: "Control Team",
        snippet: "Validating heading fusion across high-speed field cycles.",
      },
    ]);
    vi.mocked(fetchPublicSeasons).mockResolvedValue([
      {
        id: "2026-2027",
        startYear: 2026,
        endYear: 2027,
        challengeName: "BIOBUZZ",
        robotName: "APIS IV",
        status: "published",
      },
    ]);
    vi.mocked(fetchPublicSponsors).mockResolvedValue([
      { name: "Mountaineer Precision", tier: "Gold" },
      { name: "Appalachian Photonics", tier: "Silver" },
    ]);

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "WV State Championship Qualifier" }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Morgantown High Gymnasium")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open event details/i })).toHaveAttribute(
      "href",
      "/events/evt-qualifier",
    );

    expect(
      screen.getByRole("heading", { name: "Tuning Dead-Wheel Odometry for BIOBUZZ" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Read dispatch/i })).toHaveAttribute(
      "href",
      "/blog/swerve-odometry-tuning",
    );

    expect(screen.getByRole("heading", { name: "BIOBUZZ" })).toBeInTheDocument();
    expect(screen.getByText("APIS IV")).toBeInTheDocument();
    expect(screen.getByText(/Mountaineer Precision, Appalachian Photonics/i)).toBeInTheDocument();
  });

  it("surfaces explicit error alerts with retry instead of turning API failures into empty states", async () => {
    vi.mocked(fetchPublicEvents).mockRejectedValueOnce(new Error("HTTP 503: Unavailable"));
    vi.mocked(fetchPublicBlogPosts).mockRejectedValueOnce(new Error("HTTP 502: Bad Gateway"));
    vi.mocked(fetchPublicSeasons).mockRejectedValueOnce(new Error("HTTP 500: Internal Error"));

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Upcoming schedule unavailable")).toBeInTheDocument();
    });
    expect(screen.getByText("Team blog feed unavailable")).toBeInTheDocument();
    expect(screen.getByText("Season & sponsor summary unavailable")).toBeInTheDocument();
    expect(
      screen.queryByText(/No upcoming public events are currently published/i),
    ).toBeNull();

    // Retry recovers cleanly
    vi.mocked(fetchPublicEvents).mockResolvedValueOnce({ events: [], nextCursor: null });
    const retryButtons = screen.getAllByRole("button", { name: "Retry" });
    fireEvent.click(retryButtons[0]);

    await waitFor(() => {
      expect(
        screen.getByText(/No upcoming public events are currently published/i),
      ).toBeInTheDocument();
    });
  });
});
