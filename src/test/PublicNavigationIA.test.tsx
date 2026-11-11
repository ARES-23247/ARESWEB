import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { RESOURCE_LINKS, TEAM_LINKS } from "@/components/navigation/navItems";
import { fetchPublicSponsors, PublicContentApiError } from "@/lib/publicContentApi";

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    authorizedUser: null,
    loading: false,
    authError: null,
    clearAuthError: vi.fn(),
    loginWithGoogle: vi.fn(),
    logout: vi.fn(),
    loginWithMockUser: vi.fn(),
  }),
  useOptionalAuth: () => undefined,
}));

vi.mock("@/lib/usePendingInquiries", () => ({
  usePendingInquiries: () => ({
    hasPendingInquiries: false,
    error: null,
  }),
}));

describe("Public navigation IA and sponsor DTO helper", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("promotes Join and Sponsors in Navbar while demoting Store out of primary navigation", () => {
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

    const nav = screen.getByRole("navigation", { name: "Main Navigation" });
    expect(screen.getByRole("link", { name: "Sponsors" })).toHaveAttribute("href", "/sponsors");
    expect(screen.getByRole("link", { name: "Join" })).toHaveAttribute("href", "/join");
    expect(nav.querySelector('a[href="/store"]')).toBeNull();
    expect(
      screen.queryByRole("link", { name: "ARES Documentation Library" }),
    ).toBeNull();

    // Academy must immediately precede Arcade in desktop navigation
    const academyLink = screen.getByRole("link", { name: "Academy" });
    expect(academyLink.nextElementSibling?.textContent?.trim()).toBe("Arcade");

    // Team dropdown includes Tournaments, Sponsors & Partners, and Financial Ledger
    fireEvent.click(screen.getByRole("button", { name: "Team" }));
    expect(screen.getByRole("link", { name: "Who We Are" })).toHaveAttribute("href", "/about");
    expect(screen.getByRole("link", { name: "Tournaments" })).toHaveAttribute("href", "/tournaments");
    expect(screen.getByRole("link", { name: "Sponsors & Partners" })).toHaveAttribute("href", "/sponsors");
    expect(screen.getByRole("link", { name: "Financial Ledger" })).toHaveAttribute("href", "/finance");

    // Resources dropdown includes Interactive Simulations and ARESLib while omitting Official Store
    fireEvent.click(screen.getByRole("button", { name: "Resources" }));
    expect(screen.getByRole("link", { name: "Interactive Simulations" })).toHaveAttribute(
      "href",
      "/academy/playground",
    );
    expect(screen.getByRole("link", { name: /ARES\s*Lib/i })).toHaveAttribute("href", "/docs");
    expect(RESOURCE_LINKS.some((item) => item.to === "/store")).toBe(false);
    expect(TEAM_LINKS[0]?.to).toBe("/about");
  });

  it("validates public sponsor DTO payloads strictly", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          sponsors: [
            { name: "Mountaineer Robotics Foundation", tier: "Titanium" },
            { invalid: true },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const sponsors = await fetchPublicSponsors();
    expect(sponsors).toEqual([{ name: "Mountaineer Robotics Foundation", tier: "Titanium" }]);

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ sponsors: "not-an-array" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(fetchPublicSponsors()).rejects.toBeInstanceOf(PublicContentApiError);
  });
});
