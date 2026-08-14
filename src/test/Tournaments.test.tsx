import {
  fireEvent,
  render,
  screen,
  act,
  waitFor,
  within,
} from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import TournamentsFeedPage from "../app/tournaments/page";
import TournamentDetailPage from "../app/tournaments/[id]/page";
import TournamentMatchesList from "../app/tournaments/[id]/TournamentMatchesList";
import TournamentsManager from "../components/dashboard/TournamentsManager";
import { useAuth } from "../context/AuthContext";
import * as LucideIcons from "lucide-react";
import {
  archiveTournament,
  createTournament,
  fetchTournaments,
  fetchTournamentMatches,
  setTournamentMatchCompletion,
  TournamentApiError,
} from "../lib/tournamentApi";
import type { User } from "firebase/auth";

// Mock AuthContext
vi.mock("../context/AuthContext", () => {
  return {
    useAuth: vi.fn(),
    AuthProvider: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
  };
});

vi.mock("../lib/tournamentApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/tournamentApi")>();
  return {
    ...actual,
    fetchTournaments: vi.fn(),
    fetchTournament: vi.fn(),
    fetchTournamentMatches: vi.fn(),
    createTournament: vi.fn(),
    updateTournament: vi.fn(),
    archiveTournament: vi.fn(),
    createTournamentMatch: vi.fn(),
    updateTournamentMatch: vi.fn(),
    setTournamentMatchCompletion: vi.fn(),
    archiveTournamentMatch: vi.fn(),
  };
});

// Mock Firebase firestore methods
vi.mock("firebase/firestore", () => {
  return {
    doc: vi.fn(),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    updateDoc: vi.fn(),
    setDoc: vi.fn(),
  };
});

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
        staleTime: Infinity,
      },
    },
  });

interface AuthTestValue {
  user: { uid: string; email?: string | null } | null;
  authorizedUser: { email: string; role: string } | null;
  loading: boolean;
}

function mockAuth(value: AuthTestValue) {
  vi.mocked(useAuth).mockReturnValue({
    ...value,
    user: value.user as unknown as User | null,
    loginWithGoogle: vi.fn(),
    logout: vi.fn(),
    loginWithMockUser: vi.fn(),
  });
}

const renderWithProviders = (
  ui: React.ReactElement,
  queryClient = createTestQueryClient(),
  initialEntries = ["/tournaments/world-championship-2026"],
) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/tournaments/:id" element={ui} />
          <Route path="*" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("Tournaments Module Lucide Check", () => {
  it("verifies all lucide-react icons used are defined", () => {
    const requiredIcons = [
      "Trophy",
      "Calendar",
      "MapPin",
      "Activity",
      "TrendingUp",
      "Search",
      "Lock",
      "ChevronRight",
      "ShieldAlert",
      "ArrowRight",
      "Plus",
      "Trash2",
      "Edit2",
      "Check",
      "X",
      "Camera",
      "Info",
      "FileText",
      "Bookmark",
    ];

    requiredIcons.forEach((iconName) => {
      const Icon = LucideIcons[iconName as keyof typeof LucideIcons];
      expect(Icon).toBeDefined();
      expect(typeof Icon).not.toBe("undefined");
    });
  });
});

