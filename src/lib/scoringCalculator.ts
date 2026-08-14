export type AutoParkState = "none" | "observation" | "submersible";
export type EndgameAscentState = "none" | "level1" | "level2" | "level3";

export interface AllianceScores {
  // Autonomous scoring
  autoNetZoneSamples: number;
  autoLowBasketSamples: number;
  autoHighBasketSamples: number;
  autoLowChamberSpecimens: number;
  autoHighChamberSpecimens: number;
  autoRobot1Park: AutoParkState;
  autoRobot2Park: AutoParkState;

  // TeleOp scoring
  teleopNetZoneSamples: number;
  teleopLowBasketSamples: number;
  teleopHighBasketSamples: number;
  teleopLowChamberSpecimens: number;
  teleopHighChamberSpecimens: number;

  // Endgame scoring
  endgameRobot1Ascent: EndgameAscentState;
  endgameRobot2Ascent: EndgameAscentState;

  // Penalties awarded to this alliance (from opponent violations)
  minorPenalties: number;
  majorPenalties: number;
}

export interface ScoreCategoryBreakdown {
  autoSamples: number;
  autoSpecimens: number;
  autoPark: number;
  autoTotal: number;

  teleopSamples: number;
  teleopSpecimens: number;
  teleopTotal: number;

  endgameRobot1: number;
  endgameRobot2: number;
  endgameTotal: number;

  penaltiesMinor: number;
  penaltiesMajor: number;
  penaltiesTotal: number;

  totalScore: number;

  // Statistical counters
  totalSamples: number;
  totalSpecimens: number;
  highValueCycles: number; // high basket + high chamber
}

export interface MatchComparison {
  red: ScoreCategoryBreakdown;
  blue: ScoreCategoryBreakdown;
  differential: number; // absolute score difference
  pointSpread: number; // redTotal - blueTotal
  leader: "red" | "blue" | "tie";
  redSharePercentage: number;
  blueSharePercentage: number;
}

export const SCORING_VALUES = {
  AUTO_NET_ZONE: 2,
  AUTO_LOW_BASKET: 4,
  AUTO_HIGH_BASKET: 8,
  AUTO_LOW_CHAMBER: 6,
  AUTO_HIGH_CHAMBER: 10,
  AUTO_PARK_OBSERVATION: 3,
  AUTO_PARK_SUBMERSIBLE: 3,
  AUTO_PARK_NONE: 0,

  TELEOP_NET_ZONE: 2,
  TELEOP_LOW_BASKET: 4,
  TELEOP_HIGH_BASKET: 8,
  TELEOP_LOW_CHAMBER: 6,
  TELEOP_HIGH_CHAMBER: 10,

  ENDGAME_ASCENT_NONE: 0,
  ENDGAME_ASCENT_LEVEL_1: 3,
  ENDGAME_ASCENT_LEVEL_2: 15,
  ENDGAME_ASCENT_LEVEL_3: 30,

  PENALTY_MINOR: 5,
  PENALTY_MAJOR: 15,
} as const;

export const MAX_FIELD_LIMITS = {
  AUTO_SAMPLES: 15,
  AUTO_SPECIMENS: 10,
  TELEOP_SAMPLES: 40,
  TELEOP_SPECIMENS: 25,
  PENALTIES_MINOR: 20,
  PENALTIES_MAJOR: 10,
} as const;

export function createInitialAllianceScores(): AllianceScores {
  return {
    autoNetZoneSamples: 0,
    autoLowBasketSamples: 0,
    autoHighBasketSamples: 0,
    autoLowChamberSpecimens: 0,
    autoHighChamberSpecimens: 0,
    autoRobot1Park: "none",
    autoRobot2Park: "none",

    teleopNetZoneSamples: 0,
    teleopLowBasketSamples: 0,
    teleopHighBasketSamples: 0,
    teleopLowChamberSpecimens: 0,
    teleopHighChamberSpecimens: 0,

    endgameRobot1Ascent: "none",
    endgameRobot2Ascent: "none",

    minorPenalties: 0,
    majorPenalties: 0,
  };
}

