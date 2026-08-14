/**
 * ARES 23247 FTC Field Strategy & Match Run Estimator Data Models
 * Game: FIRST Tech Challenge - INTO THE DEEP (144" x 144" Field)
 */

export const FIELD_SIZE_INCHES = 144;
export const TILE_SIZE_INCHES = 24;
export const TILE_COUNT = 6;

export type AllianceColor = "red" | "blue";

export type MatchPhase = "auto" | "teleop" | "endgame";

export type StrategyActionType =
  | "auto_specimen_high"
  | "auto_specimen_low"
  | "auto_sample_high_basket"
  | "auto_sample_low_basket"
  | "auto_sample_net_zone"
  | "auto_park_observation"
  | "auto_park_submersible"
  | "teleop_specimen_high"
  | "teleop_specimen_low"
  | "teleop_sample_high_basket"
  | "teleop_sample_low_basket"
  | "teleop_sample_net_zone"
  | "endgame_ascent_level_1"
  | "endgame_ascent_level_2"
  | "endgame_ascent_level_3"
  | "endgame_park_observation"
  | "custom_waypoint";

export interface FieldCoordinate {
  x: number; // 0 to 144 inches (0 = Red side/audience left, 144 = Blue side/audience right)
  y: number; // 0 to 144 inches (0 = Audience wall, 144 = Back wall)
}

export interface FieldElement {
  id: string;
  name: string;
  category: "chamber" | "basket" | "submersible" | "ascent" | "observation" | "start" | "sample_spike";
  alliance?: AllianceColor | "neutral";
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  pointValueAuto?: number;
  pointValueTeleop?: number;
  pointValueEndgame?: number;
  description: string;
}

export interface StrategyStep {
  id: string;
  phase: MatchPhase;
  action: StrategyActionType;
  label: string;
  description?: string;
  targetCoordinate: FieldCoordinate;
  durationSeconds: number;
  points: number;
  riskFactor: "low" | "medium" | "high";
  notes?: string;
}

export interface StrategyRoutine {
  id: string;
  name: string;
  description: string;
  alliance: AllianceColor;
  startingPosition: FieldCoordinate;
  startingPositionName: string;
  steps: StrategyStep[];
}

export type DefenseProfileId = "none" | "light_chokepoint" | "heavy_pin" | "specimen_wall";

export interface DefenseProfile {
  id: DefenseProfileId;
  name: string;
  description: string;
  teleopEfficiencyMultiplier: number;
  cycleTimePenaltySeconds: number;
  foulRisk: "low" | "medium" | "high";
}

export interface AlliancePartnerConfig {
  teamNumber: string;
  teamName: string;
  autoSpecimensHigh: number;
  autoSamplesHigh: number;
  autoPark: "none" | "observation" | "submersible";
  teleopSpecimensHigh: number;
  teleopSamplesHigh: number;
  endgameAscent: "none" | "level_1" | "level_2" | "level_3";
  reliabilityFactor: number; // 0.0 to 1.0
  preferredRole: "specimen_cycler" | "basket_cycler" | "hybrid" | "defense_anchor";
}

export interface AllianceSynergyResult {
  robot1Score: number;
  robot2Score: number;
  rawAllianceScore: number;
  defenseAdjustedScore: number;
  autoAllianceScore: number;
  teleopAllianceScore: number;
  endgameAllianceScore: number;
  synergyRating: "Exceptional" | "Balanced" | "Congested" | "High Risk";
  strategicRecommendation: string;
  submersibleCongestionRisk: "Low" | "Moderate" | "High";
}

// Action metadata & point lookup
export const ACTION_DEFINITIONS: Record<
  StrategyActionType,
  {
    label: string;
    phase: MatchPhase;
    points: number;
    defaultDuration: number;
    category: "chamber" | "basket" | "ascent" | "park" | "custom";
    defaultCoordinate: FieldCoordinate;
  }