describe("TournamentsFeedPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders locking administrative gate if user is not authorized", async () => {
    mockAuth({
      user: null,
      authorizedUser: null,
      loading: false,
    });

    await act(async () => {
      renderWithProviders(<TournamentsFeedPage />);
    });

    expect(
      screen.getByText(/Scouting & Tournaments Vault/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Sign In with Google/i }),
    ).toBeInTheDocument();
  });

  it("renders tournaments dashboard list if user is authorized", async () => {
    mockAuth({
      user: { uid: "test-uid", email: "test@example.com" },
      authorizedUser: { email: "test@example.com", role: "student" },
      loading: false,
    });

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(
      ["tournaments"],
      [
        {
          id: "wv-state-2026",
          name: "WV State Championship 2026",
          date: "2026-03-14",
          location: "Fairmont, WV",
          description: "WV State Championship info",
          status: "past",
          opr: 185.4,
          isDeleted: 0,
        },
      ],
    );

    await act(async () => {
      renderWithProviders(<TournamentsFeedPage />, queryClient);
    });

    expect(screen.getByText(/Scouting Vault/i)).toBeInTheDocument();
    expect(screen.getByText(/WV State Championship 2026/i)).toBeInTheDocument();
  });

  it("distinguishes an empty vault from filters with no matches", () => {
    mockAuth({
      user: { uid: "test-uid", email: "test@example.com" },
      authorizedUser: { email: "test@example.com", role: "student" },
      loading: false,
    });
    const emptyClient = createTestQueryClient();
    emptyClient.setQueryData(["tournaments"], []);
    const emptyView = renderWithProviders(<TournamentsFeedPage />, emptyClient);
    expect(screen.getByText(/No Tournament Records Yet/i)).toBeInTheDocument();
    emptyView.unmount();

    const populatedClient = createTestQueryClient();
    populatedClient.setQueryData(
      ["tournaments"],
      [
        {
          id: "past-event",
          name: "Past Event",
          date: "2026-01-01",
          location: "Morgantown, WV",
          status: "past",
          isDeleted: 0,
        },
      ],
    );
    renderWithProviders(<TournamentsFeedPage />, populatedClient);
    fireEvent.click(screen.getByRole("button", { name: "upcoming" }));
    expect(
      screen.getByText(/No Matches for These Filters/i),
    ).toBeInTheDocument();
  });

  it("keeps the last confirmed tournament list visible when refresh fails", async () => {
    mockAuth({
      user: { uid: "test-uid", email: "test@example.com" },
      authorizedUser: { email: "test@example.com", role: "student" },
      loading: false,
    });
    vi.mocked(fetchTournaments).mockRejectedValue(
      new TournamentApiError(
        503,
        "Service Unavailable",
        "UPSTREAM_UNAVAILABLE",
      ),
    );
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(
      ["tournaments"],
      [
        {
          id: "confirmed-event",
          name: "Confirmed Event",
          date: "2026-02-01",
          location: "Morgantown, WV",
          status: "past",
          isDeleted: 0,
        },
      ],
    );
    await queryClient.invalidateQueries({ queryKey: ["tournaments"] });

    renderWithProviders(<TournamentsFeedPage />, queryClient);

    await waitFor(() =>
      expect(
        screen.getByText(/Unable to load tournament records/i),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("Confirmed Event")).toBeInTheDocument();
    expect(
      screen.queryByText(/No Tournament Records Yet/i),
    ).not.toBeInTheDocument();
  });
});

