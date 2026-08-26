import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardSidebar from "../components/dashboard/DashboardSidebar";
import { useAuth } from "../context/AuthContext";
import { authenticatedFetch } from "../lib/api";
import { useDashboardNotifications } from "../context/DashboardNotificationsContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../context/AuthContext", () => ({ useAuth: vi.fn(), useOptionalAuth: () => undefined,
}));
vi.mock("../lib/api", () => ({ authenticatedFetch: vi.fn() }));
vi.mock("../context/DashboardNotificationsContext", () => ({
  useDashboardNotifications: vi.fn(),
}));
vi.mock("../lib/firebaseFirestore", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(), query: vi.fn(), where: vi.fn(), onSnapshot: vi.fn(),
}));

describe("DashboardSidebar profile DTO", () => {
  const renderSidebar = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/dashboard"]}><DashboardSidebar /></MemoryRouter>
      </QueryClientProvider>,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: { uid: "private_uid", displayName: "OAuth Legal Name", photoURL: null },
      authorizedUser: { role: "member" },
      loading: false,
      authError: null,
      clearAuthError: vi.fn(),
      loginWithGoogle: vi.fn(),
      logout: vi.fn(),
      loginWithMockUser: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useDashboardNotifications).mockReturnValue({
      pendingBlogApprovals: 0,
      blogApprovalsState: "connected",
      hasPendingInquiries: false,
      inquiriesState: "connected",
    });
  });

  it("loads nickname and avatar through the authenticated API without a UID-seeded fallback", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        exists: true,
        profile: {
          nickname: "CircuitFox",
          avatar: "https://api.dicebear.com/9.x/bottts/svg?seed=random-safe-seed",
        },
      }),
    } as Response);

    renderSidebar();

    expect(await screen.findByText("CircuitFox")).toBeInTheDocument();
    expect(authenticatedFetch).toHaveBeenCalledWith("/api/profiles/me", expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(document.body.innerHTML).not.toContain("private_uid");
  });

  it("keeps the sidebar usable and exposes an HTTP diagnostic when profile loading fails", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      json: async () => ({ error: "Profile unavailable" }),
    } as Response);

    renderSidebar();

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Profile unavailable");
    expect(status).toHaveAttribute("title", "HTTP 503: Service Unavailable. Profile unavailable");
    expect(screen.getByText("OAuth Legal Name")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("link", { name: /My Profile/i })).toBeInTheDocument());
  });

  it("puts the pending mentor approval count on the Blog Management link", async () => {
    vi.mocked(useDashboardNotifications).mockReturnValue({
      pendingBlogApprovals: 2,
      blogApprovalsState: "connected",
      hasPendingInquiries: false,
      inquiriesState: "connected",
    });
    vi.mocked(authenticatedFetch).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ exists: false, profile: { nickname: "", avatar: "" } }),
    } as Response);

    renderSidebar();

    expect(
      await screen.findByRole("link", {
        name: /Manage Blogs 2 pending blog posts awaiting mentor approval/i,
      }),
    ).toBeInTheDocument();
  });
});
