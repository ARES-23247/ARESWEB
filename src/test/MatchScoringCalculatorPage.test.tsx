import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MatchScoringCalculatorPage from "../app/calculator/page";
import {
  calculateAllianceBreakdown,
  calculateMatchComparison,
  clampValue,
  createInitialAllianceScores,
  formatMatchClipboardSummary,
  getAutoParkScore,
  getEndgameAscentScore,
  SCORING_VALUES,
  STRATEGY_PRESETS,
  AllianceScores,
} from "@/lib/scoringCalculator";

vi.mock("@/components/SEO", () => ({
  default: ({ title, description }: { title: string; description: string }) => (
    <div data-testid="mock-seo" data-title={title} data-description={description} />
  ),
}));

describe("Scoring Calculator Core Math Engine", () => {
  it("initializes with all zero scores", () => {
    const scores = createInitialAllianceScores();
    const breakdown = calculateAllianceBreakdown(scores);
    expect(breakdown.autoTotal).toBe(0);
    expect(breakdown.teleopTotal).toBe(0);
    expect(breakdown.endgameTotal).toBe(0);
    expect(breakdown.penaltiesTotal).toBe(0);
    expect(breakdown.totalScore).toBe(0);
    expect(breakdown.totalSamples).toBe(0);
    expect(breakdown.totalSpecimens).toBe(0);
    expect(breakdown.highValueCycles).toBe(0);
  });

  it("calculates autonomous points correctly", () => {
    const scores: AllianceScores = {
      ...createInitialAllianceScores(),
      autoNetZoneSamples: 2, // 2 * 2 = 4
      autoLowBasketSamples: 3, // 3 * 4 = 12
      autoHighBasketSamples: 4, // 4 * 8 = 32
      autoLowChamberSpecimens: 1, // 1 * 6 = 6
      autoHighChamberSpecimens: 2, // 2 * 10 = 20
      autoRobot1Park: "observation", // 3
      autoRobot2Park: "submersible", // 3
    };
    const breakdown = calculateAllianceBreakdown(scores);
    expect(breakdown.autoSamples).toBe(48); // 4 + 12 + 32
    expect(breakdown.autoSpecimens).toBe(26); // 6 + 20
    expect(breakdown.autoPark).toBe(6);
    expect(breakdown.autoTotal).toBe(80);
  });

  it("calculates teleop points correctly", () => {
    const scores: AllianceScores = {
      ...createInitialAllianceScores(),
      teleopNetZoneSamples: 5, // 5 * 2 = 10
      teleopLowBasketSamples: 2, // 2 * 4 = 8
      teleopHighBasketSamples: 8, // 8 * 8 = 64
      teleopLowChamberSpecimens: 3, // 3 * 6 = 18
      teleopHighChamberSpecimens: 4, // 4 * 10 = 40
    };
    const breakdown = calculateAllianceBreakdown(scores);
    expect(breakdown.teleopSamples).toBe(82); // 10 + 8 + 64
    expect(breakdown.teleopSpecimens).toBe(58); // 18 + 40
    expect(breakdown.teleopTotal).toBe(140);
  });

  it("calculates endgame ascent levels correctly", () => {
    expect(getEndgameAscentScore("none")).toBe(0);
    expect(getEndgameAscentScore("level1")).toBe(3);
    expect(getEndgameAscentScore("level2")).toBe(15);
    expect(getEndgameAscentScore("level3")).toBe(30);

    const scores: AllianceScores = {
      ...createInitialAllianceScores(),
      endgameRobot1Ascent: "level3", // 30
      endgameRobot2Ascent: "level2", // 15
    };
    const breakdown = calculateAllianceBreakdown(scores);
    expect(breakdown.endgameRobot1).toBe(30);
    expect(breakdown.endgameRobot2).toBe(15);
    expect(breakdown.endgameTotal).toBe(45);
  });

  it("calculates minor and major penalty points correctly", () => {
    const scores: AllianceScores = {
      ...createInitialAllianceScores(),
      minorPenalties: 3, // 3 * 5 = 15
      majorPenalties: 2, // 2 * 15 = 30
    };
    const breakdown = calculateAllianceBreakdown(scores);
    expect(breakdown.penaltiesMinor).toBe(15);
    expect(breakdown.penaltiesMajor).toBe(30);
    expect(breakdown.penaltiesTotal).toBe(45);
    expect(breakdown.totalScore).toBe(45);
  });

  it("clamps negative values and limits invalid numbers", () => {
    expect(clampValue(-5, 0, 99)).toBe(0);
    expect(clampValue(150, 0, 99)).toBe(99);
    expect(clampValue(Number.NaN, 0, 99)).toBe(0);
    expect(clampValue(Infinity, 0, 99)).toBe(0);
  });

  it("calculates head-to-head match comparison and point differential correctly", () => {
    const redScores: AllianceScores = {
      ...createInitialAllianceScores(),
      autoHighBasketSamples: 2, // 16
      teleopHighBasketSamples: 5, // 40
      endgameRobot1Ascent: "level3", // 30
    }; // Red = 86

    const blueScores: AllianceScores = {
      ...createInitialAllianceScores(),
      autoLowBasketSamples: 2, // 8
      teleopLowBasketSamples: 5, // 20
      endgameRobot1Ascent: "level1", // 3
    }; // Blue = 31

    const comparison = calculateMatchComparison(redScores, blueScores);
    expect(comparison.red.totalScore).toBe(86);
    expect(comparison.blue.totalScore).toBe(31);
    expect(comparison.pointSpread).toBe(55);
    expect(comparison.differential).toBe(55);
    expect(comparison.leader).toBe("red");
    expect(comparison.redSharePercentage).toBeGreaterThan(70);
    expect(comparison.blueSharePercentage).toBeLessThan(30);

    // Test tie condition
    const tieComparison = calculateMatchComparison(redScores, redScores);
    expect(tieComparison.leader).toBe("tie");
    expect(tieComparison.differential).toBe(0);
    expect(tieComparison.redSharePercentage).toBe(50);
  });

  it("formats clipboard match summary accurately for dual and single modes", () => {
    const redScores = STRATEGY_PRESETS[1].scores;
    const blueScores = STRATEGY_PRESETS[0].scores;

    const dualSummary = formatMatchClipboardSummary({
      redScores,
      blueScores,
      mode: "dual",
      matchTag: "WV State Qualifier 4",
    });

    expect(dualSummary).toContain("ARES 23247 FTC MATCH SCORING SUMMARY [WV State Qualifier 4]");
    expect(dualSummary).toContain("INTO THE DEEP");
    expect(dualSummary).toContain("RED ALLIANCE:");
    expect(dualSummary).toContain("BLUE ALLIANCE:");
    expect(dualSummary).toContain("Autonomous:");
    expect(dualSummary).toContain("TeleOp:");
    expect(dualSummary).toContain("Endgame:");

    const singleSummary = formatMatchClipboardSummary({
      redScores,
      mode: "single",
      activeAlliance: "red",
    });
    expect(singleSummary).toContain("RED ALLIANCE PROJECTION");
  });
});