> = {
  auto_specimen_high: {
    label: "Auto High Chamber Specimen",
    phase: "auto",
    points: 32,
    defaultDuration: 4.5,
    category: "chamber",
    defaultCoordinate: { x: 60, y: 84 },
  },
  auto_specimen_low: {
    label: "Auto Low Chamber Specimen",
    phase: "auto",
    points: 16,
    defaultDuration: 4.0,
    category: "chamber",
    defaultCoordinate: { x: 60, y: 84 },
  },
  auto_sample_high_basket: {
    label: "Auto High Basket Sample",
    phase: "auto",
    points: 8,
    defaultDuration: 5.0,
    category: "basket",
    defaultCoordinate: { x: 16, y: 128 },
  },
  auto_sample_low_basket: {
    label: "Auto Low Basket Sample",
    phase: "auto",
    points: 4,
    defaultDuration: 4.0,
    category: "basket",
    defaultCoordinate: { x: 16, y: 128 },
  },
  auto_sample_net_zone: {
    label: "Auto Net Zone Sample",
    phase: "auto",
    points: 2,
    defaultDuration: 3.0,
    category: "basket",
    defaultCoordinate: { x: 24, y: 132 },
  },
  auto_park_observation: {
    label: "Auto Park (Observation Zone)",
    phase: "auto",
    points: 3,
    defaultDuration: 3.0,
    category: "park",
    defaultCoordinate: { x: 18, y: 18 },
  },
  auto_park_submersible: {
    label: "Auto Park (Submersible Zone)",
    phase: "auto",
    points: 3,
    defaultDuration: 3.5,
    category: "park",
    defaultCoordinate: { x: 72, y: 72 },
  },
  teleop_specimen_high: {
    label: "Teleop High Chamber Specimen",
    phase: "teleop",
    points: 20,
    defaultDuration: 8.0,
    category: "chamber",
    defaultCoordinate: { x: 60, y: 84 },
  },
  teleop_specimen_low: {
    label: "Teleop Low Chamber Specimen",
    phase: "teleop",
    points: 10,
    defaultDuration: 6.5,
    category: "chamber",
    defaultCoordinate: { x: 60, y: 84 },
  },
  teleop_sample_high_basket: {
    label: "Teleop High Basket Sample",
    phase: "teleop",
    points: 8,
    defaultDuration: 7.5,
    category: "basket",
    defaultCoordinate: { x: 16, y: 128 },
  },
  teleop_sample_low_basket: {
    label: "Teleop Low Basket Sample",
    phase: "teleop",
    points: 4,
    defaultDuration: 6.0,
    category: "basket",
    defaultCoordinate: { x: 16, y: 128 },
  },
  teleop_sample_net_zone: {
    label: "Teleop Net Zone Sample",
    phase: "teleop",
    points: 2,
    defaultDuration: 4.5,
    category: "basket",
    defaultCoordinate: { x: 24, y: 132 },
  },
  endgame_ascent_level_1: {
    label: "Endgame Level 1 Ascent (Low Rung)",
    phase: "endgame",
    points: 3,
    defaultDuration: 4.0,
    category: "ascent",
    defaultCoordinate: { x: 72, y: 64 },
  },
  endgame_ascent_level_2: {
    label: "Endgame Level 2 Ascent (Mid Rung)",
    phase: "endgame",
    points: 15,
    defaultDuration: 7.0,
    category: "ascent",
    defaultCoordinate: { x: 72, y: 72 },
  },
  endgame_ascent_level_3: {
    label: "Endgame Level 3 Ascent (High Rung)",
    phase: "endgame",
    points: 30,
    defaultDuration: 10.0,
    category: "ascent",
    defaultCoordinate: { x: 72, y: 72 },
  },
  endgame_park_observation: {
    label: "Endgame Observation Zone Park",
    phase: "endgame",
    points: 3,
    defaultDuration: 4.0,
    category: "park",
    defaultCoordinate: { x: 18, y: 18 },
  },
  custom_waypoint: {
    label: "Custom Waypoint / Maneuver",
    phase: "auto",
    points: 0,
    defaultDuration: 2.0,
    category: "custom",
    defaultCoordinate: { x: 72, y: 72 },
  },
};

