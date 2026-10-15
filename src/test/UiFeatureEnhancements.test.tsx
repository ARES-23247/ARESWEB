import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandPalette } from "@/components/navigation/CommandPalette";
import { TournamentPitChecklistSection } from "@/app/tournaments/[id]/TournamentDetailSections";
import AnnouncementManagerPage from "@/app/dashboard/announcements/page";
import DashboardHome from "@/app/dashboard/page";
import FinanceLedgerPage from "@/app/finance/page";
import GalleryPage from "@/app/gallery/page";
import VideosPage from "@/app/videos/page";
import BiobuzzScoreCalculatorPage from "@/app/biobuzz/score-calculator/page";
import { useAuth } from "@/context/AuthContext";
import { useDashboardNotifications } from "@/context/DashboardNotificationsContext";
import { authenticatedFetch } from "@/lib/api";

vi.mock("@/components/SEO", () => ({ default: () => null }));

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

  it("yields plain Ctrl+K on /academy to AcademyPage while opening CommandPalette on Ctrl+Shift+K", () => {
    render(
      <MemoryRouter initialEntries={["/academy/intro"]}>
        <CommandPalette isSignedIn={true} userRole="member" />
      </MemoryRouter>,
    );

    fireEvent.keyDown(window, { key: "k", ctrlKey: true, shiftKey: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true, shiftKey: true });
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

  it("filters FinanceLedgerPage transactions when clicking an Expense Allocation category", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/seasons")) {
        return new Response(JSON.stringify({ seasons: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          transactions: [
            {
              id: "tx-1",
              type: "expense",
              amount: 250,
              category: "Robot Hardware",
              description: "Bilda bevel gears",
              date: "2026-09-10",
              seasonId: 2026,
            },
            {
              id: "tx-2",
              type: "expense",
              amount: 100,
              category: "Event Registration",
              description: "Qualifier fee",
              date: "2026-09-12",
              seasonId: 2026,
            },
          ],
          hasMore: false,
          nextCursor: null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    render(
      <MemoryRouter>
        <FinanceLedgerPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Bilda bevel gears")).toBeInTheDocument();
    expect(screen.getByText("Qualifier fee")).toBeInTheDocument();

    const categoryBtn = screen.getByRole("button", {
      name: "Filter by expense category Robot Hardware",
    });
    fireEvent.click(categoryBtn);
    expect(categoryBtn).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Bilda bevel gears")).toBeInTheDocument();
    expect(screen.getByText(/Showing 1 matching record from 2 loaded\./i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear filter" }));
    expect(screen.getByText(/Showing 2 loaded records\./i)).toBeInTheDocument();
  });

  it("filters GalleryPage photos and VideosPage videos via keyword search", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/photos/public")) {
        return new Response(
          JSON.stringify({
            photos: [
              {
                id: "p-1",
                caption: "Mecanum Drivetrain Assembly",
                category: "Robot Specs",
                location: "MARS Lab",
                publicUrl: "/images/p1.jpg",
              },
              {
                id: "p-2",
                caption: "Library STEM Demo",
                category: "Outreach",
                location: "Morgantown Library",
                publicUrl: "/images/p2.jpg",
              },
            ],
            hasMore: false,
            nextCursor: null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          videos: [
            {
              id: "v-1",
              platform: "youtube",
              videoId: "abc12345678",
              title: "Autonomous Path Following Reveal",
              description: "Pure pursuit test",
              type: "video",
              status: "published",
              createdAt: "2026-02-15T00:00:00Z",
              isArchived: false,
              thumbnailUrl: "https://img.youtube.com/vi/abc12345678/hqdefault.jpg",
              embedUrl: "https://www.youtube-nocookie.com/embed/abc12345678",
              watchUrl: "https://www.youtube.com/watch?v=abc12345678",
            },
            {
              id: "v-2",
              platform: "youtube",
              videoId: "def12345678",
              title: "Pit Interview Short",
              description: "Quick pit tour",
              type: "short",
              status: "published",
              createdAt: "2026-03-01T00:00:00Z",
              isArchived: false,
              thumbnailUrl: "https://img.youtube.com/vi/def12345678/hqdefault.jpg",
              embedUrl: "https://www.youtube-nocookie.com/embed/def12345678",
              watchUrl: "https://www.youtube.com/watch?v=def12345678",
            },
          ],
          hasMore: false,
          nextCursor: null,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const { unmount } = render(
      <MemoryRouter>
        <GalleryPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Mecanum Drivetrain Assembly")).toBeInTheDocument();
    expect(screen.getByText("2 of 2 photos")).toBeInTheDocument();

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search photos by title, description, or location" }),
      { target: { value: "Morgantown" } },
    );
    expect(screen.getByText("1 of 2 photos")).toBeInTheDocument();
    expect(screen.queryByText("Mecanum Drivetrain Assembly")).not.toBeInTheDocument();
    unmount();

    render(
      <MemoryRouter>
        <VideosPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Autonomous Path Following Reveal")).toBeInTheDocument();
    expect(screen.getByText("2 of 2 videos")).toBeInTheDocument();

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search videos by title or description" }),
      { target: { value: "Interview" } },
    );
    expect(screen.getByText("1 of 2 videos")).toBeInTheDocument();
    expect(screen.queryByText("Autonomous Path Following Reveal")).not.toBeInTheDocument();
  });

  it("increments/decrements BIOBUZZ Score Calculator fields via stepper buttons and copies summary", async () => {
    const { COUNT_FIELDS } = await import("@/lib/biobuzzScoring");
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <MemoryRouter>
        <BiobuzzScoreCalculatorPage />
      </MemoryRouter>,
    );

    const increaseLeaveButtons = screen.getAllByRole("button", {
      name: `Increase ${COUNT_FIELDS.leave.label}`,
    });
    fireEvent.click(increaseLeaveButtons[0]);
    expect(screen.getByLabelText("Red score: 3")).toBeInTheDocument();

    const decreaseLeaveButtons = screen.getAllByRole("button", {
      name: `Decrease ${COUNT_FIELDS.leave.label}`,
    });
    fireEvent.click(decreaseLeaveButtons[0]);
    expect(screen.getByLabelText("Red score: 0")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Copy summary" }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining("BIOBUZZ Match Summary"));
    });
  });
});

