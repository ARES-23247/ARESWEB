import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
      pendingEventApprovals: 0,
      eventApprovalsState: "connected",
      pendingAcademyApprovals: 0,
      academyApprovalsState: "connected",
      pendingAreslibApprovals: 0,
      areslibApprovalsState: "connected",
      pendingDocumentApprovals: 0,
      documentApprovalsState: "connected",
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

  it("puts pending mentor approval counts on all five content management links", async () => {
    vi.mocked(useDashboardNotifications).mockReturnValue({
      pendingBlogApprovals: 2,
      blogApprovalsState: "connected",
      pendingEventApprovals: 1,
      eventApprovalsState: "connected",
      pendingAcademyApprovals: 3,
      academyApprovalsState: "connected",
      pendingAreslibApprovals: 1,
      areslibApprovalsState: "connected",
      pendingDocumentApprovals: 4,
      documentApprovalsState: "connected",
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
    expect(
      screen.getByRole("link", {
        name: /Manage Events 1 pending event awaiting mentor approval/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /Academy Manager 3 pending academy lessons awaiting mentor approval/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /ARESLib Manager 1 pending ARESLib document awaiting mentor approval/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /Cloud Resources 4 pending cloud resources awaiting mentor approval/i,
      }),
    ).toBeInTheDocument();
  });

  it("organizes portal navigation into collapsible role-accurate sections and removes duplicate Team Today", async () => {
    vi.mocked(useDashboardNotifications).mockReturnValue({
      pendingBlogApprovals: 3,
      blogApprovalsState: "connected",
      pendingEventApprovals: 0,
      eventApprovalsState: "connected",
      pendingAcademyApprovals: 2,
      academyApprovalsState: "connected",
      pendingAreslibApprovals: 0,
      areslibApprovalsState: "connected",
      pendingDocumentApprovals: 0,
      documentApprovalsState: "connected",
      hasPendingInquiries: false,
      inquiriesState: "connected",
    });
    vi.mocked(authenticatedFetch).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ exists: false, profile: { nickname: "", avatar: "" } }),
    } as Response);

    // 1. Member sees Overview & Tasks and Publishing & Media, no Team Today, no mentor/admin sections
    const memberView = renderSidebar();
    expect(screen.queryByRole("link", { name: /Team Today/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Overview & Tasks/i })).toHaveAttribute("aria-expanded", "true");
    const publishingToggle = screen.getByRole("button", { name: /Publishing & Media/i });
    expect(publishingToggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByRole("button", { name: /Competition & Community/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Administration/i })).not.toBeInTheDocument();

    // Collapsing Publishing & Media unmounts its links and surfaces summary count (3 + 2 = 5)
    fireEvent.click(publishingToggle);
    expect(publishingToggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: /Manage Blogs/i })).not.toBeInTheDocument();
    expect(publishingToggle).toHaveTextContent("5");
    memberView.unmount();

    // 2. Mentor sees Competition & Community, but NOT Administration / Inquiries Hub
    vi.mocked(useAuth).mockReturnValue({
      user: { uid: "mentor_uid", displayName: "Mentor", photoURL: null },
      authorizedUser: { role: "mentor" },
      loading: false,
      authError: null,
      clearAuthError: vi.fn(),
      loginWithGoogle: vi.fn(),
      logout: vi.fn(),
      loginWithMockUser: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);
    const mentorView = renderSidebar();
    expect(screen.getByRole("button", { name: /Competition & Community/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Administration/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Inquiries Hub/i })).not.toBeInTheDocument();
    mentorView.unmount();

    // 3. Coach/Admin sees all 4 sections including Inquiries Hub and Manage Users
    vi.mocked(useAuth).mockReturnValue({
      user: { uid: "coach_uid", displayName: "Coach", photoURL: null },
      authorizedUser: { role: "coach" },
      loading: false,
      authError: null,
      clearAuthError: vi.fn(),
      loginWithGoogle: vi.fn(),
      logout: vi.fn(),
      loginWithMockUser: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);
    renderSidebar();
    expect(screen.getByRole("button", { name: /Administration/i })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: /Inquiries Hub/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Manage Users/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Finance Ledger/i })).toBeInTheDocument();
  });
});