// Official FTC Field Elements & Boundaries
export const FTC_FIELD_ELEMENTS: FieldElement[] = [
  // Observation Zones
  {
    id: "obs_zone_red",
    name: "Red Observation Zone",
    category: "observation",
    alliance: "red",
    bounds: { x: 0, y: 0, width: 36, height: 36 },
    pointValueAuto: 3,
    pointValueEndgame: 3,
    description: "Human player specimen intake area & auto/endgame parking tile.",
  },
  {
    id: "obs_zone_blue",
    name: "Blue Observation Zone",
    category: "observation",
    alliance: "blue",
    bounds: { x: 108, y: 108, width: 36, height: 36 },
    pointValueAuto: 3,
    pointValueEndgame: 3,
    description: "Blue human player specimen intake area & auto/endgame parking tile.",
  },
  // Submersible Structure
  {
    id: "submersible_center",
    name: "Submersible Structure",
    category: "submersible",
    alliance: "neutral",
    bounds: { x: 48, y: 48, width: 48, height: 48 },
    pointValueAuto: 3,
    description: "Central grid containing neutral samples, high/low chambers, and ascent rungs.",
  },
  // High / Low Chambers
  {
    id: "chamber_high_red",
    name: "Red High Chamber Bar",
    category: "chamber",
    alliance: "red",
    bounds: { x: 48, y: 80, width: 24, height: 8 },
    pointValueAuto: 32,
    pointValueTeleop: 20,
    description: "Hang clips for preloaded & scored specimens (Auto: 32 pts, Teleop: 20 pts).",
  },
  {
    id: "chamber_high_blue",
    name: "Blue High Chamber Bar",
    category: "chamber",
    alliance: "blue",
    bounds: { x: 72, y: 80, width: 24, height: 8 },
    pointValueAuto: 32,
    pointValueTeleop: 20,
    description: "Hang clips for preloaded & scored specimens (Auto: 32 pts, Teleop: 20 pts).",
  },
  // Sample Baskets
  {
    id: "basket_high_red",
    name: "Red High Basket",
    category: "basket",
    alliance: "red",
    bounds: { x: 0, y: 120, width: 24, height: 24 },
    pointValueAuto: 8,
    pointValueTeleop: 8,
    description: "High elevation bucket for sample scoring (8 pts).",
  },
  {
    id: "basket_high_blue",
    name: "Blue High Basket",
    category: "basket",
    alliance: "blue",
    bounds: { x: 120, y: 0, width: 24, height: 24 },
    pointValueAuto: 8,
    pointValueTeleop: 8,
    description: "High elevation bucket for sample scoring (8 pts).",
  },
  // Ascent Rungs
  {
    id: "ascent_rungs_center",
    name: "Submersible Ascent Rungs",
    category: "ascent",
    alliance: "neutral",
    bounds: { x: 60, y: 60, width: 24, height: 24 },
    pointValueEndgame: 30,
    description: "Rungs supporting Level 1 (3 pts), Level 2 (15 pts), and Level 3 (30 pts) climbs.",
  },
  // Alliance Start Spots
  {
    id: "start_red_observation",
    name: "Red Start (Observation Side)",
    category: "start",
    alliance: "red",
    bounds: { x: 12, y: 12, width: 18, height: 18 },
    description: "Starting position optimal for Specimen cycling & wall human player intake.",
  },
  {
    id: "start_red_submersible",
    name: "Red Start (Basket / Submersible Side)",
    category: "start",
    alliance: "red",
    bounds: { x: 12, y: 84, width: 18, height: 18 },
    description: "Starting position optimal for High Basket Sample auto sequences.",
  },
  {
    id: "start_blue_observation",
    name: "Blue Start (Observation Side)",
    category: "start",
    alliance: "blue",
    bounds: { x: 114, y: 114, width: 18, height: 18 },
    description: "Starting position optimal for Specimen cycling & blue human player intake.",
  },
  {
    id: "start_blue_submersible",
    name: "Blue Start (Basket / Submersible Side)",
    category: "start",
    alliance: "blue",
    bounds: { x: 114, y: 42, width: 18, height: 18 },
    description: "Starting position optimal for Blue High Basket Sample auto sequences.",
  },
];

