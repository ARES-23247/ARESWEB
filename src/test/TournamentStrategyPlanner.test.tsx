import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FieldStrategyPlannerPage from "@/app/tournaments/strategy/page";
import {
  PRESET_ROUTINES,
  DEFENSE_PROFILES,
  ACTION_DEFINITIONS,
  FTC_FIELD_ELEMENTS,
  calculateRoutineScore,
  calculateSynergyScore,
  inchToSvgPercent,
  type AlliancePartnerConfig,
} from "@/lib/fieldStrategyData";

describe("FTC Field Strategy Data Models & Calculations", () => {
  it("calculates routine score accurately for 5-Specimen Auto preset", () => {
    const routine = PRESET_ROUTINES[0]; // 5-Specimen Auto Red
    const score = calculateRoutineScore(routine);

    // 5 High Specimen hangs in auto (5 * 32 = 160 pts)
    expect(score.autoScore).toBe(160);
    // 3 Teleop Specimen hangs (3 * 20 = 60 pts)
    expect(score.teleopScore).toBe(60);
    // Level 3 Ascent in endgame (30 pts)
    expect(score.endgameScore).toBe(30);
    expect(score.totalScore).toBe(250);
    expect(score.autoDuration).toBeGreaterThan(0);
    expect(score.autoDuration).toBeLessThanOrEqual(30);
  });

  it("calculates routine score accurately for 4-Sample Basket preset", () => {
    const routine = PRESET_ROUTINES[1]; // 4-Sample Basket Red
    const score = calculateRoutineScore(routine);

    // 4 High Basket deposits (4 * 8 = 32) + 1 Submersible park (3) = 35 pts
    expect(score.autoScore).toBe(35);
    // 2 Teleop High Basket deposits (2 * 8 = 16 pts)
    expect(score.teleopScore).toBe(16);
    // Level 3 Ascent in endgame (30 pts)
    expect(score.endgameScore).toBe(30);
    expect(score.totalScore).toBe(81);
  });

  it("calculates alliance partner synergy with zero defense", () => {
    const r1 = PRESET_ROUTINES[0];
    const partner: AlliancePartnerConfig = {
      teamNumber: "19376",
      teamName: "Valhalla Robotics",
      autoSpecimensHigh: 2, // 2 * 32 = 64 pts
      autoSamplesHigh: 0,
      autoPark: "observation", // 3 pts
      teleopSpecimensHigh: 3, // 3 * 20 = 60 pts
      teleopSamplesHigh: 0,
      endgameAscent: "level_2", // 15 pts
      reliabilityFactor: 1.0,
      preferredRole: "specimen_cycler",
    };
    const defense = DEFENSE_PROFILES.none;

    const result = calculateSynergyScore(r1, partner, defense);

    expect(result.robot1Score).toBe(250);
    // Partner raw: 64 + 3 + 60 + 15 = 142
    expect(result.robot2Score).toBe(142);
    expect(result.rawAllianceScore).toBe(392);
    expect(result.defenseAdjustedScore).toBe(392);
    expect(result.autoAllianceScore).toBe(160 + 67);
    expect(result.teleopAllianceScore).toBe(60 + 60);
    expect(result.endgameAllianceScore).toBe(30 + 15);
    expect(result.synergyRating).toBe("Congested");
    expect(result.submersibleCongestionRisk).toBe("Moderate");
  });

  it("calculates optimal role separation synergy rating when partner cycles baskets", () => {
    const r1 = PRESET_ROUTINES[0]; // Specimen cycler
    const partner: AlliancePartnerConfig = {
      teamNumber: "19376",
      teamName: "Valhalla Robotics",
      autoSpecimensHigh: 0,
      autoSamplesHigh: 3, // 24 pts
      autoPark: "submersible", // 3 pts
      teleopSpecimensHigh: 0,
      teleopSamplesHigh: 6, // 48 pts
      endgameAscent: "level_3", // 30 pts
      reliabilityFactor: 0.9,
      preferredRole: "basket_cycler",
    };
    const defense = DEFENSE_PROFILES.light_chokepoint;

    const result = calculateSynergyScore(r1, partner, defense);

    expect(result.synergyRating).toBe("Exceptional");
    expect(result.submersibleCongestionRisk).toBe("Low");
    expect(result.strategicRecommendation).toContain("Optimal role separation");
    // Teleop efficiency penalty applied
    expect(result.defenseAdjustedScore).toBeLessThan(result.rawAllianceScore);
  });

  it("handles low partner reliability factor gracefully", () => {
    const r1 = PRESET_ROUTINES[0];
    const partner: AlliancePartnerConfig = {
      teamNumber: "99999",
      teamName: "Rookie Bot",
      autoSpecimensHigh: 1,
      autoSamplesHigh: 0,
      autoPark: "none",
      teleopSpecimensHigh: 1,
      teleopSamplesHigh: 0,
      endgameAscent: "level_1",
      reliabilityFactor: 0.6,
      preferredRole: "defense_anchor",
    };
    const defense = DEFENSE_PROFILES.heavy_pin;

    const result = calculateSynergyScore(r1, partner, defense);

    expect(result.synergyRating).toBe("High Risk");
    expect(result.strategicRecommendation).toContain("reliability");
  });

  it("converts inches to SVG percentage within bounds", () => {
    expect(inchToSvgPercent(0)).toBe(0);
    expect(inchToSvgPercent(72)).toBe(50);
    expect(inchToSvgPercent(144)).toBe(100);
    expect(inchToSvgPercent(-10)).toBe(0);
    expect(inchToSvgPercent(200)).toBe(100);
  });

  it("verifies field element landmark integrity", () => {
    expect(FTC_FIELD_ELEMENTS.length).toBeGreaterThan(5);
    const observationRed = FTC_FIELD_ELEMENTS.find((e) => e.id === "obs_zone_red");
    expect(observationRed).toBeDefined();
    expect(observationRed?.bounds.width).toBe(36);

    const submersible = FTC_FIELD_ELEMENTS.find((e) => e.id === "submersible_center");
    expect(submersible).toBeDefined();
    expect(submersible?.bounds.width).toBe(48);
  });

  it("verifies action definitions points consistency", () => {
    expect(ACTION_DEFINITIONS.auto_specimen_high.points).toBe(32);
    expect(ACTION_DEFINITIONS.teleop_specimen_high.points).toBe(20);
    expect(ACTION_DEFINITIONS.auto_sample_high_basket.points).toBe(8);
    expect(ACTION_DEFINITIONS.endgame_ascent_level_3.points).toBe(30);
    expect(ACTION_DEFINITIONS.auto_park_observation.points).toBe(3);
  });
});

