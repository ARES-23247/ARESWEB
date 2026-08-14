/**
 * ARES 23247 - Tournament Match Scouting Data Models & Scoring Utilities
 * Cycle 37: Interactive Match Scouting & Offline Synchronization
 */

export type ParkingZone = "none" | "observation_zone" | "submersible";
export type AscentLevel = "none" | "level_1" | "level_2" | "level_3";
export type AllianceColor = "red" | "blue";

export interface ScoutingPhaseAuto {
  specimenHigh: number;
  specimenLow: number;
  sampleSubmerged: number;
  parkingZone: ParkingZone;
}

export interface ScoutingPhaseTeleOp {
  highBasket: number;
  lowBasket: number;
  specimenTransfer: number;
  driverAgility: number; // 1 - 5 scale
}

export interface ScoutingPhaseEndgame {
  ascentLevel: AscentLevel;
  minorPenalty: boolean;
  majorPenalty: boolean;
  minorPenaltyCount?: number;
  majorPenaltyCount?: number;
}

export interface MatchScoutingEntry {
  id: string;
  tournamentId: string;
  tournamentName: string;
  matchNumber: string;
  teamNumber: string;
  teamName: string;
  alliance: AllianceColor;
  scoutName: string;
  auto: ScoutingPhaseAuto;
  teleop: ScoutingPhaseTeleOp;
  endgame: ScoutingPhaseEndgame;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScoutingScoreBreakdown {
  autoPoints: number;
  teleopPoints: number;
  endgamePoints: number;
  penaltyDeduction: number;
  totalPoints: number;
  netScore: number;
  matchRating: number;
  autoBreakdown: {
    specimenHighPoints: number;
    specimenLowPoints: number;
    sampleSubmergedPoints: number;
    parkingPoints: number;
  };
  teleopBreakdown: {
    highBasketPoints: number;
    lowBasketPoints: number;
    specimenTransferPoints: number;
  };
  endgameBreakdown: {
    ascentPoints: number;
    penaltyPoints: number;
  };
}

export interface ScoutingValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export const SCOUTING_POINT_VALUES = {
  auto: {
    specimenHigh: 10,
    specimenLow: 6,
    sampleSubmerged: 4,
    parking: {
      none: 0,
      observation_zone: 3,
      submersible: 3,
    } as Record<ParkingZone, number>,
  },
  teleop: {
    highBasket: 8,
    lowBasket: 4,
    specimenTransfer: 6,
  },
  endgame: {
    ascent: {
      none: 0,
      level_1: 3,
      level_2: 15,
      level_3: 30,
    } as Record<AscentLevel, number>,
    penalty: {
      minor: 5,
      major: 15,
    },
  },
} as const;

export const SCOUTING_DRAFT_KEY = "ares_match_scouting_draft_v1";
export const SCOUTING_HISTORY_KEY = "ares_match_scouting_history_v1";

export function createDefaultScoutingEntry(overrides?: Partial<MatchScoutingEntry>): MatchScoutingEntry {
  const timestamp = new Date().toISOString();
  return {
    id: overrides?.id || (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `scout-${Date.now()}`),
    tournamentId: overrides?.tournamentId || "",
    tournamentName: overrides?.tournamentName || "",
    matchNumber: overrides?.matchNumber || "QM1",
    teamNumber: overrides?.teamNumber || "",
    teamName: overrides?.teamName || "",
    alliance: overrides?.alliance || "red",
    scoutName: overrides?.scoutName || "",
    auto: {
      specimenHigh: 0,
      specimenLow: 0,
      sampleSubmerged: 0,
      parkingZone: "none",
      ...overrides?.auto,
    },
    teleop: {
      highBasket: 0,
      lowBasket: 0,
      specimenTransfer: 0,
      driverAgility: 3,
      ...overrides?.teleop,
    },
    endgame: {
      ascentLevel: "none",
      minorPenalty: false,
      majorPenalty: false,
      minorPenaltyCount: 0,
      majorPenaltyCount: 0,
      ...overrides?.endgame,
    },
    notes: overrides?.notes || "",
    createdAt: overrides?.createdAt || timestamp,
    updatedAt: overrides?.updatedAt || timestamp,
  };
}

export function calculateAutoScore(auto: ScoutingPhaseAuto): number {
  const specimenHighPoints = Math.max(0, auto.specimenHigh || 0) * SCOUTING_POINT_VALUES.auto.specimenHigh;
  const specimenLowPoints = Math.max(0, auto.specimenLow || 0) * SCOUTING_POINT_VALUES.auto.specimenLow;
  const sampleSubmergedPoints = Math.max(0, auto.sampleSubmerged || 0) * SCOUTING_POINT_VALUES.auto.sampleSubmerged;
  const parkingPoints = SCOUTING_POINT_VALUES.auto.parking[auto.parkingZone] || 0;
  return specimenHighPoints + specimenLowPoints + sampleSubmergedPoints + parkingPoints;
}

export function calculateTeleopScore(teleop: ScoutingPhaseTeleOp): number {
  const highBasketPoints = Math.max(0, teleop.highBasket || 0) * SCOUTING_POINT_VALUES.teleop.highBasket;
  const lowBasketPoints = Math.max(0, teleop.lowBasket || 0) * SCOUTING_POINT_VALUES.teleop.lowBasket;
  const specimenTransferPoints = Math.max(0, teleop.specimenTransfer || 0) * SCOUTING_POINT_VALUES.teleop.specimenTransfer;
  return highBasketPoints + lowBasketPoints + specimenTransferPoints;
}

export function calculateEndgameScore(endgame: ScoutingPhaseEndgame): number {
  return SCOUTING_POINT_VALUES.endgame.ascent[endgame.ascentLevel] || 0;
}

export function calculatePenaltyDeductions(endgame: ScoutingPhaseEndgame): number {
  let penalty = 0;
  if (endgame.minorPenalty) {
    const count = Math.max(1, endgame.minorPenaltyCount || 1);
    penalty += count * SCOUTING_POINT_VALUES.endgame.penalty.minor;
  }
  if (endgame.majorPenalty) {
    const count = Math.max(1, endgame.majorPenaltyCount || 1);
    penalty += count * SCOUTING_POINT_VALUES.endgame.penalty.major;
  }
  return penalty;
}

export function calculateTotalScore(data: {
  auto: ScoutingPhaseAuto;
  teleop: ScoutingPhaseTeleOp;
  endgame: ScoutingPhaseEndgame;
}): number {
  return calculateAutoScore(data.auto) + calculateTeleopScore(data.teleop) + calculateEndgameScore(data.endgame);
}

export function calculateMatchRating(data: {
  auto: ScoutingPhaseAuto;
  teleop: ScoutingPhaseTeleOp;
  endgame: ScoutingPhaseEndgame;
}): number {
  const totalScore = calculateTotalScore(data);
  const penalty = calculatePenaltyDeductions(data.endgame);
  const netScore = Math.max(0, totalScore - penalty);
  const agility = Math.max(1, Math.min(5, data.teleop.driverAgility || 3));
  const agilityBonus = (agility - 3) * 4;
  const compositeRating = Math.max(0, netScore + agilityBonus);
  return Math.round(compositeRating * 10) / 10;
}

export function calculateScoringBreakdown(data: {
  auto: ScoutingPhaseAuto;
  teleop: ScoutingPhaseTeleOp;
  endgame: ScoutingPhaseEndgame;
}): ScoutingScoreBreakdown {
  const autoHigh = Math.max(0, data.auto.specimenHigh || 0) * SCOUTING_POINT_VALUES.auto.specimenHigh;
  const autoLow = Math.max(0, data.auto.specimenLow || 0) * SCOUTING_POINT_VALUES.auto.specimenLow;
  const autoSubmerged = Math.max(0, data.auto.sampleSubmerged || 0) * SCOUTING_POINT_VALUES.auto.sampleSubmerged;
  const autoPark = SCOUTING_POINT_VALUES.auto.parking[data.auto.parkingZone] || 0;
  const autoPoints = autoHigh + autoLow + autoSubmerged + autoPark;

  const teleopHigh = Math.max(0, data.teleop.highBasket || 0) * SCOUTING_POINT_VALUES.teleop.highBasket;
  const teleopLow = Math.max(0, data.teleop.lowBasket || 0) * SCOUTING_POINT_VALUES.teleop.lowBasket;
  const teleopTransfer = Math.max(0, data.teleop.specimenTransfer || 0) * SCOUTING_POINT_VALUES.teleop.specimenTransfer;
  const teleopPoints = teleopHigh + teleopLow + teleopTransfer;

  const ascentPoints = SCOUTING_POINT_VALUES.endgame.ascent[data.endgame.ascentLevel] || 0;
  const penaltyDeduction = calculatePenaltyDeductions(data.endgame);
  const totalPoints = autoPoints + teleopPoints + ascentPoints;
  const netScore = Math.max(0, totalPoints - penaltyDeduction);
  const matchRating = calculateMatchRating(data);

  return {
    autoPoints,
    teleopPoints,
    endgamePoints: ascentPoints,
    penaltyDeduction,
    totalPoints,
    netScore,
    matchRating,
    autoBreakdown: {
      specimenHighPoints: autoHigh,
      specimenLowPoints: autoLow,
      sampleSubmergedPoints: autoSubmerged,
      parkingPoints: autoPark,
    },
    teleopBreakdown: {
      highBasketPoints: teleopHigh,
      lowBasketPoints: teleopLow,
      specimenTransferPoints: teleopTransfer,
    },
    endgameBreakdown: {
      ascentPoints,
      penaltyPoints: penaltyDeduction,
    },
  };
}

export function validateScoutingEntry(entry: Partial<MatchScoutingEntry>): ScoutingValidationResult {
  const errors: Record<string, string> = {};

  if (!entry.tournamentId || !entry.tournamentId.trim()) {
    errors.tournamentId = "Tournament selection is required.";
  }

  if (!entry.matchNumber || !entry.matchNumber.trim()) {
    errors.matchNumber = "Match number is required (e.g., QM1, SF1).";
  }

  if (!entry.teamNumber || !entry.teamNumber.trim()) {
    errors.teamNumber = "Team number is required.";
  } else if (!/^\d+$/.test(entry.teamNumber.trim())) {
    errors.teamNumber = "Team number must contain digits only.";
  }

  if (!entry.alliance || (entry.alliance !== "red" && entry.alliance !== "blue")) {
    errors.alliance = "Alliance color must be either Red or Blue.";
  }

  if (entry.auto) {
    if (entry.auto.specimenHigh < 0 || isNaN(entry.auto.specimenHigh)) {
      errors["auto.specimenHigh"] = "Auto high specimen count cannot be negative.";
    }
    if (entry.auto.specimenLow < 0 || isNaN(entry.auto.specimenLow)) {
      errors["auto.specimenLow"] = "Auto low specimen count cannot be negative.";
    }
    if (entry.auto.sampleSubmerged < 0 || isNaN(entry.auto.sampleSubmerged)) {
      errors["auto.sampleSubmerged"] = "Auto submersible sample count cannot be negative.";
    }
  }

  if (entry.teleop) {
    if (entry.teleop.highBasket < 0 || isNaN(entry.teleop.highBasket)) {
      errors["teleop.highBasket"] = "TeleOp high basket count cannot be negative.";
    }
    if (entry.teleop.lowBasket < 0 || isNaN(entry.teleop.lowBasket)) {
      errors["teleop.lowBasket"] = "TeleOp low basket count cannot be negative.";
    }
    if (entry.teleop.specimenTransfer < 0 || isNaN(entry.teleop.specimenTransfer)) {
      errors["teleop.specimenTransfer"] = "TeleOp specimen transfer count cannot be negative.";
    }
    if (entry.teleop.driverAgility < 1 || entry.teleop.driverAgility > 5) {
      errors["teleop.driverAgility"] = "Driver agility rating must be between 1 and 5.";
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function saveScoutingDraft(draft: Partial<MatchScoutingEntry>): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const payload = {
      ...draft,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(SCOUTING_DRAFT_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn("Failed to save scouting draft to localStorage", err);
  }
}

export function loadScoutingDraft(): Partial<MatchScoutingEntry> | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(SCOUTING_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<MatchScoutingEntry>;
  } catch (err) {
    console.warn("Failed to parse scouting draft from localStorage", err);
    return null;
  }
}

export function clearScoutingDraft(): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.removeItem(SCOUTING_DRAFT_KEY);
  } catch (err) {
    console.warn("Failed to clear scouting draft from localStorage", err);
  }
}

export function loadScoutingHistory(): MatchScoutingEntry[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(SCOUTING_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("Failed to load scouting history from localStorage", err);
    return [];
  }
}

export function saveScoutingRecord(record: MatchScoutingEntry): MatchScoutingEntry[] {
  if (typeof window === "undefined" || !window.localStorage) return [record];
  try {
    const current = loadScoutingHistory();
    const existingIndex = current.findIndex((item) => item.id === record.id);
    let updated: MatchScoutingEntry[];
    if (existingIndex >= 0) {
      updated = [...current];
      updated[existingIndex] = { ...record, updatedAt: new Date().toISOString() };
    } else {
      updated = [record, ...current];
    }
    window.localStorage.setItem(SCOUTING_HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn("Failed to save scouting record to history in localStorage", err);
    return [];
  }
}

export function deleteScoutingRecord(id: string): MatchScoutingEntry[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const current = loadScoutingHistory();
    const updated = current.filter((item) => item.id !== id);
    window.localStorage.setItem(SCOUTING_HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn("Failed to delete scouting record from localStorage", err);
    return [];
  }
}

export function clearScoutingHistory(): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.removeItem(SCOUTING_HISTORY_KEY);
  } catch (err) {
    console.warn("Failed to clear scouting history from localStorage", err);
  }
}

function sanitizeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  // Protect against CSV formula injection
  const safeStr = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${safeStr.replace(/"/g, '""')}"`;
}

export function exportScoutingToCsv(records: MatchScoutingEntry[]): string {
  const headers = [
    "Match",
    "Tournament ID",
    "Tournament Name",
    "Team Number",
    "Team Name",
    "Alliance",
    "Scout Name",
    "Auto High Specimen",
    "Auto Low Specimen",
    "Auto Submerged Samples",
    "Auto Parking Zone",
    "Auto Score",
    "TeleOp High Basket",
    "TeleOp Low Basket",
    "TeleOp Specimen Transfer",
    "TeleOp Score",
    "Driver Agility (1-5)",
    "Endgame Ascent",
    "Endgame Score",
    "Minor Penalty",
    "Major Penalty",
    "Penalty Deductions",
    "Total Score",
    "Net Score",
    "Match Rating",
    "Notes",
    "Recorded At",
  ];

  const rows = records.map((r) => {
    const breakdown = calculateScoringBreakdown(r);
    return [
      sanitizeCsvCell(r.matchNumber),
      sanitizeCsvCell(r.tournamentId),
      sanitizeCsvCell(r.tournamentName),
      sanitizeCsvCell(r.teamNumber),
      sanitizeCsvCell(r.teamName),
      sanitizeCsvCell(r.alliance),
      sanitizeCsvCell(r.scoutName),
      sanitizeCsvCell(r.auto.specimenHigh),
      sanitizeCsvCell(r.auto.specimenLow),
      sanitizeCsvCell(r.auto.sampleSubmerged),
      sanitizeCsvCell(r.auto.parkingZone),
      sanitizeCsvCell(breakdown.autoPoints),
      sanitizeCsvCell(r.teleop.highBasket),
      sanitizeCsvCell(r.teleop.lowBasket),
      sanitizeCsvCell(r.teleop.specimenTransfer),
      sanitizeCsvCell(breakdown.teleopPoints),
      sanitizeCsvCell(r.teleop.driverAgility),
      sanitizeCsvCell(r.endgame.ascentLevel),
      sanitizeCsvCell(breakdown.endgamePoints),
      sanitizeCsvCell(r.endgame.minorPenalty ? "Yes" : "No"),
      sanitizeCsvCell(r.endgame.majorPenalty ? "Yes" : "No"),
      sanitizeCsvCell(breakdown.penaltyDeduction),
      sanitizeCsvCell(breakdown.totalPoints),
      sanitizeCsvCell(breakdown.netScore),
      sanitizeCsvCell(breakdown.matchRating),
      sanitizeCsvCell(r.notes),
      sanitizeCsvCell(r.createdAt),
    ].join(",");
  });

  // Include UTF-8 BOM for Excel compatibility
  return "\uFEFF" + [headers.map((h) => `"${h}"`).join(","), ...rows].join("\r\n");
}

export function exportScoutingToJson(records: MatchScoutingEntry[]): string {
  const enriched = records.map((record) => ({
    ...record,
    scoringBreakdown: calculateScoringBreakdown(record),
  }));
  return JSON.stringify(enriched, null, 2);
}