export const DEFENSE_PROFILES: Record<DefenseProfileId, DefenseProfile> = {
  none: {
    id: "none",
    name: "Zero Defense / Clean Run",
    description: "Uncontested lanes, full-speed cycling through submersible corridors.",
    teleopEfficiencyMultiplier: 1.0,
    cycleTimePenaltySeconds: 0,
    foulRisk: "low",
  },
  light_chokepoint: {
    id: "light_chokepoint",
    name: "Light Submersible Chokepoint Defense",
    description: "Opponents patrol submersible entry lanes, adding modest cycle delays.",
    teleopEfficiencyMultiplier: 0.85,
    cycleTimePenaltySeconds: 2.5,
    foulRisk: "low",
  },
  heavy_pin: {
    id: "heavy_pin",
    name: "Heavy Submersible Gate Pinning",
    description: "Aggressive perimeter screening, pinning near observation wall and submersible entrance.",
    teleopEfficiencyMultiplier: 0.65,
    cycleTimePenaltySeconds: 5.5,
    foulRisk: "medium",
  },
  specimen_wall: {
    id: "specimen_wall",
    name: "Specimen Wall Interference",
    description: "Opponent robot screens human player chamber handoffs and pushes during hang align.",
    teleopEfficiencyMultiplier: 0.72,
    cycleTimePenaltySeconds: 4.0,
    foulRisk: "medium",
  },
};

