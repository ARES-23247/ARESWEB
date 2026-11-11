export type PicklistTier = "first_pick" | "second_pick" | "do_not_pick" | "unranked";

export interface TournamentPicklistEntry {
  teamNumber: string;
  tier: PicklistTier;
  notes?: string | null;
}

export interface TournamentOprEntry {
  teamNumber: string;
  teamName: string;
  opr: number;
  autoOpr?: number;
  teleopOpr?: number;
  endgameOpr?: number;
  rank?: number;
}

export interface Tournament {
  id: string;
  seasonName?: string | null;
  challengeName?: string | null;
  name: string;
  date: string; // ISO Date string (YYYY-MM-DD)
  location: string;
  locationId?: string | null;
  description?: string | null;
  status: "upcoming" | "past";
  opr?: number | null;
  oprList?: TournamentOprEntry[];
  ftcSeason?: number | null;
  ftcEventCode?: string | null;
  lastSyncedAt?: string | null;
  wins?: number | null;
  losses?: number | null;
  ties?: number | null;
  rank?: number | null;
  picklist?: TournamentPicklistEntry[];
  scoutingDetails?: {
    autoPathNotes?: string | null;
    driverFeedback?: string | null;
    robotSpecs?: string | null;
  };
  photoAlbumId?: string | null;
  isDeleted: number; // 0 or 1 for Soft Delete
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface TournamentMatch {
  id: string;
  tournamentId: string;
  matchNumber: string; // e.g. "QM1", "QM12", "SF1-1", "F1"
  alliance: "red" | "blue";
  partner: string; // Partner team number
  opponents: string[]; // Opponent team numbers
  scoreSelf?: number | null;
  scoreOpponent?: number | null;
  result: "won" | "lost" | "tie" | "upcoming";
  completed: boolean;
  isDeleted: number; // 0 or 1 for Soft Delete
  notes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface TournamentWriteInput {
  name: string;
  seasonName?: string;
  challengeName?: string;
  date: string;
  location: string;
  locationId?: string;
  description?: string;
  status: "upcoming" | "past";
  opr?: number;
  oprList?: TournamentOprEntry[];
  ftcSeason?: number | null;
  ftcEventCode?: string | null;
  wins?: number | null;
  losses?: number | null;
  ties?: number | null;
  rank?: number | null;
  picklist?: TournamentPicklistEntry[];
  scoutingDetails?: {
    autoPathNotes?: string;
    driverFeedback?: string;
    robotSpecs?: string;
  };
  photoAlbumId?: string;
}

export interface TournamentMatchWriteInput {
  matchNumber: string;
  alliance: "red" | "blue";
  partner: string;
  opponents: string[];
  scoreSelf?: number;
  scoreOpponent?: number;
  result: "won" | "lost" | "tie" | "upcoming";
  completed: boolean;
  notes?: string;
}

export interface TournamentMatchRevisionInput {
  expectedUpdatedAt: string | null;
}

export interface TournamentMatchUpdateInput
  extends
    Omit<Partial<TournamentMatchWriteInput>, "scoreSelf" | "scoreOpponent">,
    TournamentMatchRevisionInput {
  scoreSelf?: number | null;
  scoreOpponent?: number | null;
}

export interface PitScoutingEntry {
  id: string;
  tournamentId: string;
  teamNumber: string;
  teamName?: string | null;
  drivetrain: string;
  canClearBarrierOrTrench: boolean;
  preferredStartZone?: string | null;
  autoSummary?: string | null;
  teleopStrengths?: string | null;
  endgameCapability?: string | null;
  notes?: string | null;
  scoutNickname: string;
  updatedAt?: string | null;
}

export interface PitScoutingWriteInput {
  teamNumber: string;
  teamName?: string;
  drivetrain: string;
  canClearBarrierOrTrench: boolean;
  preferredStartZone?: string;
  autoSummary?: string;
  teleopStrengths?: string;
  endgameCapability?: string;
  notes?: string;
}

export type StandEndgameTier = "none" | "park" | "low" | "high";
export type StandPenaltyTier = "none" | "minor" | "major";

export interface StandScoutingEntry {
  id: string;
  tournamentId: string;
  matchNumber: string;
  teamNumber: string;
  alliance: "red" | "blue";
  autoScoreEstimate: number;
  teleopCycles: number;
  endgameTier: StandEndgameTier;
  disconnected: boolean;
  penalties: StandPenaltyTier;
  defenseRating: number;
  notes?: string | null;
  scoutNickname: string;
  createdAt?: string | null;
}

export interface StandScoutingWriteInput {
  clientSubmissionId?: string;
  matchNumber: string;
  teamNumber: string;
  alliance: "red" | "blue";
  autoScoreEstimate: number;
  teleopCycles: number;
  endgameTier: StandEndgameTier;
  disconnected: boolean;
  penalties: StandPenaltyTier;
  defenseRating: number;
  notes?: string;
}

export interface TeamScoutingSummary {
  teamNumber: string;
  matchesScouted: number;
  avgAutoScore: number;
  avgTeleopCycles: number;
  highEndgameRate: number;
  disconnectRate: number;
}

export interface TournamentScoutingBundle {
  pitScouting: PitScoutingEntry[];
  standScouting: StandScoutingEntry[];
  teamSummaries: TeamScoutingSummary[];
}

export type PitBatteryStatus = "charged" | "charging" | "cooldown" | "in_robot";

export interface PitBattery {
  id: string;
  label: string;
  voltage: number;
  status: PitBatteryStatus;
  cycles: number;
}

export interface PitTriageItem {
  id: string;
  severity: "blocker" | "warn";
  subsystem: string;
  summary: string;
  resolved: boolean;
}

export interface TournamentPitState {
  checklists: Record<string, string[]>;
  batteries: PitBattery[];
  triageItems: PitTriageItem[];
  updatedByNickname?: string | null;
  updatedAt?: string | null;
}

export interface TournamentsResponse {
  success: true;
  tournaments: Tournament[];
}

export interface TournamentResponse {
  success: true;
  tournament: Tournament;
}

export interface TournamentMatchesResponse {
  success: true;
  matches: TournamentMatch[];
}

export interface TournamentMatchResponse {
  success: true;
  match: TournamentMatch;
}
