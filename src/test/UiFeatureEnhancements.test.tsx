import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandPalette } from "@/components/navigation/CommandPalette";
import { TournamentPitChecklistSection } from "@/app/tournaments/[id]/TournamentDetailSections";
import AnnouncementManagerPage from "@/app/dashboard/announcements/page";
import DashboardHome from "@/app/dashboard/page";
import { useAuth } from "@/context/AuthContext";
import { useDashboardNotifications } from "@/context/DashboardNotificationsContext";
import { authenticatedFetch } from "@/lib/api";

vi.mock("@/context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/context/DashboardNotificationsContext", () => ({
  canReviewDashboardContent: (role?: string) =>
    role === "admin" || role === "coach" || role === "mentor",
  useDashboardNotifications: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  authenticatedFetch: vi.fn(),
}));

vi.mock("@/lib/firebaseFirestore", () => ({
  db: {},
}));

vi.mock("firebase/firestore", () => ({
  and: vi.fn(),
  collection: vi.fn(),
  getCountFromServer: vi.fn().mockResolvedValue({ data: () => ({ count: 4 }) }),
  limit: vi.fn(),
  onSnapshot: vi.fn(() => () => undefined),
  or: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));

import { getCountFromServer, onSnapshot } from "firebase/firestore";

describe("UI & Feature Enhancements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCountFromServer).mockResolvedValue({
      data: () => ({ count: 4 }),
    } as unknown as Awaited<ReturnType<typeof getCountFromServer>>);
    vi.mocked(onSnapshot).mockImplementation(() => () => undefined);
  });

  it("opens CommandPalette via button or Ctrl+K and filters destinations", () => {
    render(
      <MemoryRouter>
        <CommandPalette isSignedIn={true} userRole="coach" />
      </MemoryRouter>,
    );

    const openBtn = screen.getByRole("button", { name: "Open quick jump search" });
    fireEvent.click(openBtn);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const searchInput = screen.getByPlaceholderText(/jump to page, robot fleet/i);
    fireEvent.change(searchInput, { target: { value: "Announcements" } });

    expect(screen.getByRole("option", { name: /Site-Wide Announcements/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close quick jump search" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Open with Ctrl+K
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("tracks Pre-Match Pit & Queuing Checklist readiness and resets cleanly", () => {
    render(
      <TournamentPitChecklistSection
        matches={[
          {
            id: "m-1",
            tournamentId: "t-1",
            matchNumber: "Q-12",
            alliance: "red",
            partner: "19999",
            opponents: ["11111", "22222"],
            result: "upcoming",
            completed: false,
            isDeleted: 0,
          },
        ]}
      />,
    );

    expect(screen.getByText("Pre-Match Pit & Queuing Checklist")).toBeInTheDocument();
    expect(screen.getByText("Q-12")).toBeInTheDocument();
    expect(screen.getByText("0 / 5 Ready")).toBeInTheDocument();

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(5);

    for (const checkbox of checkboxes) {
      fireEvent.click(checkbox);
    }

    expect(screen.getByText("Queue Ready")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /reset checklist/i }));
    expect(screen.getByText("0 / 5 Ready")).toBeInTheDocument();
  });

  it("renders a live visual preview in AnnouncementManagerPage", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { uid: "coach-1" },
      authorizedUser: { role: "coach" },
      loading: false,
    } as unknown as ReturnType<typeof useAuth>);

    vi.mocked(authenticatedFetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        announcement: {
          message: "Qualifier schedule posted.",
          severity: "important",
          link: "/tournaments",
          linkLabel: "View schedule",
          revision: "rev-1",
          startsAt: null,
          endsAt: null,
          isActive: true,
          updatedAt: null,
        },
      }),
    } as unknown as Response);

    render(
      <MemoryRouter>
        <AnnouncementManagerPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Live Banner Preview")).toBeInTheDocument();
    expect(screen.getByText("Active on Public Site")).toBeInTheDocument();
    const preview = screen.getByLabelText("Banner visual preview");
    expect(preview).toHaveTextContent("Qualifier schedule posted.");
    expect(preview).toHaveTextContent("View schedule");
  });

  it("surfaces pending inquiries action card on DashboardHome for coaches and admins", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { uid: "coach-1", displayName: "Coach A", email: "coach@example.com" },
      authorizedUser: { role: "coach" },
      loading: false,
    } as unknown as ReturnType<typeof useAuth>);

    vi.mocked(useDashboardNotifications).mockReturnValue({
      pendingBlogApprovals: 2,
      blogApprovalsState: "connected",
      hasPendingInquiries: true,
      inquiriesState: "connected",
    });

    render(
      <MemoryRouter>
        <DashboardHome />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Connected")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /pending recruitment or sponsor inquiries require review/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /review inquiries/i })).toHaveAttribute(
      "href",
      "/dashboard/inquiries",
    );
  });
});