// Preset Strategy Routines for ARES 23247
export const PRESET_ROUTINES: StrategyRoutine[] = [
  {
    id: "routine_5_specimen_red",
    name: "5-Specimen Auto + L3 Ascent (Red)",
    description: "Preload hang on High Chamber, push 3 yellow/red samples to observation wall, hang 4 cycled specimens, park or Level 3 ascent.",
    alliance: "red",
    startingPosition: { x: 18, y: 24 },
    startingPositionName: "Red Observation Wall Start",
    steps: [
      {
        id: "step-1",
        phase: "auto",
        action: "auto_specimen_high",
        label: "Hang Preloaded Specimen",
        targetCoordinate: { x: 60, y: 84 },
        durationSeconds: 3.2,
        points: 32,
        riskFactor: "low",
        notes: "Fast spline to High Chamber Bar",
      },
      {
        id: "step-2",
        phase: "auto",
        action: "custom_waypoint",
        label: "Push Spike Samples to Wall",
        targetCoordinate: { x: 24, y: 24 },
        durationSeconds: 5.8,
        points: 0,
        riskFactor: "medium",
        notes: "Sweep 3 spike samples into Observation Zone",
      },
      {
        id: "step-3",
        phase: "auto",
        action: "auto_specimen_high",
        label: "Cycle Specimen 2 (High Chamber)",
        targetCoordinate: { x: 64, y: 84 },
        durationSeconds: 4.5,
        points: 32,
        riskFactor: "low",
        notes: "Pickup from wall, clip to high chamber",
      },
      {
        id: "step-4",
        phase: "auto",
        action: "auto_specimen_high",
        label: "Cycle Specimen 3 (High Chamber)",
        targetCoordinate: { x: 68, y: 84 },
        durationSeconds: 4.5,
        points: 32,
        riskFactor: "medium",
        notes: "Pickup from wall, clip to high chamber",
      },
      {
        id: "step-5",
        phase: "auto",
        action: "auto_specimen_high",
        label: "Cycle Specimen 4 (High Chamber)",
        targetCoordinate: { x: 72, y: 84 },
        durationSeconds: 4.5,
        points: 32,
        riskFactor: "medium",
        notes: "Pickup from wall, clip to high chamber",
      },
      {
        id: "step-6",
        phase: "auto",
        action: "auto_specimen_high",
        label: "Cycle Specimen 5 (High Chamber)",
        targetCoordinate: { x: 76, y: 84 },
        durationSeconds: 4.8,
        points: 32,
        riskFactor: "high",
        notes: "Buzzer beater 5th hang",
      },
      {
        id: "step-7",
        phase: "teleop",
        action: "teleop_specimen_high",
        label: "Teleop Specimen Cycle 1",
        targetCoordinate: { x: 64, y: 84 },
        durationSeconds: 8.0,
        points: 20,
        riskFactor: "low",
      },
      {
        id: "step-8",
        phase: "teleop",
        action: "teleop_specimen_high",
        label: "Teleop Specimen Cycle 2",
        targetCoordinate: { x: 68, y: 84 },
        durationSeconds: 8.0,
        points: 20,
        riskFactor: "low",
      },
      {
        id: "step-9",
        phase: "teleop",
        action: "teleop_specimen_high",
        label: "Teleop Specimen Cycle 3",
        targetCoordinate: { x: 72, y: 84 },
        durationSeconds: 8.0,
        points: 20,
        riskFactor: "low",
      },
      {
        id: "step-10",
        phase: "endgame",
        action: "endgame_ascent_level_3",
        label: "Submersible Level 3 Ascent",
        targetCoordinate: { x: 72, y: 72 },
        durationSeconds: 9.5,
        points: 30,
        riskFactor: "low",
        notes: "Hook middle rungs, elevate full extension",
      },
    ],
  },
  {
    id: "routine_4_sample_red",
    name: "4-Sample Basket Cycle (Red)",
    description: "Score preloaded yellow sample into High Basket, intake & score 3 submersible spike samples, park or Level 3 climb.",
    alliance: "red",
    startingPosition: { x: 18, y: 90 },
    startingPositionName: "Red Submersible Side Start",
    steps: [
      {
        id: "step-s1",
        phase: "auto",
        action: "auto_sample_high_basket",
        label: "Preload High Basket Deposit",
        targetCoordinate: { x: 16, y: 128 },
        durationSeconds: 3.5,
        points: 8,
        riskFactor: "low",
      },
      {
        id: "step-s2",
        phase: "auto",
        action: "auto_sample_high_basket",
        label: "Spike Sample 1 High Basket",
        targetCoordinate: { x: 16, y: 128 },
        durationSeconds: 5.5,
        points: 8,
        riskFactor: "low",
      },
      {
        id: "step-s3",
        phase: "auto",
        action: "auto_sample_high_basket",
        label: "Spike Sample 2 High Basket",
        targetCoordinate: { x: 16, y: 128 },
        durationSeconds: 5.5,
        points: 8,
        riskFactor: "medium",
      },
      {
        id: "step-s4",
        phase: "auto",
        action: "auto_sample_high_basket",
        label: "Spike Sample 3 High Basket",
        targetCoordinate: { x: 16, y: 128 },
        durationSeconds: 6.0,
        points: 8,
        riskFactor: "medium",
      },
      {
        id: "step-s5",
        phase: "auto",
        action: "auto_park_submersible",
        label: "Auto Park Submersible",
        targetCoordinate: { x: 72, y: 72 },
        durationSeconds: 4.0,
        points: 3,
        riskFactor: "low",
      },
      {
        id: "step-s6",
        phase: "teleop",
        action: "teleop_sample_high_basket",
        label: "Teleop Sample Cycle 1",
        targetCoordinate: { x: 16, y: 128 },
        durationSeconds: 7.5,
        points: 8,
        riskFactor: "low",
      },
      {
        id: "step-s7",
        phase: "teleop",
        action: "teleop_sample_high_basket",
        label: "Teleop Sample Cycle 2",
        targetCoordinate: { x: 16, y: 128 },
        durationSeconds: 7.5,
        points: 8,
        riskFactor: "low",
      },
      {
        id: "step-s8",
        phase: "endgame",
        action: "endgame_ascent_level_3",
        label: "Level 3 Ascent Hang",
        targetCoordinate: { x: 72, y: 72 },
        durationSeconds: 9.0,
        points: 30,
        riskFactor: "low",
      },
    ],
  },
  {
    id: "routine_5_specimen_blue",
    name: "5-Specimen Auto + L3 Ascent (Blue)",
    description: "Blue side mirror: Preload high hang, 3 sample sweep to observation wall, 4 cycled specimen hangs, Level 3 Ascent.",
    alliance: "blue",
    startingPosition: { x: 126, y: 120 },
    startingPositionName: "Blue Observation Wall Start",
    steps: [
      {
        id: "step-b1",
        phase: "auto",
        action: "auto_specimen_high",
        label: "Hang Preloaded Specimen",
        targetCoordinate: { x: 84, y: 60 },
        durationSeconds: 3.2,
        points: 32,
        riskFactor: "low",
      },
      {
        id: "step-b2",
        phase: "auto",
        action: "custom_waypoint",
        label: "Push Spike Samples to Wall",
        targetCoordinate: { x: 120, y: 120 },
        durationSeconds: 5.8,
        points: 0,
        riskFactor: "medium",
      },
      {
        id: "step-b3",
        phase: "auto",
        action: "auto_specimen_high",
        label: "Cycle Specimen 2 (High Chamber)",
        targetCoordinate: { x: 80, y: 60 },
        durationSeconds: 4.5,
        points: 32,
        riskFactor: "low",
      },
      {
        id: "step-b4",
        phase: "auto",
        action: "auto_specimen_high",
        label: "Cycle Specimen 3 (High Chamber)",
        targetCoordinate: { x: 76, y: 60 },
        durationSeconds: 4.5,
        points: 32,
        riskFactor: "medium",
      },
      {
        id: "step-b5",
        phase: "auto",
        action: "auto_specimen_high",
        label: "Cycle Specimen 4 (High Chamber)",
        targetCoordinate: { x: 72, y: 60 },
        durationSeconds: 4.5,
        points: 32,
        riskFactor: "medium",
      },
      {
        id: "step-b6",
        phase: "auto",
        action: "auto_specimen_high",
        label: "Cycle Specimen 5 (High Chamber)",
        targetCoordinate: { x: 68, y: 60 },
        durationSeconds: 4.8,
        points: 32,
        riskFactor: "high",
      },
      {
        id: "step-b7",
        phase: "teleop",
        action: "teleop_specimen_high",
        label: "Teleop Specimen Cycle 1",
        targetCoordinate: { x: 80, y: 60 },
        durationSeconds: 8.0,
        points: 20,
        riskFactor: "low",
      },
      {
        id: "step-b8",
        phase: "endgame",
        action: "endgame_ascent_level_3",
        label: "Submersible Level 3 Ascent",
        targetCoordinate: { x: 72, y: 72 },
        durationSeconds: 9.5,
        points: 30,
        riskFactor: "low",
      },
    ],
  },
];

