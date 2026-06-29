import React from "react";
import { render, screen, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import TournamentsFeedPage from "../app/tournaments/page";
import TournamentDetailPage from "../app/tournaments/[id]/page";
import TournamentsManager from "../components/dashboard/TournamentsManager";
import { useAuth } from "../context/AuthContext";
import { getDocs } from "firebase/firestore";
import * as LucideIcons from "lucide-react";

// Mock AuthContext
vi.mock("../context/AuthContext", () => {
  return {
    useAuth: vi.fn(),
    AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: Infinity,
      staleTime: Infinity,
    },
  },
});

const renderWithProviders = (
  ui: React.ReactElement,
  queryClient = createTestQueryClient(),
  initialEntries = ["/tournaments/world-championship-2026"]
) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/tournaments/:id" element={ui} />
          <Route path="*" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
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
      "Bookmark"
    ];
    
    requiredIcons.forEach(iconName => {
      const Icon = (LucideIcons as any)[iconName];
      expect(Icon).toBeDefined();
      expect(typeof Icon).not.toBe("undefined");
    });
  });
});

describe("TournamentsFeedPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders locking administrative gate if user is not authorized", async () => {
    (useAuth as any).mockReturnValue({
      user: null,
      authorizedUser: null,
      loading: false,
    });

    await act(async () => {
      renderWithProviders(<TournamentsFeedPage />);
    });

    expect(screen.getByText(/Scouting & Tournaments Vault/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sign In with Google/i })).toBeInTheDocument();
  });

  it("renders tournaments dashboard list if user is authorized", async () => {
    (useAuth as any).mockReturnValue({
      user: { uid: "test-uid", email: "test@example.com" },
      authorizedUser: { email: "test@example.com", role: "student" },
      loading: false,
    });

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["tournaments"], [
      {
        id: "wv-state-2026",
        name: "WV State Championship 2026",
        date: "2026-03-14",
        location: "Fairmont, WV",
        description: "WV State Championship info",
        status: "past",
        opr: 185.4,
        isDeleted: 0
      }
    ]);

    await act(async () => {
      renderWithProviders(<TournamentsFeedPage />, queryClient);
    });

    expect(screen.getByText(/Scouting Vault/i)).toBeInTheDocument();
    expect(screen.getByText(/WV State Championship 2026/i)).toBeInTheDocument();
  });
});

describe("TournamentDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders detail page layout and stats", async () => {
    (useAuth as any).mockReturnValue({
      user: { uid: "test-uid", email: "test@example.com" },
      authorizedUser: { email: "test@example.com", role: "student" },
      loading: false,
    });

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["tournament", "world-championship-2026"], {
      id: "world-championship-2026",
      name: "FIRST® World Championship 2026",
      date: "2026-04-29",
      location: "Houston, TX",
      description: "The global gathering of top-tier *FIRST*® Tech Challenge teams.",
      status: "past",
      opr: 210.5,
      oprList: [
        { teamNumber: "23247", teamName: "ARES", opr: 210.5 }
      ],
      scoutingDetails: {
        autoPathNotes: "Path notes",
        driverFeedback: "Feedback notes",
        robotSpecs: "Specs notes"
      },
      photoAlbumId: "houston-2026",
      isDeleted: 0
    });
    queryClient.setQueryData(["tournament_matches", "world-championship-2026"], [
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
        notes: "Notes here"
      }
    ]);
    queryClient.setQueryData(["tournament_photos", "houston-2026"], []);

    await act(async () => {
      renderWithProviders(<TournamentDetailPage />, queryClient);
    });

    expect(screen.getByText(/FIRST® World Championship 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/Match Checklist/i)).toBeInTheDocument();
  });
});

describe("TournamentsManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prevents access for unprivileged student role", async () => {
    (useAuth as any).mockReturnValue({
      user: { uid: "test-uid", email: "test@example.com" },
      authorizedUser: { email: "test@example.com", role: "student" },
      loading: false,
    });

    await act(async () => {
      renderWithProviders(<TournamentsManager />);
    });

    expect(screen.getByText(/Unauthorized Terminal Access/i)).toBeInTheDocument();
  });

  it("renders manager control panel and lists tournaments for admins", async () => {
    (useAuth as any).mockReturnValue({
      user: { uid: "test-uid", email: "test@example.com" },
      authorizedUser: { email: "test@example.com", role: "admin" },
      loading: false,
    });

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["tournaments"], [
      {
        id: "wv-state-2026",
        name: "WV State Championship 2026",
        date: "2026-03-14",
        location: "Fairmont, WV",
        description: "WV State Championship info",
        status: "past",
        opr: 185.4,
        isDeleted: 0
      }
    ]);

    await act(async () => {
      renderWithProviders(<TournamentsManager />, queryClient);
    });

    expect(screen.getByText(/Tournaments Log Manager/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add Tournament/i })).toBeInTheDocument();
  });
});
