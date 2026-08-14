import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MatchScoutingEntryPage from "@/app/tournaments/scouting/entry/page";
import {
  type AllianceColor,
  createDefaultScoutingEntry,
  calculateAutoScore,
  calculateTeleopScore,
  calculateEndgameScore,
  calculatePenaltyDeductions,
  calculateTotalScore,
  calculateScoringBreakdown,
  validateScoutingEntry,
  saveScoutingDraft,
  loadScoutingDraft,
  clearScoutingDraft,
  saveScoutingRecord,
  loadScoutingHistory,
  deleteScoutingRecord,
  clearScoutingHistory,
  exportScoutingToCsv,
  exportScoutingToJson,
} from "@/lib/scoutingData";
import { fetchTournaments } from "@/lib/tournamentApi";
import * as LucideIcons from "lucide-react";

vi.mock("@/lib/tournamentApi", () => ({
  fetchTournaments: vi.fn(),
  fetchTournament: vi.fn(),
  fetchTournamentMatches: vi.fn(),
}));

const mockTournaments = [
  {
    id: "wv-state-champ-2026",
    name: "West Virginia State Championship 2026",
    location: "Morgantown, WV",
    date: "2026-03-01",
    status: "upcoming",
    opr: 82.5,
    oprList: [
      { teamNumber: "23247", teamName: "ARES", opr: 94.2 },
      { teamNumber: "12345", teamName: "Quantum Quarks", opr: 78.4 },
    ],
    isDeleted: 0,
  },
  {
    id: "world-championship-2026",
    name: "FIRST World Championship 2026",
    location: "Houston, TX",
    date: "2026-04-20",
    status: "upcoming",
    opr: 95.0,
    oprList: [],
    isDeleted: 0,
  },
];

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
        staleTime: Infinity,
      },
    },
  });
}

