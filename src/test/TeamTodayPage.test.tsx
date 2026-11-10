import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardHome from "@/app/dashboard/page";
import { authenticatedFetch } from "@/lib/api";
import { fetchPublicEvents } from "@/app/calendar/api";

const firestore = vi.hoisted(() => ({
  getCountFromServer: vi.fn(),
  onSnapshot: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { uid: "member-1", email: "member@example.org", displayName: "Alex Ares", photoURL: null },
    authorizedUser: { role: "member" },
  }),
  useOptionalAuth: () => undefined,
}));
vi.mock("@/context/DashboardNotificationsContext", () => ({
  canReviewDashboardContent: () => false,
  useDashboardNotifications: () => ({
    pendingBlogApprovals: 0,
    blogApprovalsState: "idle",
    hasPendingInquiries: false,
    inquiriesState: "idle",
  }),
}));
vi.mock("@/lib/api", () => ({ authenticatedFetch: vi.fn() }));
vi.mock("@/app/calendar/api", () => ({ fetchPublicEvents: vi.fn() }));
vi.mock("firebase/firestore", () => ({
  and: vi.fn((...constraints: unknown[]) => ({ constraints })),
  collection: vi.fn(() => ({})),
  getCountFromServer: firestore.getCountFromServer,
  limit: vi.fn((value: number) => value),
  onSnapshot: firestore.onSnapshot,
  or: vi.fn((...constraints: unknown[]) => ({ constraints })),
  query: vi.fn((...values: unknown[]) => values),
  where: vi.fn((...constraint: unknown[]) => ({ constraint })),
}));

function response(body: object, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function LocationDisplay() {
  const location = useLocation();
  return <output data-testid="current-path">{location.pathname}</output>;
}

function renderPage(initialEntry = "/dashboard") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationDisplay />
      <Routes>
        <Route path="/dashboard" element={<DashboardHome />} />
        <Route path="/dashboard/today" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Unified Command Center daily workspace & /dashboard/today redirect", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    firestore.getCountFromServer.mockResolvedValue({ data: () => ({ count: 4 }) });
    vi.mocked(fetchPublicEvents).mockResolvedValue({
      events: [{
        id: "practice-1",
        title: "Sunday practice",
        dateStart: "2099-08-24T18:00:00.000Z",
        dateEnd: "2099-08-24T20:00:00.000Z",
        location: "Team workshop",
        category: "internal",
        isDeleted: 0,
      }],
      nextCursor: null,
    });
    vi.mocked(authenticatedFetch).mockResolvedValue(response({
      photos: [{
        id: "photo-1",
        publicUrl: "https://images.example.test/full.webp",
        thumbnailUrl: "https://images.example.test/thumb.webp",
        caption: "New intake prototype",
        altText: "Robot intake prototype on the workbench",
        labels: [],
        albumId: null,
        mimeType: "image/webp",
        fileSize: 100,
        importedAt: "2026-08-23T12:00:00.000Z",
        isSynced: false,
        isArchived: false,
      }],
    }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({
      announcement: {
        message: "Practice starts one hour later.",
        severity: "urgent",
        link: "/calendar",
        linkLabel: "See schedule",
        revision: "revision-1",
        startsAt: null,
        endsAt: null,
      },
    })));
    firestore.onSnapshot.mockImplementation((_query, onNext) => {
      onNext({
        docs: [{
          id: "task-1",
          data: () => ({
            title: "Finish intake guard",
            status: "in_progress",
            priority: "high",
            subteam: "hardware",
            assignees: ["member-1"],
            dueDate: "2099-08-24",
            createdAt: "2026-08-23T10:00:00.000Z",
          }),
        }],
      });
      return vi.fn();
    });
  });

  it("redirects /dashboard/today cleanly to /dashboard and combines daily team sources", async () => {
    renderPage("/dashboard/today");

    expect(screen.getByTestId("current-path")).toHaveTextContent("/dashboard");
    expect(screen.getByRole("heading", { level: 1, name: "Command Center" })).toBeInTheDocument();
    expect(await screen.findByText("Practice starts one hour later.")).toBeInTheDocument();
    expect(await screen.findByText("Sunday practice")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "My Priority Operational Tasks" })).toBeInTheDocument();
    expect(screen.getByText("Finish intake guard")).toBeInTheDocument();
    expect(await screen.findByAltText("Robot intake prototype on the workbench")).toHaveAttribute(
      "src",
      "https://images.example.test/thumb.webp",
    );
    expect(screen.getByRole("link", { name: /View details and RSVP/i })).toHaveAttribute(
      "href",
      "/events/practice-1",
    );
    expect(screen.getByRole("link", { name: /Cloud Resources/i })).toHaveAttribute(
      "href",
      "/dashboard/documents",
    );
    expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/photos?limit=4&includeArchived=false",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(document.body.innerHTML).not.toContain("member-1");
  });

  it("preserves truthful empty states across alerts, events, tasks, and photos", async () => {
    vi.mocked(fetchPublicEvents).mockResolvedValue({ events: [], nextCursor: null });
    vi.mocked(authenticatedFetch).mockResolvedValue(response({ photos: [] }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ announcement: null })));
    firestore.onSnapshot.mockImplementation((_query, onNext) => {
      onNext({ docs: [] });
      return vi.fn();
    });

    renderPage();
    expect(await screen.findByText("No urgent team alert is active.")).toBeInTheDocument();
    expect(await screen.findByText("No upcoming event is currently published.")).toBeInTheDocument();
    expect(screen.getByText("There are no active tasks right now.")).toBeInTheDocument();
    expect(await screen.findByText("No recent progress photos are available.")).toBeInTheDocument();
  });

  it("shows independent failures instead of converting them into empty data", async () => {
    vi.mocked(fetchPublicEvents).mockRejectedValue(new Error("Calendar offline"));
    vi.mocked(authenticatedFetch).mockResolvedValue(response({}, 503));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({}, 502)));
    firestore.onSnapshot.mockImplementation((_query, _onNext, onError) => {
      onError(new Error("Tasks denied"));
      return vi.fn();
    });

    renderPage();
    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(4));
    expect(screen.getByText("Calendar offline")).toBeInTheDocument();
    expect(screen.getByText("Photo library returned HTTP 503.")).toBeInTheDocument();
    expect(screen.getByText("Announcements returned HTTP 502.")).toBeInTheDocument();
    expect(screen.getByText("Tasks denied")).toBeInTheDocument();
  });
});
