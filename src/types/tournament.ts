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
  oprList?: {
    teamNumber: string;
    teamName: string;
    opr: number;
  }[];
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
  oprList?: NonNullable<Tournament["oprList"]>;
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
