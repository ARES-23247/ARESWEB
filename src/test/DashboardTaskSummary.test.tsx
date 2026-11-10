import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardNotifications } from "@/context/DashboardNotificationsContext";

const firestore = vi.hoisted(() => ({
  getCountFromServer: vi.fn(),
  onSnapshot: vi.fn(),
}));

const authState = vi.hoisted(() => ({
  role: "admin",
}));

const notifications = vi.hoisted(() => ({
  value: {
    pendingBlogApprovals: 2,
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
  } as DashboardNotifications,
}));

vi.mock("firebase/firestore", () => ({
  and: vi.fn((...constraints: unknown[]) => ({ constraints })),
  collection: vi.fn((_db: unknown, name: string) => ({ name })),
  getCountFromServer: firestore.getCountFromServer,
  limit: vi.fn((value: number) => ({ limit: value })),
  onSnapshot: firestore.onSnapshot,
  or: vi.fn((...constraints: unknown[]) => ({ constraints })),
  query: vi.fn((...constraints: unknown[]) => ({ constraints })),
  where: vi.fn((...constraint: unknown[]) => ({ constraint })),
}));

vi.mock("@/app/calendar/api", () => ({
  fetchPublicEvents: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  authenticatedFetch: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      uid: "admin-1",
      email: "admin@example.test",
      displayName: "Team Admin",
      photoURL: null,
    },
    authorizedUser: { role: authState.role },
  }),
  useOptionalAuth: () => undefined,
}));

vi.mock("@/context/DashboardNotificationsContext", () => ({
  canReviewDashboardContent: (role?: string) => ["admin", "coach", "mentor"].includes(role || ""),
  useDashboardNotifications: () => notifications.value,
}));

import DashboardHome from "@/app/dashboard/page";
import { fetchPublicEvents } from "@/app/calendar/api";
import { authenticatedFetch } from "@/lib/api";

describe("Command center task summary & unified 6-queue approval panel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    authState.role = "admin";
    vi.mocked(fetchPublicEvents).mockResolvedValue({ events: [], nextCursor: null });
    vi.mocked(authenticatedFetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ photos: [] }),
    } as Response);
    notifications.value = {
      pendingBlogApprovals: 2,
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
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ announcement: null }),
      }),
    );
    firestore.getCountFromServer
      .mockReset()
      .mockResolvedValueOnce({ data: () => ({ count: 3 }) })
      .mockResolvedValueOnce({ data: () => ({ count: 5 }) });
    firestore.onSnapshot.mockReset().mockImplementation((_query, onNext) => {
      onNext({
        docs: [
          {
            id: "legacy-active",
            data: () => ({
              title: "Legacy mechanical task",
              status: "todo",
              priority: "normal",
              subteam: "Mechanical",
              createdAt: "2026-08-14T00:00:00.000Z",
              dueDate: "2000-01-01",
            }),
          },
          {
            id: "completed",
            data: () => ({
              title: "Completed task",
              status: "completed",
              priority: "high",
              subteam: "software",
            }),
          },
          {
            id: "deleted",
            data: () => ({
              title: "Deleted task",
              status: "todo",
              priority: "high",
              subteam: "software",
              isDeleted: 1,
            }),
          },
        ],
      });
      return vi.fn();
    });
  });

  it("uses normalized live records for truthful task and content summaries", async () => {
    render(<MemoryRouter><DashboardHome /></MemoryRouter>);

    expect(await screen.findByText("Legacy mechanical task")).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.queryByText("Deleted task")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Priority Operational Tasks/i })).toBeInTheDocument();
    expect(screen.getByText("Overdue · Jan 1")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument();
    });
    expect(screen.getByText("Role eligible")).toBeInTheDocument();
    expect(screen.getByText("Not configured")).toBeInTheDocument();
    expect(screen.getByText("Signed in")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "2 blog posts need mentor approval" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Review approval queue/i }),
    ).toHaveAttribute("href", "/dashboard/blog?tab=pending");
  });

  it("surfaces all 6 approval queues for admins/coaches, scopes inquiries out for mentors, and reports unavailable queues", async () => {
    notifications.value = {
      pendingBlogApprovals: 1,
      blogApprovalsState: "connected",
      pendingEventApprovals: 3,
      eventApprovalsState: "connected",
      pendingAcademyApprovals: 2,
      academyApprovalsState: "connected",
      pendingAreslibApprovals: 0,
      areslibApprovalsState: "error",
      pendingDocumentApprovals: 4,
      documentApprovalsState: "connected",
      hasPendingInquiries: true,
      inquiriesState: "connected",
    };

    const view = render(<MemoryRouter><DashboardHome /></MemoryRouter>);

    expect(await screen.findByText("No urgent team alert is active.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Mentor & Coach Approval Queues/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Check queue status")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "1 blog post needs mentor approval" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "3 events need mentor approval" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "2 academy lessons need mentor approval" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "4 cloud resources need mentor approval" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Pending recruitment or sponsor inquiries require review" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("ARESLib Docs queue status is unavailable. Open directly to verify."),
    ).toBeInTheDocument();

    // Mentor sees 5 content queues, never Encrypted Inquiries
    authState.role = "mentor";
    view.rerender(<MemoryRouter><DashboardHome /></MemoryRouter>);
    expect(screen.queryByText("Encrypted Inquiries")).not.toBeInTheDocument();
    expect(screen.getByText("Blog Posts")).toBeInTheDocument();
  });
});