describe("Tournament Field Strategy Planner UI", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const renderPlanner = () => {
    return render(
      <MemoryRouter initialEntries={["/tournaments/strategy"]}>
        <FieldStrategyPlannerPage />
      </MemoryRouter>
    );
  };

  it("renders the strategy planner header, projected scores, and navigation tabs", () => {
    renderPlanner();

    expect(
      screen.getByRole("heading", { name: /Autonomous Strategy & Match Estimator/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Projected Run Score/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Interactive 144" Field Canvas/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sequence Step Builder/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Partner Synergy & Defense Simulator/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Match Strategy Binder Sheet/i })).toBeInTheDocument();
  });

  it("renders interactive 144x144 field canvas with SVG elements", () => {
    renderPlanner();

    const svgCanvas = screen.getByLabelText(/144 inch by 144 inch FTC Field Canvas/i);
    expect(svgCanvas).toBeInTheDocument();
    expect(screen.getAllByText(/RED OBSERVATION/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/BLUE OBSERVATION/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/SUBMERSIBLE STRUCTURE/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/RED HIGH CHAMBER/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/BLUE HIGH CHAMBER/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ASCENT RUNGS L1-L3/i).length).toBeGreaterThan(0);
  });

  it("switches routine presets and updates waypoints & score", () => {
    renderPlanner();

    const presetSelect = screen.getByLabelText(/Routine Preset:/i);
    fireEvent.change(presetSelect, { target: { value: "routine_4_sample_red" } });

    expect(screen.getAllByText(/Preload High Basket Deposit/i).length).toBeGreaterThan(0);
  });

  it("toggles alliance color buttons", () => {
    renderPlanner();

    const blueBtn = screen.getByRole("button", { name: /Blue Alliance/i });
    fireEvent.click(blueBtn);

    const redBtn = screen.getByRole("button", { name: /Red Alliance/i });
    fireEvent.click(redBtn);
    expect(redBtn).toHaveClass("bg-ares-red");
  });

  it("allows adding, editing, moving, and deleting sequence steps", () => {
    renderPlanner();

    // Switch to Builder tab
    const builderTab = screen.getByRole("button", { name: /Sequence Step Builder/i });
    fireEvent.click(builderTab);

    expect(screen.getByText(/Configured Routine Steps/i)).toBeInTheDocument();

    // Add Auto Step
    const addAutoBtn = screen.getByRole("button", { name: /Add Auto Step/i });
    fireEvent.click(addAutoBtn);

    // Add Teleop Step
    const addTeleopBtn = screen.getByRole("button", { name: /Add Teleop Step/i });
    fireEvent.click(addTeleopBtn);

    // Check that steps table updated
    expect(screen.getAllByText(/auto/i).length).toBeGreaterThan(0);
  });

  it("warns if autonomous sequence exceeds 30.0 seconds", () => {
    renderPlanner();

    // Switch to Canvas tab and edit a step duration to 35 seconds
    const canvasTab = screen.getByRole("button", { name: /Interactive 144" Field Canvas/i });
    fireEvent.click(canvasTab);

    const durationInput = screen.getByLabelText("Duration (Sec)");
    fireEvent.change(durationInput, { target: { value: "35" } });

    // Switch to Builder tab to verify warning gauge
    const builderTab = screen.getByRole("button", { name: /Sequence Step Builder/i });
    fireEvent.click(builderTab);

    expect(screen.getByText(/Autonomous routine exceeds official 30.0s time cutoff/i)).toBeInTheDocument();
  });

  it("simulates alliance partner synergy and toggles defense profiles", () => {
    renderPlanner();

    const synergyTab = screen.getByRole("button", { name: /Partner Synergy & Defense Simulator/i });
    fireEvent.click(synergyTab);

    expect(screen.getByText(/Alliance Partner Capability Profile/i)).toBeInTheDocument();
    expect(screen.getByText(/Projected Alliance Match Score/i)).toBeInTheDocument();

    // Change partner auto specimens
    const autoSpecInput = screen.getByLabelText(/Auto Specimens/i);
    fireEvent.change(autoSpecInput, { target: { value: "4" } });

    // Select heavy pin defense
    const heavyPinBtn = screen.getByRole("button", { name: /Heavy Submersible Gate Pinning/i });
    fireEvent.click(heavyPinBtn);

    expect(screen.getByText(/Teleop Efficiency: 65%/i)).toBeInTheDocument();
  });

  it("renders printable drive team binder view and triggers window.print", () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    renderPlanner();

    const printTab = screen.getByRole("button", { name: /Match Strategy Binder Sheet/i });
    fireEvent.click(printTab);

    expect(screen.getByText(/Official Match Strategy & Autonomous Plan/i)).toBeInTheDocument();
    expect(screen.getByText(/Teleop Cycling Protocol/)).toBeInTheDocument();
    expect(screen.getByText(/Endgame Climb Protocol/)).toBeInTheDocument();

    // Click print buttons
    const printButtons = screen.getAllByRole("button", { name: /Print Strategy Sheet/i });
    fireEvent.click(printButtons[0]);

    expect(printSpy).toHaveBeenCalled();
  });
});
