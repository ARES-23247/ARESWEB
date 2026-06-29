export interface Tournament {
  id: string;
  name: string;
  date: string; // ISO Date string (YYYY-MM-DD)
  location: string;
  locationId?: string;
  description?: string;
  status: "upcoming" | "past";
  opr?: number;
  oprList?: {
    teamNumber: string;
    teamName: string;
    opr: number;
  }[];
  scoutingDetails?: {
    autoPathNotes?: string;
    driverFeedback?: string;
    robotSpecs?: string;
  };
  photoAlbumId?: string;
  isDeleted: number; // 0 or 1 for Soft Delete
  createdAt?: string;
  updatedAt?: string;
}

export interface TournamentMatch {
  id: string;
  tournamentId: string;
  matchNumber: string; // e.g. "QM1", "QM12", "SF1-1", "F1"
  alliance: "red" | "blue";
  partner: string; // Partner team number
  opponents: string[]; // Opponent team numbers
  scoreSelf?: number;
  scoreOpponent?: number;
  result: "won" | "lost" | "tie" | "upcoming";
  completed: boolean;
  isDeleted: number; // 0 or 1 for Soft Delete
  notes?: string;
}