function renderScoutingPage(queryClient = createTestQueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/tournaments/scouting/entry"]}>
        <Routes>
          <Route path="/tournaments/scouting/entry" element={<MatchScoutingEntryPage />} />
          <Route path="/tournaments" element={<div>Tournaments Feed</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("TournamentMatchScoutingSync - Data Models & Scoring Arithmetic", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("createDefaultScoutingEntry creates fully populated default structure", () => {
    const entry = createDefaultScoutingEntry();
    expect(entry.id).toBeDefined();
    expect(entry.matchNumber).toBe("QM1");
    expect(entry.alliance).toBe("red");
    expect(entry.auto.specimenHigh).toBe(0);
    expect(entry.auto.parkingZone).toBe("none");
    expect(entry.teleop.highBasket).toBe(0);
    expect(entry.teleop.driverAgility).toBe(3);
    expect(entry.endgame.ascentLevel).toBe("none");
    expect(entry.endgame.minorPenalty).toBe(false);
  });

  it("calculates autonomous scoring accurately", () => {
    const autoScore = calculateAutoScore({
      specimenHigh: 2, // 2 * 10 = 20
      specimenLow: 1,  // 1 * 6 = 6
      sampleSubmerged: 3, // 3 * 4 = 12
      parkingZone: "observation_zone", // 3
    });
    expect(autoScore).toBe(20 + 6 + 12 + 3); // 41

    const subParkScore = calculateAutoScore({
      specimenHigh: 0,
      specimenLow: 0,
      sampleSubmerged: 0,
      parkingZone: "submersible", // 3
    });
    expect(subParkScore).toBe(3);
  });

  it("calculates TeleOp scoring accurately", () => {
    const teleopScore = calculateTeleopScore({
      highBasket: 4, // 4 * 8 = 32
      lowBasket: 2,  // 2 * 4 = 8
      specimenTransfer: 3, // 3 * 6 = 18
      driverAgility: 4,
    });
    expect(teleopScore).toBe(32 + 8 + 18); // 58
  });

  it("calculates endgame scoring and penalties accurately", () => {
    expect(calculateEndgameScore({ ascentLevel: "none", minorPenalty: false, majorPenalty: false })).toBe(0);
    expect(calculateEndgameScore({ ascentLevel: "level_1", minorPenalty: false, majorPenalty: false })).toBe(3);
    expect(calculateEndgameScore({ ascentLevel: "level_2", minorPenalty: false, majorPenalty: false })).toBe(15);
    expect(calculateEndgameScore({ ascentLevel: "level_3", minorPenalty: false, majorPenalty: false })).toBe(30);

    const penalties = calculatePenaltyDeductions({
      ascentLevel: "level_3",
      minorPenalty: true, // 5
      majorPenalty: true, // 15
      minorPenaltyCount: 2, // 2 * 5 = 10
      majorPenaltyCount: 1, // 1 * 15 = 15
    });
    expect(penalties).toBe(25);
  });

  it("calculates total score, match rating, and detailed breakdown", () => {
    const testEntry = createDefaultScoutingEntry({
      auto: { specimenHigh: 1, specimenLow: 1, sampleSubmerged: 1, parkingZone: "observation_zone" }, // 10+6+4+3 = 23
      teleop: { highBasket: 2, lowBasket: 1, specimenTransfer: 1, driverAgility: 5 }, // 16+4+6 = 26
      endgame: { ascentLevel: "level_2", minorPenalty: true, majorPenalty: false, minorPenaltyCount: 1 }, // 15, pen: 5
    });

    const total = calculateTotalScore(testEntry);
    expect(total).toBe(23 + 26 + 15); // 64

    const breakdown = calculateScoringBreakdown(testEntry);
    expect(breakdown.autoPoints).toBe(23);
    expect(breakdown.teleopPoints).toBe(26);
    expect(breakdown.endgamePoints).toBe(15);
    expect(breakdown.penaltyDeduction).toBe(5);
    expect(breakdown.totalPoints).toBe(64);
    expect(breakdown.netScore).toBe(59);

    // Agility = 5 -> bonus = (5-3)*4 = +8
    expect(breakdown.matchRating).toBe(59 + 8); // 67
  });

  it("validates required fields and numerical boundaries", () => {
    const invalidEntry = {
      tournamentId: "",
      matchNumber: "",
      teamNumber: "invalid-alpha",
      alliance: "green" as unknown as AllianceColor,
      auto: { specimenHigh: -1, specimenLow: 0, sampleSubmerged: 0, parkingZone: "none" as const },
      teleop: { highBasket: 0, lowBasket: 0, specimenTransfer: 0, driverAgility: 7 },
    };

    const res = validateScoutingEntry(invalidEntry);
    expect(res.isValid).toBe(false);
    expect(res.errors.tournamentId).toBeDefined();
    expect(res.errors.matchNumber).toBeDefined();
    expect(res.errors.teamNumber).toBeDefined();
    expect(res.errors.alliance).toBeDefined();
    expect(res.errors["auto.specimenHigh"]).toBeDefined();
    expect(res.errors["teleop.driverAgility"]).toBeDefined();

    const validEntry = createDefaultScoutingEntry({
      tournamentId: "tourn-1",
      matchNumber: "QM1",
      teamNumber: "23247",
      alliance: "red",
    });
    expect(validateScoutingEntry(validEntry).isValid).toBe(true);
  });

  it("protects CSV exports against formula injection and formats properly", () => {
    const maliciousEntry = createDefaultScoutingEntry({
      matchNumber: "=CMD|' /C calc'!A0",
      teamNumber: "23247",
      tournamentId: "+123456",
      scoutName: "@attacker",
      notes: "-DANGEROUS",
    });

    const csv = exportScoutingToCsv([maliciousEntry]);
    expect(csv.startsWith("\uFEFF")).toBe(true); // UTF-8 BOM
    expect(csv).toContain("\"'=CMD|' /C calc'!A0\"");
    expect(csv).toContain("\"'+123456\"");
    expect(csv).toContain("\"'@attacker\"");
    expect(csv).toContain("\"'-DANGEROUS\"");
  });

  it("exports JSON with calculated scoring breakdowns", () => {
    const entry = createDefaultScoutingEntry({
      tournamentId: "t1",
      teamNumber: "23247",
    });
    const jsonStr = exportScoutingToJson([entry]);
    const parsed = JSON.parse(jsonStr);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].scoringBreakdown).toBeDefined();
    expect(parsed[0].scoringBreakdown.matchRating).toBeDefined();
  });
});

describe("TournamentMatchScoutingSync - LocalStorage & Offline Sync Functions", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("saves, loads, and clears draft in localStorage safely", () => {
    const draft = { matchNumber: "QM42", teamNumber: "23247" };
    saveScoutingDraft(draft);

    const loaded = loadScoutingDraft();
    expect(loaded?.matchNumber).toBe("QM42");
    expect(loaded?.teamNumber).toBe("23247");

    clearScoutingDraft();
    expect(loadScoutingDraft()).toBeNull();
  });

  it("saves, lists, deletes, and clears history in localStorage", () => {
    const r1 = createDefaultScoutingEntry({ id: "rec-1", matchNumber: "QM1", teamNumber: "23247" });
    const r2 = createDefaultScoutingEntry({ id: "rec-2", matchNumber: "QM2", teamNumber: "12345" });

    saveScoutingRecord(r1);
    saveScoutingRecord(r2);

    let history = loadScoutingHistory();
    expect(history.length).toBe(2);
    expect(history[0].id).toBe("rec-2"); // latest first

    history = deleteScoutingRecord("rec-1");
    expect(history.length).toBe(1);
    expect(history[0].id).toBe("rec-2");

    clearScoutingHistory();
    expect(loadScoutingHistory().length).toBe(0);
  });
});