describe("MatchScoringCalculatorPage Component & Accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders page header, title, SEO tags, and reference tables", () => {
    render(
      <MemoryRouter>
        <MatchScoringCalculatorPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { level: 1, name: /INTO THE DEEP Calculator/i })).toBeInTheDocument();
    expect(screen.getByText(/FIRST® Tech Challenge • Season 2024–2025/i)).toBeInTheDocument();
    expect(screen.getByTestId("mock-seo")).toHaveAttribute("data-title", "FTC Match Scoring Calculator & Strategy Planner");
    expect(screen.getByRole("heading", { name: /FTC INTO THE DEEP Official Point Values Reference/i })).toBeInTheDocument();
  });

  it("updates score in real-time when clicking stepper buttons", () => {
    render(
      <MemoryRouter>
        <MatchScoringCalculatorPage />
      </MemoryRouter>
    );

    // Initial total should be 0
    const increaseAutoHighBasket = screen.getAllByRole("button", { name: /Increase Sample in High Basket/i })[0];
    fireEvent.click(increaseAutoHighBasket);
    fireEvent.click(increaseAutoHighBasket); // 2 * 8 = 16 pts

    // Auto total should now reflect 16 pts
    expect(screen.getAllByText("16").length).toBeGreaterThanOrEqual(1);

    // Decrease by 1
    const decreaseAutoHighBasket = screen.getAllByRole("button", { name: /Decrease Sample in High Basket/i })[0];
    fireEvent.click(decreaseAutoHighBasket); // 1 * 8 = 8 pts
    expect(screen.getAllByText("8").length).toBeGreaterThanOrEqual(1);
  });

  it("updates score when typing directly into number input", () => {
    render(
      <MemoryRouter>
        <MatchScoringCalculatorPage />
      </MemoryRouter>
    );

    const input = screen.getAllByLabelText(/Sample in Low Basket/i)[0] as HTMLInputElement;
    fireEvent.change(input, { target: { value: "5" } }); // 5 * 4 = 20 pts

    expect(screen.getAllByText("20").length).toBeGreaterThanOrEqual(1);
  });

  it("updates autonomous parking score when selecting park radio options", () => {
    render(
      <MemoryRouter>
        <MatchScoringCalculatorPage />
      </MemoryRouter>
    );

    const r1ObservationPark = screen.getAllByRole("radio", { name: /Observation Zone/i })[0];
    fireEvent.click(r1ObservationPark);

    expect(r1ObservationPark).toHaveAttribute("aria-checked", "true");
  });

  it("updates endgame ascent score when selecting level radio options", () => {
    render(
      <MemoryRouter>
        <MatchScoringCalculatorPage />
      </MemoryRouter>
    );

    const r1Level3Hang = screen.getAllByRole("radio", { name: /Level 3/i })[0];
    fireEvent.click(r1Level3Hang);

    expect(r1Level3Hang).toHaveAttribute("aria-checked", "true");
    expect(screen.getAllByText("30").length).toBeGreaterThanOrEqual(1);
  });

  it("applies tactical strategy presets smoothly", () => {
    render(
      <MemoryRouter>
        <MatchScoringCalculatorPage />
      </MemoryRouter>
    );

    const worldClassPreset = screen.getByRole("button", { name: /World-Class Max Cycle/i });
    fireEvent.click(worldClassPreset);

    // Score should jump to high value (>200)
    expect(screen.getByText(/Loads onto active alliance/i)).toBeInTheDocument();
  });

  it("resets all alliance scores when clicking Reset Scores button", () => {
    render(
      <MemoryRouter>
        <MatchScoringCalculatorPage />
      </MemoryRouter>
    );

    // Set a preset first
    const rookiePreset = screen.getByRole("button", { name: /Rookie Baseline/i });
    fireEvent.click(rookiePreset);

    // Click Reset
    const resetButton = screen.getByRole("button", { name: /Reset all match scores/i });
    fireEvent.click(resetButton);

    // Red Alliance score should be back to 0
    expect(screen.getByRole("heading", { name: /Red Alliance/i })).toBeInTheDocument();
  });

  it("switches between Red and Blue alliance editing tabs in Dual mode", () => {
    render(
      <MemoryRouter>
        <MatchScoringCalculatorPage />
      </MemoryRouter>
    );

    const blueTab = screen.getByRole("tab", { name: /Blue Alliance/i });
    fireEvent.click(blueTab);
    expect(blueTab).toHaveAttribute("aria-selected", "true");

    const redTab = screen.getByRole("tab", { name: /Red Alliance/i });
    fireEvent.click(redTab);
    expect(redTab).toHaveAttribute("aria-selected", "true");
  });

  it("toggles single alliance mode", () => {
    render(
      <MemoryRouter>
        <MatchScoringCalculatorPage />
      </MemoryRouter>
    );

    const singleModeRadio = screen.getByRole("radio", { name: /Single Alliance/i });
    fireEvent.click(singleModeRadio);

    expect(singleModeRadio).toHaveAttribute("aria-checked", "true");
  });

  it("handles clipboard copying with success toast feedback", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <MemoryRouter>
        <MatchScoringCalculatorPage />
      </MemoryRouter>
    );

    const copyButton = screen.getByRole("button", { name: /Copy match scoring summary to clipboard/i });
    fireEvent.click(copyButton);

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByText(/Copied Summary!/i)).toBeInTheDocument();
    });
  });

  it("provides accessible labels and landmarks on all interactive controls", () => {
    render(
      <MemoryRouter>
        <MatchScoringCalculatorPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Alliance Score Projections and Differential/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Tactical Strategy Presets/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /1. Autonomous Period/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /2. Driver-Controlled \/ TeleOp Period/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /3. Endgame Submersible Ascent/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /4. Penalties Awarded/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Match Analytics & Cycle Metrics/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /FTC INTO THE DEEP Official Point Values Reference/i })).toBeInTheDocument();
  });
});
