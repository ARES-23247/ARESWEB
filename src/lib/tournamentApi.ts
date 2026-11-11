import { authenticatedFetch } from "@/lib/api";
import type {
  PitScoutingEntry,
  PitScoutingWriteInput,
  StandScoutingEntry,
  StandScoutingWriteInput,
  Tournament,
  TournamentMatch,
  TournamentMatchesResponse,
  TournamentMatchResponse,
  TournamentMatchRevisionInput,
  TournamentMatchUpdateInput,
  TournamentMatchWriteInput,
  TournamentPicklistEntry,
  TournamentPitState,
  TournamentResponse,
  TournamentScoutingBundle,
  TournamentsResponse,
  TournamentWriteInput,
} from "@/types/tournament";

interface ErrorPayload {
  error?: unknown;
  code?: unknown;
}

export class TournamentApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly code?: string,
    message?: string,
  ) {
    super(message ?? `HTTP ${status}: ${statusText}`);
    this.name = "TournamentApiError";
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(path, init);
  if (!response.ok) {
    let payload: ErrorPayload = {};
    try {
      payload = (await response.json()) as ErrorPayload;
    } catch {
      // Status and statusText still provide an actionable diagnostic.
    }
    const serverMessage =
      typeof payload.error === "string" ? payload.error : undefined;
    const code = typeof payload.code === "string" ? payload.code : undefined;
    throw new TournamentApiError(
      response.status,
      response.statusText || "Request failed",
      code,
      `HTTP ${response.status}: ${response.statusText || "Request failed"}${serverMessage ? ` — ${serverMessage}` : ""}`,
    );
  }
  return (await response.json()) as T;
}

function jsonRequest(
  method: "POST" | "PUT" | "DELETE",
  body: unknown,
): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function tournamentPath(tournamentId: string, suffix = ""): string {
  return `/api/tournaments/${encodeURIComponent(tournamentId)}${suffix}`;
}

export async function fetchTournaments(limit = 50): Promise<Tournament[]> {
  const safeLimit = Math.min(100, Math.max(1, Math.trunc(limit)));
  const payload = await requestJson<TournamentsResponse>(
    `/api/tournaments?limit=${safeLimit}`,
  );
  return payload.tournaments;
}

export async function fetchTournament(
  tournamentId: string,
): Promise<Tournament> {
  const payload = await requestJson<TournamentResponse>(
    tournamentPath(tournamentId),
  );
  return payload.tournament;
}

export async function fetchTournamentMatches(
  tournamentId: string,
  limit = 250,
): Promise<TournamentMatch[]> {
  const safeLimit = Math.min(250, Math.max(1, Math.trunc(limit)));
  const payload = await requestJson<TournamentMatchesResponse>(
    tournamentPath(tournamentId, `/matches?limit=${safeLimit}`),
  );
  return payload.matches;
}

export async function createTournament(
  input: TournamentWriteInput,
): Promise<Tournament> {
  const payload = await requestJson<TournamentResponse>(
    "/api/tournaments",
    jsonRequest("POST", input),
  );
  return payload.tournament;
}

export async function updateTournament(
  tournamentId: string,
  input: Partial<TournamentWriteInput>,
): Promise<Tournament> {
  const payload = await requestJson<TournamentResponse>(
    tournamentPath(tournamentId),
    jsonRequest("PUT", input),
  );
  return payload.tournament;
}

export async function archiveTournament(tournamentId: string): Promise<void> {
  await requestJson<{ success: true }>(tournamentPath(tournamentId), {
    method: "DELETE",
  });
}

export async function createTournamentMatch(
  tournamentId: string,
  input: TournamentMatchWriteInput,
): Promise<TournamentMatch> {
  const payload = await requestJson<TournamentMatchResponse>(
    tournamentPath(tournamentId, "/matches"),
    jsonRequest("POST", input),
  );
  return payload.match;
}

export async function updateTournamentMatch(
  tournamentId: string,
  matchId: string,
  input: TournamentMatchUpdateInput,
): Promise<TournamentMatch> {
  const payload = await requestJson<TournamentMatchResponse>(
    tournamentPath(tournamentId, `/matches/${encodeURIComponent(matchId)}`),
    jsonRequest("PUT", input),
  );
  return payload.match;
}

