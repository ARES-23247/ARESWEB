// â”€â”€ Scouting API Client â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Typed fetch wrappers for the scouting proxy endpoints.
// All requests go through /api/scouting which proxies to TOA/FTC Events
// with server-side API key injection.

const BASE = "/api/scouting";

// â”€â”€ TOA Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface TOATeam {
  team_key: string;
  region_key: string;
  league_key: string;
  team_number: number;
  team_name_short: string;
  team_name_long: string;
  robot_name: string;
  last_active: number;
  city: string;
  state_prov: string;
  zip_code: number;
  country: string;
  rookie_year: number;
  website: string;
}

export interface TOARanking {
  rank_key: string;
  event_key: string;
  team_key: string;
  rank: number;
  rank_change: number;
  opr: number;
  np_opr: number;
  wins: number;
  losses: number;
  ties: number;
  highest_qual_score: number;
  ranking_points: number;
  qualifying_points: number;
  tie_breaker_points: number;
  disqualified: number;
  played: number;
}

export interface TOAMatch {
  match_key: string;
  event_key: string;
  tournament_level: number;
  scheduled_time: string;
  match_name: string;
  play_number: number;
  field_number: number;
  red_score: number;
  blue_score: number;
  red_penalty: number;
  blue_penalty: number;
  red_auto_score: number;
  blue_auto_score: number;
  red_tele_score: number;
  blue_tele_score: number;
  red_end_score: number;
  blue_end_score: number;
  participants: TOAMatchParticipant[];
}

export interface TOAMatchParticipant {
  match_participant_key: string;
  match_key: string;
  team_key: string;
  station: number;
  station_status: number;
  ref_status: number;
}

export interface TOAEvent {
  event_key: string;
  season_key: string;
  region_key: string;
  league_key: string;
  event_code: string;
  event_type_key: string;
  eventName: string;
  start_date: string;
  end_date: string;
  city: string;
  state_prov: string;
  country: string;
  venue: string;
}

// â”€â”€ Analysis Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type AnalysisMode = "team_analysis" | "match_prediction" | "event_overview";

export interface AnalysisRequest {
  mode: AnalysisMode;
  teamNumber?: number;
  eventKey?: string;
  seasonKey: string;
  context: Record<string, unknown>;
}

export interface AnalysisResponse {
  markdown: string;
  model: string;
  tokensUsed?: number;
}

// â”€â”€ FTC Events Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface FTCEvent {
  eventId: number;
  code: string;
  divisionCode: string | null;
  name: string;
  remote: boolean;
  hybrid: boolean;
  fieldCount: number;
  published: boolean;
  type: string;
  typeName: string;
  regionCode: string;
  leagueCode: string | null;
  districtCode: string | null;
  venue: string;
  address: string;
  city: string;
  stateprov: string;
  country: string;
  website: string;
  liveStreamUrl: string | null;
  webcasts: string[];
  timezone: string;
  dateStart: string;
  dateEnd: string;
}

export interface FTCEventsResponse {
  events: FTCEvent[];
  eventCount: number;
}

// â”€â”€ Fetch Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Scouting API error ${res.status}: ${body}`);
  }
  return res.json();
}

// â”€â”€ API Methods â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const scoutingApi = {
  // â”€â”€ TOA Endpoints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  getTeam: async (teamNumber: number): Promise<TOATeam> => {
    const res = await fetchJSON<TOATeam | TOATeam[]>(`${BASE}/toa/team/${teamNumber}`);
    return Array.isArray(res) ? res[0] : res;
  },

  getTeamResults: (teamNumber: number, seasonKey: string) =>
    fetchJSON<unknown>(`${BASE}/toa/team/${teamNumber}/results/${seasonKey}`),

  getEventRankings: (eventKey: string) =>
    fetchJSON<TOARanking[]>(`${BASE}/toa/event/${eventKey}/rankings`),

  getEventMatches: (eventKey: string) =>
    fetchJSON<TOAMatch[]>(`${BASE}/toa/event/${eventKey}/matches`),

  getEventTeams: (eventKey: string) =>
    fetchJSON<TOATeam[]>(`${BASE}/toa/event/${eventKey}/teams`),

  getSeasonEvents: (seasonKey: string) =>
    fetchJSON<TOAEvent[]>(`${BASE}/toa/event?season_key=${seasonKey}`),

  // â”€â”€ FTC Events Endpoints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  getFTCSeasonEvents: (season: number) =>
    fetchJSON<FTCEventsResponse>(`${BASE}/ftcevents/${season}/events`),

  getFTCEventScores: (season: number, eventCode: string, level = "qual") =>
    fetchJSON<unknown>(`${BASE}/ftcevents/${season}/scores/${eventCode}/${level}`),

  getFTCEventRankings: (season: number, eventCode: string) =>
    fetchJSON<unknown>(`${BASE}/ftcevents/${season}/rankings/${eventCode}`),

  getFTCEventTeams: (season: number, eventCode: string) =>
    fetchJSON<unknown>(`${BASE}/ftcevents/${season}/teams?eventCode=${eventCode}`),

  // â”€â”€ AI Analysis â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  analyze: async (req: AnalysisRequest): Promise<AnalysisResponse> => {
    const res = await fetch(`${BASE}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Analysis API error ${res.status}: ${body}`);
    }
    return res.json();
  },

  getSavedAnalyses: async (filters: { teamNumber?: number; eventKey?: string }): Promise<(AnalysisResponse & { id: string; createdAt: string; mode: string })[]> => {
    const params = new URLSearchParams();
    if (filters.teamNumber) params.append("teamNumber", filters.teamNumber.toString());
    if (filters.eventKey) params.append("eventKey", filters.eventKey);
    
    return fetchJSON(`${BASE}/analyses?${params.toString()}`);
  },
};

