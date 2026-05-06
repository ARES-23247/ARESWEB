/**
 * Analytics API - Platform Analytics, Stats, Tracking
 *
 * Types imported from backend route definitions in @shared/routes/analytics.ts
 */

import { useQuery, useMutation, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { z } from "zod";
import { client, unwrapResponse } from "./honoClient";

// Re-export schemas for type inference
import {
  topPageSchema,
  recentViewSchema,
  totalSchema,
  rosterStatSchema,
  leaderboardEntrySchema,
  integrationsSchema,
  resourceUsageSchema,
  userActivitySchema,
  latencySchema,
  searchResultSchema,
} from "@shared/routes/analytics";

// Infer TypeScript types from Zod schemas
export type TopPage = z.infer<typeof topPageSchema>;
export type RecentView = z.infer<typeof recentViewSchema>;
export type TotalByCategory = z.infer<typeof totalSchema>;
export type RosterStat = z.infer<typeof rosterStatSchema>;
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;
export type Integrations = z.infer<typeof integrationsSchema>;
export type ResourceUsage = z.infer<typeof resourceUsageSchema>;
export type UserActivity = z.infer<typeof userActivitySchema>;
export type LatencyData = z.infer<typeof latencySchema>;
export type AnalyticsSearchResult = z.infer<typeof searchResultSchema>;

export interface StatsResponse {
  posts: number;
  events: number;
  docs: number;
  integrations: Integrations;
  securityBlocks?: number;
}

export interface AnalyticsLeaderboardResponse {
  leaderboard: LeaderboardEntry[];
}

export interface RosterStatsResponse {
  roster: RosterStat[];
}

export interface PlatformAnalyticsResponse {
  totalPageViews: number;
  uniqueVisitors: number;
  topPages: TopPage[];
  topReferrers: Array<{ referrer: string; visits: number }>;
  recentViews: RecentView[];
  totals: TotalByCategory[];
  userActivity: UserActivity[];
  latency?: LatencyData[];
  resourceUsage: ResourceUsage;
}

export interface SearchResponse {
  results: SearchResult[];
}


// ============================================
// Tracking
// ============================================

/**
 * POST /api/analytics/track - Track page view
 */
export function useTrackPageView(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, { path?: string; category?: string; referrer?: string }>, "mutationFn">
) {
  return useMutation<{ success: boolean }, Error, { path?: string; category?: string; referrer?: string }>({
    mutationFn: async (data) => {
      const response = await client.analytics.track.$post({ json: data });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...options,
  });
}

/**
 * POST /api/analytics/sponsor-click - Track sponsor click
 */
export function useTrackSponsorClick(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, { sponsor_id: string }>, "mutationFn">
) {
  return useMutation<{ success: boolean }, Error, { sponsor_id: string }>({
    mutationFn: async (data) => {
      const response = await client.analytics["sponsor-click"].$post({ json: data });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...options,
  });
}

// ============================================
// Analytics & Stats
// ============================================

/**
 * GET /api/analytics/leaderboard - Get badge leaderboard
 */
export function useGetLeaderboard(
  options?: Omit<UseQueryOptions<LeaderboardResponse>, "queryKey" | "queryFn">
) {
  return useQuery<LeaderboardResponse>({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const response = await client.analytics.leaderboard.$get();
      return unwrapResponse<LeaderboardResponse>(response);
    },
    ...options,
  });
}

/**
 * GET /api/analytics/admin/stats - Get platform stats
 */
export function useGetStats(
  options?: Omit<UseQueryOptions<StatsResponse>, "queryKey" | "queryFn">
) {
  return useQuery<StatsResponse>({
    queryKey: ["analytics", "stats"],
    queryFn: async () => {
      const response = await client.analytics.admin.stats.$get();
      return unwrapResponse<StatsResponse>(response);
    },
    ...options,
  });
}

/**
 * GET /api/analytics/admin/platform-analytics - Get comprehensive platform analytics
 */
export function useGetPlatformAnalytics(
  options?: Omit<UseQueryOptions<PlatformAnalyticsResponse>, "queryKey" | "queryFn">
) {
  return useQuery<PlatformAnalyticsResponse>({
    queryKey: ["analytics", "platform-analytics"],
    queryFn: async () => {
      const response = await client.analytics.admin["platform-analytics"].$get();
      return unwrapResponse<PlatformAnalyticsResponse>(response);
    },
    ...options,
  });
}

/**
 * GET /api/analytics/admin/roster-stats - Get member impact roster stats
 */
export function useGetRosterStats(
  options?: Omit<UseQueryOptions<RosterStatsResponse>, "queryKey" | "queryFn">
) {
  return useQuery<RosterStatsResponse>({
    queryKey: ["analytics", "roster-stats"],
    queryFn: async () => {
      const response = await client.analytics.admin["roster-stats"].$get();
      return unwrapResponse<RosterStatsResponse>(response);
    },
    ...options,
  });
}

/**
 * GET /api/analytics/search - Search the platform
 */
export function useSearch(
  query: string,
  options?: Omit<UseQueryOptions<SearchResponse>, "queryKey" | "queryFn" | "enabled">
) {
  return useQuery<SearchResponse>({
    queryKey: ["search", query],
    queryFn: async () => {
      const response = await client.analytics.search.$get({ query: { q: query } });
      return unwrapResponse<SearchResponse>(response);
    },
    enabled: !!query && query.length >= 2,
    ...options,
  });
}