/**
 * Score calculation helper for a single routine
 */
export function calculateRoutineScore(routine: StrategyRoutine): {
  autoScore: number;
  teleopScore: number;
  endgameScore: number;
  totalScore: number;
  autoDuration: number;
  teleopDuration: number;
  endgameDuration: number;
  totalDuration: number;
} {
  let autoScore = 0;
  let teleopScore = 0;
  let endgameScore = 0;
  let autoDuration = 0;
  let teleopDuration = 0;
  let endgameDuration = 0;

  for (const step of routine.steps) {
    if (step.phase === "auto") {
      autoScore += step.points;
      autoDuration += step.durationSeconds;
    } else if (step.phase === "teleop") {
      teleopScore += step.points;
      teleopDuration += step.durationSeconds;
    } else if (step.phase === "endgame") {
      endgameScore += step.points;
      endgameDuration += step.durationSeconds;
    }
  }

  return {
    autoScore,
    teleopScore,
    endgameScore,
    totalScore: autoScore + teleopScore + endgameScore,
    autoDuration: Math.round(autoDuration * 10) / 10,
    teleopDuration: Math.round(teleopDuration * 10) / 10,
    endgameDuration: Math.round(endgameDuration * 10) / 10,
    totalDuration: Math.round((autoDuration + teleopDuration + endgameDuration) * 10) / 10,
  };
}

/**
 * Calculates combined alliance synergy, projected score, and defense adjustments
 */