export function clampValue(value: number, min = 0, max = 99): number {
  if (Number.isNaN(value) || !Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

export function getAutoParkScore(park: AutoParkState): number {
  switch (park) {
    case "observation":
      return SCORING_VALUES.AUTO_PARK_OBSERVATION;
    case "submersible":
      return SCORING_VALUES.AUTO_PARK_SUBMERSIBLE;
    case "none":
    default:
      return SCORING_VALUES.AUTO_PARK_NONE;
  }
}

export function getEndgameAscentScore(ascent: EndgameAscentState): number {
  switch (ascent) {
    case "level1":
      return SCORING_VALUES.ENDGAME_ASCENT_LEVEL_1;
    case "level2":
      return SCORING_VALUES.ENDGAME_ASCENT_LEVEL_2;
    case "level3":
      return SCORING_VALUES.ENDGAME_ASCENT_LEVEL_3;
    case "none":
    default:
      return SCORING_VALUES.ENDGAME_ASCENT_NONE;
  }
}

export function calculateAllianceBreakdown(scores: AllianceScores): ScoreCategoryBreakdown {
  const autoSamples =
    clampValue(scores.autoNetZoneSamples) * SCORING_VALUES.AUTO_NET_ZONE +
    clampValue(scores.autoLowBasketSamples) * SCORING_VALUES.AUTO_LOW_BASKET +
    clampValue(scores.autoHighBasketSamples) * SCORING_VALUES.AUTO_HIGH_BASKET;

  const autoSpecimens =
    clampValue(scores.autoLowChamberSpecimens) * SCORING_VALUES.AUTO_LOW_CHAMBER +
    clampValue(scores.autoHighChamberSpecimens) * SCORING_VALUES.AUTO_HIGH_CHAMBER;

  const autoPark = getAutoParkScore(scores.autoRobot1Park) + getAutoParkScore(scores.autoRobot2Park);
  const autoTotal = autoSamples + autoSpecimens + autoPark;

  const teleopSamples =
    clampValue(scores.teleopNetZoneSamples) * SCORING_VALUES.TELEOP_NET_ZONE +
    clampValue(scores.teleopLowBasketSamples) * SCORING_VALUES.TELEOP_LOW_BASKET +
    clampValue(scores.teleopHighBasketSamples) * SCORING_VALUES.TELEOP_HIGH_BASKET;

  const teleopSpecimens =
    clampValue(scores.teleopLowChamberSpecimens) * SCORING_VALUES.TELEOP_LOW_CHAMBER +
    clampValue(scores.teleopHighChamberSpecimens) * SCORING_VALUES.TELEOP_HIGH_CHAMBER;

  const teleopTotal = teleopSamples + teleopSpecimens;

  const endgameRobot1 = getEndgameAscentScore(scores.endgameRobot1Ascent);
  const endgameRobot2 = getEndgameAscentScore(scores.endgameRobot2Ascent);
  const endgameTotal = endgameRobot1 + endgameRobot2;

  const penaltiesMinor = clampValue(scores.minorPenalties) * SCORING_VALUES.PENALTY_MINOR;
  const penaltiesMajor = clampValue(scores.majorPenalties) * SCORING_VALUES.PENALTY_MAJOR;
  const penaltiesTotal = penaltiesMinor + penaltiesMajor;

  const totalScore = autoTotal + teleopTotal + endgameTotal + penaltiesTotal;

  const totalSamples =
    clampValue(scores.autoNetZoneSamples) +
    clampValue(scores.autoLowBasketSamples) +
    clampValue(scores.autoHighBasketSamples) +
    clampValue(scores.teleopNetZoneSamples) +
    clampValue(scores.teleopLowBasketSamples) +
    clampValue(scores.teleopHighBasketSamples);

  const totalSpecimens =
    clampValue(scores.autoLowChamberSpecimens) +
    clampValue(scores.autoHighChamberSpecimens) +
    clampValue(scores.teleopLowChamberSpecimens) +
    clampValue(scores.teleopHighChamberSpecimens);

  const highValueCycles =
    clampValue(scores.autoHighBasketSamples) +
    clampValue(scores.autoHighChamberSpecimens) +
    clampValue(scores.teleopHighBasketSamples) +
    clampValue(scores.teleopHighChamberSpecimens);

  return {
    autoSamples,
    autoSpecimens,
    autoPark,
    autoTotal,
    teleopSamples,
    teleopSpecimens,
    teleopTotal,
    endgameRobot1,
    endgameRobot2,
    endgameTotal,
    penaltiesMinor,
    penaltiesMajor,
    penaltiesTotal,
    totalScore,
    totalSamples,
    totalSpecimens,
    highValueCycles,
  };
}

export function calculateMatchComparison(
  redScores: AllianceScores,
  blueScores: AllianceScores,
): MatchComparison {
  const red = calculateAllianceBreakdown(redScores);
  const blue = calculateAllianceBreakdown(blueScores);

  const pointSpread = red.totalScore - blue.totalScore;
  const differential = Math.abs(pointSpread);

  let leader: "red" | "blue" | "tie" = "tie";
  if (pointSpread > 0) leader = "red";
  else if (pointSpread < 0) leader = "blue";

  const totalPointsEarned = red.totalScore + blue.totalScore;
  let redSharePercentage = 50;
  let blueSharePercentage = 50;

  if (totalPointsEarned > 0) {
    redSharePercentage = Math.round((red.totalScore / totalPointsEarned) * 100);
    blueSharePercentage = 100 - redSharePercentage;
  }

  return {
    red,
    blue,
    differential,
    pointSpread,
    leader,
    redSharePercentage,
    blueSharePercentage,
  };
}

export interface PresetStrategy {
  id: string;
  name: string;
  badge: string;
  description: string;
  scores: AllianceScores;
}

export const STRATEGY_PRESETS: PresetStrategy[] = [
  {
    id: "rookie-baseline",
    name: "Rookie Baseline",
    badge: "Foundation",
    description: "Reliable autonomous parking, low basket cycling, observation park, and Level 1 ascents.",
    scores: {
      autoNetZoneSamples: 0,
      autoLowBasketSamples: 1,
      autoHighBasketSamples: 0,
      autoLowChamberSpecimens: 0,
      autoHighChamberSpecimens: 0,
      autoRobot1Park: "observation",
      autoRobot2Park: "observation",

      teleopNetZoneSamples: 1,
      teleopLowBasketSamples: 5,
      teleopHighBasketSamples: 0,
      teleopLowChamberSpecimens: 2,
      teleopHighChamberSpecimens: 0,

      endgameRobot1Ascent: "level1",
      endgameRobot2Ascent: "level1",

      minorPenalties: 0,
      majorPenalties: 0,
    },
  },
  {
    id: "qualifier-contender",
    name: "Qualifier Contender",
    badge: "Qualifier",
    description: "Autonomous specimen clip and high basket sample with fast teleop high basket cycling and Level 2 ascent.",
    scores: {
      autoNetZoneSamples: 0,
      autoLowBasketSamples: 0,
      autoHighBasketSamples: 2,
      autoLowChamberSpecimens: 0,
      autoHighChamberSpecimens: 1,
      autoRobot1Park: "submersible",
      autoRobot2Park: "observation",

      teleopNetZoneSamples: 0,
      teleopLowBasketSamples: 0,
      teleopHighBasketSamples: 6,
      teleopLowChamberSpecimens: 0,
      teleopHighChamberSpecimens: 3,

      endgameRobot1Ascent: "level2",
      endgameRobot2Ascent: "level1",

      minorPenalties: 0,
      majorPenalties: 0,
    },
  },
  {
    id: "state-championship",
    name: "State Championship",
    badge: "Playoffs",
    description: "High chamber 3-specimen auto, 9+ high basket teleop cycles, and dual high-tier endgame hang.",
    scores: {
      autoNetZoneSamples: 0,
      autoLowBasketSamples: 0,
      autoHighBasketSamples: 3,
      autoLowChamberSpecimens: 0,
      autoHighChamberSpecimens: 2,
      autoRobot1Park: "submersible",
      autoRobot2Park: "submersible",

      teleopNetZoneSamples: 0,
      teleopLowBasketSamples: 0,
      teleopHighBasketSamples: 9,
      teleopLowChamberSpecimens: 0,
      teleopHighChamberSpecimens: 5,

      endgameRobot1Ascent: "level3",
      endgameRobot2Ascent: "level2",

      minorPenalties: 0,
      majorPenalties: 0,
    },
  },
  {
    id: "world-class-ceiling",
    name: "World-Class Max Cycle",
    badge: "Worlds",
    description: "Flawless multi-sample auto preloads, maximum submersible chamber clipping, and dual Level 3 ascent.",
    scores: {
      autoNetZoneSamples: 0,
      autoLowBasketSamples: 0,
      autoHighBasketSamples: 4,
      autoLowChamberSpecimens: 0,
      autoHighChamberSpecimens: 3,
      autoRobot1Park: "submersible",
      autoRobot2Park: "submersible",

      teleopNetZoneSamples: 0,
      teleopLowBasketSamples: 0,
      teleopHighBasketSamples: 12,
      teleopLowChamberSpecimens: 0,
      teleopHighChamberSpecimens: 7,

      endgameRobot1Ascent: "level3",
      endgameRobot2Ascent: "level3",

      minorPenalties: 0,
      majorPenalties: 0,
    },
  },
];

export function formatMatchClipboardSummary(options: {
  redScores: AllianceScores;
  blueScores?: AllianceScores;
  mode?: "dual" | "single";
  activeAlliance?: "red" | "blue";
  matchTag?: string;
}): string {
  const isDual = options.mode !== "single";
  const redBreakdown = calculateAllianceBreakdown(options.redScores);
  const blueBreakdown = options.blueScores ? calculateAllianceBreakdown(options.blueScores) : null;
  const timestamp = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  const tag = options.matchTag?.trim() ? ` [${options.matchTag.trim()}]` : "";

  let output = `=================================================\n`;
  output += `ARES 23247 FTC MATCH SCORING SUMMARY${tag}\n`;
  output += `Game: INTO THE DEEP (2024-2025 Season)\n`;
  output += `Generated: ${timestamp}\n`;
  output += `=================================================\n\n`;

  if (!isDual || !blueBreakdown) {
    const allianceName = options.activeAlliance === "blue" ? "BLUE ALLIANCE" : "RED ALLIANCE";
    output += `### ${allianceName} PROJECTION: ${redBreakdown.totalScore} PTS\n\n`;
    output += `* Autonomous Period: ${redBreakdown.autoTotal} pts\n`;
    output += `  - Samples (Net: ${options.redScores.autoNetZoneSamples}, Low: ${options.redScores.autoLowBasketSamples}, High: ${options.redScores.autoHighBasketSamples}): ${redBreakdown.autoSamples} pts\n`;
    output += `  - Specimens (Low: ${options.redScores.autoLowChamberSpecimens}, High: ${options.redScores.autoHighChamberSpecimens}): ${redBreakdown.autoSpecimens} pts\n`;
    output += `  - Parking (R1: ${options.redScores.autoRobot1Park}, R2: ${options.redScores.autoRobot2Park}): ${redBreakdown.autoPark} pts\n\n`;
    output += `* TeleOp Period: ${redBreakdown.teleopTotal} pts\n`;
    output += `  - Samples (Net: ${options.redScores.teleopNetZoneSamples}, Low: ${options.redScores.teleopLowBasketSamples}, High: ${options.redScores.teleopHighBasketSamples}): ${redBreakdown.teleopSamples} pts\n`;
    output += `  - Specimens (Low: ${options.redScores.teleopLowChamberSpecimens}, High: ${options.redScores.teleopHighChamberSpecimens}): ${redBreakdown.teleopSpecimens} pts\n\n`;
    output += `* Endgame Ascent: ${redBreakdown.endgameTotal} pts\n`;
    output += `  - Robot 1 (${options.redScores.endgameRobot1Ascent}): ${redBreakdown.endgameRobot1} pts\n`;
    output += `  - Robot 2 (${options.redScores.endgameRobot2Ascent}): ${redBreakdown.endgameRobot2} pts\n\n`;
    output += `* Penalty Points Awarded: ${redBreakdown.penaltiesTotal} pts\n`;
    output += `  - Minor (${options.redScores.minorPenalties}): ${redBreakdown.penaltiesMinor} pts | Major (${options.redScores.majorPenalties}): ${redBreakdown.penaltiesMajor} pts\n\n`;
    output += `* Efficiency & Metrics:\n`;
    output += `  - Total Elements Scored: ${redBreakdown.totalSamples + redBreakdown.totalSpecimens} (${redBreakdown.totalSamples} Samples, ${redBreakdown.totalSpecimens} Specimens)\n`;
    output += `  - High-Value Cycles (High Basket/Chamber): ${redBreakdown.highValueCycles}\n`;
  } else {
    const comparison = calculateMatchComparison(options.redScores, options.blueScores!);
    const leadText =
      comparison.leader === "tie"
        ? "MATCH TIED (0 pt spread)"
        : comparison.leader === "red"
          ? `RED ALLIANCE LEADS (+${comparison.differential} pts)`
          : `BLUE ALLIANCE LEADS (+${comparison.differential} pts)`;

    output += `FINAL SCORE PROJECTION:\n`;
    output += `RED ALLIANCE: ${redBreakdown.totalScore} PTS  vs  BLUE ALLIANCE: ${blueBreakdown.totalScore} PTS\n`;
    output += `Result: ${leadText}\n\n`;

    output += `-------------------------------------------------\n`;
    output += `PHASE COMPARISON (RED vs BLUE)\n`;
    output += `-------------------------------------------------\n`;
    output += `Autonomous: ${redBreakdown.autoTotal} pts  vs  ${blueBreakdown.autoTotal} pts\n`;
    output += `TeleOp:     ${redBreakdown.teleopTotal} pts  vs  ${blueBreakdown.teleopTotal} pts\n`;
    output += `Endgame:    ${redBreakdown.endgameTotal} pts  vs  ${blueBreakdown.endgameTotal} pts\n`;
    output += `Penalties:  ${redBreakdown.penaltiesTotal} pts  vs  ${blueBreakdown.penaltiesTotal} pts\n\n`;

    output += `-------------------------------------------------\n`;
    output += `CYCLE TOTALS & STATS\n`;
    output += `-------------------------------------------------\n`;
    output += `Red Samples/Specimens:  ${redBreakdown.totalSamples} samples / ${redBreakdown.totalSpecimens} specimens (${redBreakdown.highValueCycles} high value)\n`;
    output += `Blue Samples/Specimens: ${blueBreakdown.totalSamples} samples / ${blueBreakdown.totalSpecimens} specimens (${blueBreakdown.highValueCycles} high value)\n`;
    output += `Red Endgame Ascents:    R1: ${options.redScores.endgameRobot1Ascent}, R2: ${options.redScores.endgameRobot2Ascent} (${redBreakdown.endgameTotal} pts)\n`;
    output += `Blue Endgame Ascents:   R1: ${options.blueScores!.endgameRobot1Ascent}, R2: ${options.blueScores!.endgameRobot2Ascent} (${blueBreakdown.endgameTotal} pts)\n`;
  }

  output += `\n-- Calculated via ARES 23247 Team Portal (https://aresfirst.org/calculator) --\n`;
  return output;
}