describe("TournamentDetailPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renders detail page layout and stats", async () => {
    mockAuth({
      user: { uid: "test-uid", email: "test@example.com" },
      authorizedUser: { email: "test@example.com", role: "student" },
      loading: false,
    });

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["tournament", "world-championship-2026"], {
      id: "world-championship-2026",
      name: "FIRST® World Championship 2026",
      seasonName: "2025-2026",
      challengeName: "DECODE",
      date: "2026-04-29",
      location: "Houston, TX",
      description:
        "The global gathering of top-tier *FIRST*® Tech Challenge teams.",
      status: "past",
      opr: 210.5,
      oprList: [{ teamNumber: "23247", teamName: "ARES", opr: 210.5 }],
      scoutingDetails: {
        autoPathNotes: "Path notes",
        driverFeedback: "Feedback notes",
        robotSpecs: "Specs notes",
      },
      photoAlbumId: "houston-2026",
      isDeleted: 0,
    });
    queryClient.setQueryData(
      ["tournament_matches", "world-championship-2026"],
      [
        {
          id: "wc-q1",
          tournamentId: "world-championship-2026",
          matchNumber: "QM4",
          alliance: "red",
          partner: "14210",
          opponents: ["11111", "18214"],
          scoreSelf: 220,
          scoreOpponent: 195,
          result: "won",
          completed: true,
          isDeleted: 0,
          notes: "Notes here",
        },
      ],
    );
    queryClient.setQueryData(["tournament_photos", "houston-2026"], []);

    await act(async () => {
      renderWithProviders(<TournamentDetailPage />, queryClient);
    });

    expect(
      screen.getByText(/FIRST® World Championship 2026/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Match Checklist/i)).toBeInTheDocument();
    const csvDownload = screen.getByRole("link", {
      name: "Download all match records as CSV",
    });
    expect(csvDownload).toHaveAttribute("download", "ares-match-plan.csv");
    expect(csvDownload).toHaveAttribute(
      "href",
      expect.stringMatching(/^data:text\/csv;charset=utf-8,%EF%BB%BF/),
    );
    expect(screen.getByText("April 29, 2026")).toBeInTheDocument();
    expect(screen.getByText("1/1")).toBeInTheDocument();
    expect(screen.getByText("1-0-0")).toBeInTheDocument();
    expect(screen.getAllByText("220")).toHaveLength(2);
    expect(
      screen.queryByText(/automatically computed/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Mark complete: QM4/i }),
    ).not.toBeInTheDocument();

    fireEvent.change(
      screen.getByLabelText("Filter matches by number or team"),
      {
        target: { value: "no visible matches" },
      },
    );
    expect(screen.getByText(/No matches fit this filter/i)).toBeInTheDocument();

    const printTrigger = screen.getByRole("button", { name: "Print plan" });
    printTrigger.focus();
    fireEvent.click(printTrigger);

    const printDialog = screen.getByRole("dialog", {
      name: "Event-day match plan",
    });
    expect(
      within(printDialog).getByText("2025-2026 · DECODE"),
    ).toBeInTheDocument();
    expect(
      within(printDialog).getByText("April 29, 2026 · Houston, TX"),
    ).toBeInTheDocument();
    expect(within(printDialog).getByText("QM4")).toBeInTheDocument();
    expect(within(printDialog).getByText("220–195")).toBeInTheDocument();
    expect(within(printDialog).getByText("Notes here")).toBeInTheDocument();

    const printSpy = vi
      .spyOn(window, "print")
      .mockImplementation(() => undefined);
    fireEvent.click(
      within(printDialog).getByRole("button", { name: "Print / Save PDF" }),
    );
    expect(printSpy).toHaveBeenCalledOnce();

    fireEvent.click(
      within(printDialog).getByRole("button", { name: "Close match plan" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(printTrigger).toHaveFocus();
    printSpy.mockRestore();
  });

  it("renders OPR metrics, leaderboard search, scouting CSV download, and alliance planner on upcoming tournaments", async () => {
    mockAuth({
      user: { uid: "test-uid", email: "test@example.com" },
      authorizedUser: { email: "test@example.com", role: "student" },
      loading: false,
    });

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["tournament", "active-tournament-2026"], {
      id: "active-tournament-2026",
      name: "WV State Championship 2026",
      seasonName: "2025-2026",
      challengeName: "DECODE",
      date: "2026-03-20",
      location: "Fairmont, WV",
      description: "Active FTC state championship tournament.",
      status: "upcoming",
      opr: 195.2,
      oprList: [
        { teamNumber: "23247", teamName: "ARES", opr: 195.2 },
        { teamNumber: "14210", teamName: "Quantum Leap", opr: 188.0 },
        { teamNumber: "18214", teamName: "CyberKnights", opr: 172.5 },
        { teamNumber: "11111", teamName: "RoboTitans", opr: 160.0 },
        { teamNumber: "99999", teamName: "OmegaTech", opr: 155.0 },
      ],
      scoutingDetails: {
        autoPathNotes: "Double sample auto",
        driverFeedback: "Fast cycle time",
        robotSpecs: "Linear slide intake",
      },
      photoAlbumId: null,
      isDeleted: 0,
    });
    queryClient.setQueryData(["tournament_matches", "active-tournament-2026"], []);
    queryClient.setQueryData(["tournament_photos", "active-tournament-2026"], []);

    await act(async () => {
      renderWithProviders(<TournamentDetailPage />, queryClient, [
        "/tournaments/active-tournament-2026",
      ]);
    });

    // Verify OPR badge is displayed on upcoming event
    expect(screen.getByText("Team OPR")).toBeInTheDocument();
    expect(screen.getAllByText("195.2")).toHaveLength(2);

    // Verify OPR Leaderboard and Stats
    expect(screen.getByText("OPR Leaderboard")).toBeInTheDocument();
    expect(screen.getByText("Teams Scouted")).toBeInTheDocument();
    expect(screen.getAllByText("5")).toHaveLength(2);
    expect(screen.getByText("Average OPR")).toBeInTheDocument();

    // Verify CSV download link is present and properly formed
    const csvDownload = screen.getByRole("link", {
      name: "Download scouting OPR records as CSV",
    });
    expect(csvDownload).toHaveAttribute(
      "download",
      "wv-state-championship-2026-scouting.csv"
    );
    expect(csvDownload).toHaveAttribute(
      "href",
      expect.stringMatching(/^data:text\/csv;charset=utf-8,%EF%BB%BF/)
    );

    // Verify team search filter
    const searchInput = screen.getByLabelText("Filter teams by number or name");
    fireEvent.change(searchInput, { target: { value: "Quantum" } });
    expect(screen.getByText("Quantum Leap")).toBeInTheDocument();
    expect(screen.queryByText("CyberKnights")).not.toBeInTheDocument();

    // Verify Alliance Strategy Planner is present
    expect(screen.getByText("Alliance Strategy & Selection Planner")).toBeInTheDocument();
  });

  it("surfaces a revision conflict and refreshes without overwriting newer data", async () => {
    mockAuth({
      user: { uid: "admin-uid", email: "admin@example.com" },
      authorizedUser: { email: "admin@example.com", role: "admin" },
      loading: false,
    });
    vi.mocked(setTournamentMatchCompletion).mockRejectedValue(
      new TournamentApiError(
        409,
        "Conflict",
        "MATCH_REVISION_CONFLICT",
        "HTTP 409: Conflict — This match changed elsewhere",
      ),
    );
    vi.mocked(fetchTournamentMatches).mockResolvedValue([]);

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["tournament", "world-championship-2026"], {
      id: "world-championship-2026",
      name: "State Championship",
      date: "2026-03-14",
      location: "Fairmont, WV",
      status: "past",
      isDeleted: 0,
    });
    queryClient.setQueryData(
      ["tournament_matches", "world-championship-2026"],
      [
        {
          id: "qm-1",
          tournamentId: "world-championship-2026",
          matchNumber: "QM1",
          alliance: "red",
          partner: "12345",
          opponents: ["54321"],
          result: "upcoming",
          completed: false,
          isDeleted: 0,
          updatedAt: "2026-08-14T09:00:00.000Z",
        },
      ],
    );

    renderWithProviders(<TournamentDetailPage />, queryClient);
    fireEvent.click(
      screen.getByRole("button", { name: /Mark complete: QM1/i }),
    );

    await waitFor(() =>
      expect(
        screen.getByText(/changed on another device/i),
      ).toBeInTheDocument(),
    );
    expect(setTournamentMatchCompletion).toHaveBeenCalledWith(
      "world-championship-2026",
      "qm-1",
      true,
      "2026-08-14T09:00:00.000Z",
    );
    expect(fetchTournamentMatches).toHaveBeenCalledWith(
      "world-championship-2026",
      250,
    );
  });

  it("opens and closes a tournament photo in the accessible lightbox", async () => {
    mockAuth({
      user: { uid: "student-uid", email: "student@example.com" },
      authorizedUser: { email: "student@example.com", role: "student" },
      loading: false,
    });
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["tournament", "world-championship-2026"], {
      id: "world-championship-2026",
      name: "Photo Event",
      date: "2026-03-14",
      location: "Fairmont, WV",
      status: "past",
      photoAlbumId: "photo-event",
      isDeleted: 0,
    });
    queryClient.setQueryData(
      ["tournament_matches", "world-championship-2026"],
      [],
    );
    queryClient.setQueryData(
      ["tournament_photos", "photo-event"],
      [
        {
          src: "https://images.example.org/photo-event.jpg",
          caption: "Robot on the field",
        },
      ],
    );

    renderWithProviders(<TournamentDetailPage />, queryClient);
    const galleryImage = screen.getByRole("img", {
      name: "Robot on the field",
    });
    expect(galleryImage).toHaveAttribute("loading", "lazy");
    expect(galleryImage).toHaveAttribute("decoding", "async");
    expect(galleryImage).toHaveAttribute("width", "16");
    expect(galleryImage).toHaveAttribute("height", "9");
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Open photo: Robot on the field",
      }),
    );

    expect(
      screen.getByRole("dialog", { name: "Robot on the field" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Close tournament photo" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("TournamentMatchesList reliability", () => {
  it("preserves a failed new-match draft and does not invent blank 0-0 scores", async () => {
    const onAddMatch = vi.fn().mockRejectedValue(new Error("offline"));
    render(
      <TournamentMatchesList
        isPast={false}
        tournamentName="Test Event"
        tournamentDate="2026-08-14"
        tournamentLocation="Morgantown, WV"
        matches={[]}
        canEdit={true}
        isMatchesLoading={false}
        isSavingMatch={false}
        onToggleMatch={vi.fn()}
        onAddMatch={onAddMatch}
        onUpdateMatch={vi.fn()}
        onDeleteMatch={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add Match" }));
    fireEvent.change(screen.getByLabelText("Match Number"), {
      target: { value: "QM7" },
    });
    fireEvent.change(screen.getByLabelText("Partner Team"), {
      target: { value: "12345" },
    });
    fireEvent.change(screen.getByLabelText("Opponents (comma-sep)"), {
      target: { value: "44444, 55555" },
    });
    fireEvent.change(screen.getByLabelText("Match Scouting Notes"), {
      target: { value: "Check intake" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Match" }));

    await waitFor(() =>
      expect(onAddMatch).toHaveBeenCalledWith(
        expect.objectContaining({
          matchNumber: "QM7",
          partner: "12345",
          opponents: ["44444", "55555"],
          scoreSelf: undefined,
          scoreOpponent: undefined,
        }),
      ),
    );
    expect(screen.getByLabelText("Match Number")).toHaveValue("QM7");
    expect(screen.getByLabelText("Match Scouting Notes")).toHaveValue(
      "Check intake",
    );
  });
});

describe("TournamentsManager", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("prevents access for unprivileged student role", async () => {
    mockAuth({
      user: { uid: "test-uid", email: "test@example.com" },
      authorizedUser: { email: "test@example.com", role: "student" },
      loading: false,
    });

    await act(async () => {
      renderWithProviders(<TournamentsManager />);
    });

    expect(
      screen.getByText(/Unauthorized Terminal Access/i),
    ).toBeInTheDocument();
  });

  it("does not give mentors tournament write controls", async () => {
    mockAuth({
      user: { uid: "mentor-uid", email: "mentor@example.com" },
      authorizedUser: { email: "mentor@example.com", role: "mentor" },
      loading: false,
    });

    renderWithProviders(<TournamentsManager />);

    expect(
      screen.getByText(/Unauthorized Terminal Access/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Add Tournament/i }),
    ).not.toBeInTheDocument();
  });

  it("renders manager control panel and lists tournaments for admins", async () => {
    mockAuth({
      user: { uid: "test-uid", email: "test@example.com" },
      authorizedUser: { email: "test@example.com", role: "admin" },
      loading: false,
    });

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(
      ["tournaments"],
      [
        {
          id: "wv-state-2026",
          name: "WV State Championship 2026",
          date: "2026-03-14",
          location: "Fairmont, WV",
          description: "WV State Championship info",
          status: "past",
          opr: 185.4,
          isDeleted: 0,
        },
      ],
    );

    await act(async () => {
      renderWithProviders(<TournamentsManager />, queryClient);
    });

    expect(screen.getByText(/Tournaments Log Manager/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Add Tournament/i }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: /Archive WV State Championship 2026/i,
      }),
    );
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      /Archive WV State Championship 2026/i,
    );
    expect(archiveTournament).not.toHaveBeenCalled();
  });

  it("creates a tournament through the decomposed manager form", async () => {
    mockAuth({
      user: { uid: "admin-uid", email: "admin@example.com" },
      authorizedUser: { email: "admin@example.com", role: "admin" },
      loading: false,
    });
    vi.mocked(createTournament).mockResolvedValue({
      id: "new-event",
      name: "New Event",
      date: "2026-10-01",
      location: "Morgantown, WV",
      status: "upcoming",
      isDeleted: 0,
    });

    renderWithProviders(<TournamentsManager />);
    fireEvent.click(screen.getByRole("button", { name: /Add Tournament/i }));
    fireEvent.change(screen.getByLabelText("Tournament Name *"), {
      target: { value: "New Event" },
    });
    fireEvent.change(screen.getByLabelText("Season"), {
      target: { value: "2026-2027" },
    });
    fireEvent.change(screen.getByLabelText("Game / Challenge"), {
      target: { value: "DECODE" },
    });
    fireEvent.change(screen.getByLabelText("Tournament Date *"), {
      target: { value: "2026-10-01" },
    });
    fireEvent.change(screen.getByLabelText("Location *"), {
      target: { value: "Morgantown, WV" },
    });
    fireEvent.change(screen.getByLabelText("Team #"), {
      target: { value: "23247" },
    });
    fireEvent.change(screen.getByLabelText("OPR Score"), {
      target: { value: "200.5" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Add Leaderboard Entry" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Publish Record" }));

    await waitFor(() =>
      expect(createTournament).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "New Event",
          seasonName: "2026-2027",
          challengeName: "DECODE",
          date: "2026-10-01",
          location: "Morgantown, WV",
          oprList: [
            { teamNumber: "23247", teamName: "Team 23247", opr: 200.5 },
          ],
        }),
      ),
    );
  });
});

describe("production tournament data integrity", () => {
  it("contains no production mock tournament or match histories", () => {
    const root = resolve(process.cwd(), "src", "app", "tournaments");
    const feedSource = readFileSync(resolve(root, "page.tsx"), "utf8");
    const detailSource = readFileSync(
      resolve(root, "[id]", "page.tsx"),
      "utf8",
    );

    expect(feedSource).not.toMatch(
      /MOCK_TOURNAMENTS|world-championship-2026|Texas Titans/,
    );
    expect(detailSource).not.toMatch(/getMockMatches|setDoc\(|mockItem/);
    expect(existsSync(resolve(root, "[id]", "mockData.ts"))).toBe(false);
  });
});