export function calculateSynergyScore(
  robot1Routine: StrategyRoutine,
  partnerConfig: AlliancePartnerConfig,
  defenseProfile: DefenseProfile
): AllianceSynergyResult {
  const r1Scores = calculateRoutineScore(robot1Routine);

  // Partner calculations
  const partnerAutoSpecimenPts = (partnerConfig.autoSpecimensHigh || 0) * 32;
  const partnerAutoSamplePts = (partnerConfig.autoSamplesHigh || 0) * 8;
  const partnerAutoParkPts =
    partnerConfig.autoPark === "observation" || partnerConfig.autoPark === "submersible" ? 3 : 0;
  const partnerAutoScore = partnerAutoSpecimenPts + partnerAutoSamplePts + partnerAutoParkPts;

  const partnerTeleopSpecimenPts = (partnerConfig.teleopSpecimensHigh || 0) * 20;
  const partnerTeleopSamplePts = (partnerConfig.teleopSamplesHigh || 0) * 8;
  const partnerTeleopScore = partnerTeleopSpecimenPts + partnerTeleopSamplePts;

  let partnerEndgameScore = 0;
  if (partnerConfig.endgameAscent === "level_1") partnerEndgameScore = 3;
  if (partnerConfig.endgameAscent === "level_2") partnerEndgameScore = 15;
  if (partnerConfig.endgameAscent === "level_3") partnerEndgameScore = 30;

  const reliability = Math.max(0.1, Math.min(1.0, partnerConfig.reliabilityFactor ?? 1.0));
  const r2RawScore = (partnerAutoScore + partnerTeleopScore + partnerEndgameScore) * reliability;

  const rawAllianceScore = r1Scores.totalScore + r2RawScore;

  // Apply defense impact to Teleop phase
  const combinedTeleopRaw = r1Scores.teleopScore + partnerTeleopScore * reliability;
  const defendedTeleop = combinedTeleopRaw * defenseProfile.teleopEfficiencyMultiplier;

  const autoAllianceScore = r1Scores.autoScore + partnerAutoScore * reliability;
  const endgameAllianceScore = r1Scores.endgameScore + partnerEndgameScore * reliability;
  const defenseAdjustedScore = Math.round(autoAllianceScore + defendedTeleop + endgameAllianceScore);

  // Analyze congestion & synergy
  const r1IsSpecimen = r1Scores.autoScore >= 60 || robot1Routine.name.toLowerCase().includes("specimen");
  const r2IsSpecimen = partnerConfig.preferredRole === "specimen_cycler" || partnerConfig.autoSpecimensHigh > 2;

  let submersibleCongestionRisk: "Low" | "Moderate" | "High" = "Low";
  let synergyRating: "Exceptional" | "Balanced" | "Congested" | "High Risk" = "Balanced";
  let strategicRecommendation = "Balanced division of labor across High Chamber and Basket scoring.";

  if (reliability < 0.75) {
    synergyRating = "High Risk";
    strategicRecommendation =
      "Partner reliability indicates potential cycle stalls. Designate Partner for lower risk Level 1 ascent or observation park.";
  } else if (r1IsSpecimen && r2IsSpecimen) {
    submersibleCongestionRisk = "Moderate";
    synergyRating = "Congested";
    strategicRecommendation =
      "Both robots focus on High Chamber Specimen hangs. Coordinate observation wall pickup order to prevent queue collisions.";
  } else if ((r1IsSpecimen && partnerConfig.preferredRole === "basket_cycler") || (!r1IsSpecimen && r2IsSpecimen)) {
    submersibleCongestionRisk = "Low";
    synergyRating = "Exceptional";
    strategicRecommendation =
      "Optimal role separation: One robot dominates High Chamber Specimen hangs while the partner cycles Basket Samples in the outer lane.";
  }

  return {
    robot1Score: r1Scores.totalScore,
    robot2Score: Math.round(r2RawScore),
    rawAllianceScore: Math.round(rawAllianceScore),
    defenseAdjustedScore,
    autoAllianceScore: Math.round(autoAllianceScore),
    teleopAllianceScore: Math.round(defendedTeleop),
    endgameAllianceScore: Math.round(endgameAllianceScore),
    synergyRating,
    strategicRecommendation,
    submersibleCongestionRisk,
  };
}

/**
 * Coordinate converter: transforms 144" inch coordinates to SVG viewport (0-100% or absolute viewBox)
 */
export function inchToSvgPercent(inches: number): number {
  return Math.max(0, Math.min(100, (inches / FIELD_SIZE_INCHES) * 100));
}