describe("TournamentMatchScoutingSync - UI Interactions & Form State", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(fetchTournaments).mockResolvedValue(mockTournaments as unknown as Awaited<ReturnType<typeof fetchTournaments>>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders page title, connection indicator, and all scouting sections", async () => {
    renderScoutingPage();

    expect(screen.getByText(/Match Scouting/i)).toBeInTheDocument();
    expect(screen.getByText(/Online · Auto-saving/i)).toBeInTheDocument();
    expect(screen.getByText(/1\. Match & Team Identification/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. Autonomous Phase/i)).toBeInTheDocument();
    expect(screen.getByText(/3\. Driver-Controlled TeleOp/i)).toBeInTheDocument();
    expect(screen.getByText(/4\. Endgame Ascent & Penalties/i)).toBeInTheDocument();
    expect(screen.getByText(/Tactical Review/i)).toBeInTheDocument();
  });

  it("increments and decrements counters and clamps to zero", async () => {
    renderScoutingPage();

    const highSpecimenInput = screen.getByRole("spinbutton", { name: "High Chamber Specimen" }) as HTMLInputElement;
    expect(highSpecimenInput.value).toBe("0");

    const increaseBtn = screen.getByRole("button", { name: /Increase High Chamber Specimen/i });
    const decreaseBtn = screen.getByRole("button", { name: /Decrease High Chamber Specimen/i });

    // Click Increase
    fireEvent.click(increaseBtn);
    expect(highSpecimenInput.value).toBe("1");

    fireEvent.click(increaseBtn);
    expect(highSpecimenInput.value).toBe("2");

    // Click Decrease
    fireEvent.click(decreaseBtn);
    expect(highSpecimenInput.value).toBe("1");

    fireEvent.click(decreaseBtn);
    expect(highSpecimenInput.value).toBe("0");

    // Decrement when at 0 stays at 0
    fireEvent.click(decreaseBtn);
    expect(highSpecimenInput.value).toBe("0");
  });

  it("updates live score breakdown dynamically upon counter changes", async () => {
    renderScoutingPage();

    // Initial total points = 0
    const totalPointsHeading = screen.getByText("Total Match Pts").parentElement;
    expect(within(totalPointsHeading!).getByText("0")).toBeInTheDocument();

    // Increment Auto High Specimen (+10 pts)
    const incAutoHigh = screen.getByRole("button", { name: /Increase High Chamber Specimen/i });
    fireEvent.click(incAutoHigh);

    // Auto subtotal should now be +10
    expect(screen.getByText("Auto Subtotal: +10 pts")).toBeInTheDocument();

    // Increment TeleOp High Basket (+8 pts)
    const incTeleopBasket = screen.getByRole("button", { name: /Increase High Basket Samples/i });
    fireEvent.click(incTeleopBasket);

    expect(screen.getByText("TeleOp Subtotal: +8 pts")).toBeInTheDocument();

    // Total should be 18
    expect(within(totalPointsHeading!).getByText("18")).toBeInTheDocument();
  });

  it("handles driver agility rating selection", async () => {
    renderScoutingPage();

    const agilityGroup = screen.getByRole("radiogroup", { name: /Driver Agility/i });
    const rating5Btn = within(agilityGroup).getByRole("radio", { name: /5/i });
    fireEvent.click(rating5Btn);

    expect(screen.getByText("5 / 5")).toBeInTheDocument();
  });

  it("handles endgame ascent level and penalty observations", async () => {
    renderScoutingPage();

    // Select Level 3 Ascent (+30 pts)
    const level3Btn = screen.getByRole("radio", { name: /Level 3 \(High Hang\)/i });
    fireEvent.click(level3Btn);

    expect(screen.getByText("Endgame Subtotal: +30 pts")).toBeInTheDocument();

    // Check minor penalty (-5 pts)
    const minorCheck = screen.getByLabelText(/Minor Penalty Observed/i);
    fireEvent.click(minorCheck);

    // Penalties card should show -5
    expect(screen.getByText("-5")).toBeInTheDocument();
  });

  it("auto-populates team name when tournament and team number match roster", async () => {
    renderScoutingPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Tournament/i)).toBeInTheDocument();
    });

    const tournSelect = screen.getByLabelText(/Tournament/i);
    fireEvent.change(tournSelect, { target: { value: "wv-state-champ-2026" } });

    const teamInput = screen.getByLabelText(/Team Number/i);
    fireEvent.change(teamInput, { target: { value: "23247" } });

    await waitFor(() => {
      const teamNameInput = screen.getByLabelText(/Team Name/i) as HTMLInputElement;
      expect(teamNameInput.value).toBe("ARES");
    });
  });

  it("displays validation error when required fields are missing on submit", async () => {
    renderScoutingPage();

    const submitBtn = screen.getByRole("button", { name: /Save & Record Match/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    const alertBox = await screen.findByRole("alert");
    expect(within(alertBox).getByText(/Tournament selection is required/i)).toBeInTheDocument();
    expect(within(alertBox).getByText(/Team number is required/i)).toBeInTheDocument();
  });

  it("saves record, increments match number, and updates saved matches modal", async () => {
    renderScoutingPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Tournament/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Tournament/i), { target: { value: "wv-state-champ-2026" } });
    fireEvent.change(screen.getByLabelText(/Match Number/i), { target: { value: "QM1" } });
    fireEvent.change(screen.getByLabelText(/Team Number/i), { target: { value: "23247" } });
    fireEvent.change(screen.getByLabelText(/Scout Initials/i), { target: { value: "JD" } });

    // Click submit
    const submitBtn = screen.getByRole("button", { name: /Save & Record Match/i });
    fireEvent.click(submitBtn);

    // Success alert banner appears
    expect(await screen.findByText(/Match QM1 \(Team 23247\) scouted and saved successfully/i)).toBeInTheDocument();

    // Match number auto-increments to QM2
    const matchNumberInput = screen.getByLabelText(/Match Number/i) as HTMLInputElement;
    expect(matchNumberInput.value).toBe("QM2");

    // Open History Modal
    const savedMatchesBtn = screen.getByRole("button", { name: /Saved Matches \(1\)/i });
    fireEvent.click(savedMatchesBtn);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Match QM1 · Team 23247/i)).toBeInTheDocument();
  });

  it("restores previously stored draft on mount", async () => {
    saveScoutingDraft({
      tournamentId: "wv-state-champ-2026",
      matchNumber: "QM99",
      teamNumber: "9999",
      alliance: "blue",
      notes: "Recovered draft notes",
    });

    renderScoutingPage();

    const matchInput = screen.getByLabelText(/Match Number/i) as HTMLInputElement;
    expect(matchInput.value).toBe("QM99");

    const teamInput = screen.getByLabelText(/Team Number/i) as HTMLInputElement;
    expect(teamInput.value).toBe("9999");

    const notesInput = screen.getByLabelText(/Qualitative Scout Notes/i) as HTMLTextAreaElement;
    expect(notesInput.value).toBe("Recovered draft notes");
  });

  it("toggles online and offline status indicator", async () => {
    renderScoutingPage();

    expect(screen.getByText(/Online · Auto-saving/i)).toBeInTheDocument();

    // Trigger offline event
    fireEvent(window, new Event("offline"));
    expect(screen.getByText(/Offline Mode · Saved Locally/i)).toBeInTheDocument();

    // Trigger online event
    fireEvent(window, new Event("online"));
    expect(screen.getByText(/Online · Auto-saving/i)).toBeInTheDocument();
  });

  it("copies summary to clipboard", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    renderScoutingPage();

    const copyBtn = screen.getByRole("button", { name: /Copy Summary/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalled();
      expect(screen.getByText(/Copied!/i)).toBeInTheDocument();
    });
  });

  it("verifies all required Lucide icons exist", () => {
    const requiredIcons = [
      "Trophy",
      "Wifi",
      "WifiOff",
      "CheckCircle2",
      "AlertCircle",
      "Plus",
      "Minus",
      "Save",
      "RotateCcw",
      "Download",
      "Copy",
      "ChevronLeft",
      "Sparkles",
      "Zap",
      "Clock",
      "Trash2",
      "Shield",
      "Flag",
      "ListOrdered",
      "FileSpreadsheet",
      "Check",
      "ClipboardList",
    ];

    requiredIcons.forEach((iconName) => {
      const Icon = LucideIcons[iconName as keyof typeof LucideIcons];
      expect(Icon).toBeDefined();
      expect(typeof Icon).not.toBe("undefined");
    });
  });
});
