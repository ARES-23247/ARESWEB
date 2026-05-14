/**
 * TBA API - The Blue Alliance proxy endpoints
 *
 * Types imported from backend route definitions in @shared/routes/tba.ts
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { client, unwrapResponse } from "./honoClient";

export interface TBARanking {
  team_key: string;
  rank: number;
}

export interface TBAMatch {
  comp_level: string;
  match_number: number;
  alliances: {
    red: { team_keys: string[] };
    blue: { team_keys: string[] };
  };
}

export interface RankingsResponse {
  rankings: TBARanking[];
}

export interface MatchesResponse {
  matches: TBAMatch[];
}

// ============================================
// TBA Proxy Routes
// ============================================

/**
 * GET /api/tba/rankings/:eventKey - Get TBA rankings for an event
 */
export function useGetTBARankings(
  eventKey: string,
  options?: Omit<UseQueryOptions<RankingsResponse>, "queryKey" | "queryFn">
) {
  return useQuery<RankingsResponse>({
    queryKey: ["tba", "rankings", eventKey],
    queryFn: async () => {
      const season = eventKey.slice(0, 4);
      const eventCode = eventKey.slice(4).toUpperCase();
      const response = await client.tba["ftc-events"][":season"][":eventCode"][":type"].$get({ param: { season, eventCode, type: "rankings" } });
      return unwrapResponse<RankingsResponse>(response);
    },
    ...options,
  });
}

/**
 * GET /api/tba/matches/:eventKey - Get TBA matches for an event
 */
export function useGetTBAMatches(
  eventKey: string,
  options?: Omit<UseQueryOptions<MatchesResponse>, "queryKey" | "queryFn">
) {
  return useQuery<MatchesResponse>({
    queryKey: ["tba", "matches", eventKey],
    queryFn: async () => {
      const season = eventKey.slice(0, 4);
      const eventCode = eventKey.slice(4).toUpperCase();
      const response = await client.tba["ftc-events"][":season"][":eventCode"][":type"].$get({ param: { season, eventCode, type: "matches" } });
      return unwrapResponse<MatchesResponse>(response);
    },
    ...options,
  });
}