export async function setTournamentMatchCompletion(
  tournamentId: string,
  matchId: string,
  completed: boolean,
  expectedUpdatedAt: string | null,
): Promise<TournamentMatch> {
  const payload = await requestJson<TournamentMatchResponse>(
    tournamentPath(
      tournamentId,
      `/matches/${encodeURIComponent(matchId)}/completion`,
    ),
    jsonRequest("PUT", { completed, expectedUpdatedAt }),
  );
  return payload.match;
}

export async function archiveTournamentMatch(
  tournamentId: string,
  matchId: string,
  expectedUpdatedAt: TournamentMatchRevisionInput["expectedUpdatedAt"],
): Promise<void> {
  await requestJson<{ success: true }>(
    tournamentPath(tournamentId, `/matches/${encodeURIComponent(matchId)}`),
    jsonRequest("DELETE", { expectedUpdatedAt }),
  );
}

export async function syncTournamentFtcScout(
  tournamentId: string,
  season: number,
  eventCode: string,
): Promise<{ tournament: Tournament; syncedMatches: number }> {
  const payload = await requestJson<{
    success: true;
    tournament: Tournament;
    syncedMatches: number;
  }>(
    tournamentPath(tournamentId, "/sync-ftcscout"),
    jsonRequest("POST", { season, eventCode }),
  );
  return { tournament: payload.tournament, syncedMatches: payload.syncedMatches };
}

export async function fetchTournamentScouting(
  tournamentId: string,
): Promise<TournamentScoutingBundle> {
  const payload = await requestJson<
    { success: true } & Partial<TournamentScoutingBundle>
  >(tournamentPath(tournamentId, "/scouting"));
  return {
    pitScouting: Array.isArray(payload.pitScouting) ? payload.pitScouting : [],
    standScouting: Array.isArray(payload.standScouting) ? payload.standScouting : [],
    teamSummaries: Array.isArray(payload.teamSummaries) ? payload.teamSummaries : [],
  };
}

function assertBrowserOnline(): void {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new TournamentApiError(
      0,
      "Offline",
      "OFFLINE",
      "Browser is offline",
    );
  }
}

export async function submitPitScouting(
  tournamentId: string,
  input: PitScoutingWriteInput,
): Promise<PitScoutingEntry> {
  assertBrowserOnline();
  const payload = await requestJson<{
    success: true;
    entry: PitScoutingEntry;
  }>(
    tournamentPath(tournamentId, "/scouting/pit"),
    jsonRequest("POST", input),
  );
  return payload.entry;
}

export async function submitStandScouting(
  tournamentId: string,
  input: StandScoutingWriteInput,
): Promise<{ entry: StandScoutingEntry; duplicate: boolean }> {
  assertBrowserOnline();
  const payload = await requestJson<{
    success: true;
    entry: StandScoutingEntry;
    duplicate: boolean;
  }>(
    tournamentPath(tournamentId, "/scouting/stand"),
    jsonRequest("POST", input),
  );
  return { entry: payload.entry, duplicate: payload.duplicate };
}

export async function saveTournamentPicklist(
  tournamentId: string,
  picklist: TournamentPicklistEntry[],
): Promise<TournamentPicklistEntry[]> {
  const payload = await requestJson<{
    success: true;
    picklist: TournamentPicklistEntry[];
  }>(
    tournamentPath(tournamentId, "/picklist"),
    jsonRequest("PUT", { picklist }),
  );
  return payload.picklist;
}

export async function fetchTournamentPitState(
  tournamentId: string,
): Promise<TournamentPitState> {
  const payload = await requestJson<{
    success: true;
    pitState?: TournamentPitState;
  }>(tournamentPath(tournamentId, "/pit-state"));
  return (
    payload.pitState ?? {
      checklists: {},
      batteries: [],
      triageItems: [],
    }
  );
}

export async function saveTournamentPitState(
  tournamentId: string,
  input: Pick<TournamentPitState, "checklists" | "batteries" | "triageItems">,
): Promise<TournamentPitState> {
  assertBrowserOnline();
  const payload = await requestJson<{
    success: true;
    pitState: TournamentPitState;
  }>(tournamentPath(tournamentId, "/pit-state"), jsonRequest("PUT", input));
  return payload.pitState;
}
