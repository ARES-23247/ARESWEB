/**
 * Seasons API - Competition Seasons, Robot Info
 *
 * Types imported from backend route definitions in @shared/routes/seasons.ts
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { z } from "zod";
import { client, unwrapResponse, withMutationCallbacks } from "./honoClient";
import { seasonSchema, saveSeasonSchema } from "@shared/routes/seasons";

// Infer TypeScript types from Zod schemas
export type Season = z.infer<typeof seasonSchema>;
export type SeasonPayload = z.infer<typeof saveSeasonSchema>;

export interface SeasonsResponse {
  seasons: Season[];
}

export interface SeasonDetailResponse {
  season: Season;
  awards: unknown[];
  events: unknown[];
  posts: unknown[];
  outreach: unknown[];
}

// ============================================
// Public Seasons
// ============================================

/**
 * GET /api/seasons - Get all published seasons
 */
export function useGetSeasons(
  options?: Omit<UseQueryOptions<SeasonsResponse>, "queryKey" | "queryFn">
) {
  return useQuery<SeasonsResponse>({
    queryKey: ["seasons"],
    queryFn: async () => {
      const response = await client.seasons.$get();
      return unwrapResponse<SeasonsResponse>(response);
    },
    ...options,
  });
}

/**
 * GET /api/seasons/:year - Get public season details
 */
export function useGetSeasonDetail(
  year: string,
  options?: Omit<UseQueryOptions<SeasonDetailResponse>, "queryKey" | "queryFn" | "enabled">
) {
  return useQuery<SeasonDetailResponse>({
    queryKey: ["season", year],
    queryFn: async () => {
      const response = await client.seasons[":year"].$get({ param: { year } });
      return unwrapResponse<SeasonDetailResponse>(response);
    },
    enabled: !!year,
    ...options,
  });
}

// ============================================
// Admin Seasons
// ============================================

/**
 * GET /api/seasons/admin/list - Get all seasons (admin)
 */
export function useGetAdminSeasons(
  options?: Omit<UseQueryOptions<SeasonsResponse>, "queryKey" | "queryFn">
) {
  return useQuery<SeasonsResponse>({
    queryKey: ["admin-seasons"],
    queryFn: async () => {
      const response = await client.seasons.admin.list.$get();
      return unwrapResponse<SeasonsResponse>(response);
    },
    ...options,
  });
}

/**
 * GET /api/seasons/admin/:id - Get season details (admin)
 */
export function useGetAdminSeasonDetail(
  id: string,
  options?: Omit<UseQueryOptions<{ season: Season }>, "queryKey" | "queryFn" | "enabled">
) {
  return useQuery<{ season: Season }>({
    queryKey: ["admin-season-detail", id],
    queryFn: async () => {
      const response = await client.seasons.admin[":id"].$get({ param: { id } });
      return unwrapResponse<{ season: Season }>(response);
    },
    enabled: !!id,
    ...options,
  });
}

/**
 * POST /api/seasons/admin/save - Save/create season
 */
export function useSaveSeason(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, SeasonPayload>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, SeasonPayload>({
    mutationFn: async (data) => {
      const response = await client.seasons.admin.save.$post({ json: data });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["seasons"] });
        qc.invalidateQueries({ queryKey: ["admin-seasons"] });
      }
    })
  });
}

/**
 * DELETE /api/seasons/admin/:id - Soft delete season
 */
export function useDeleteSeason(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, string>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (id) => {
      const response = await client.seasons.admin[":id"].$delete({ param: { id } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["seasons"] });
        qc.invalidateQueries({ queryKey: ["admin-seasons"] });
      }
    })
  });
}

/**
 * POST /api/seasons/admin/:id/undelete - Restore season
 */
export function useUndeleteSeason(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, string>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (id) => {
      const response = await client.seasons.admin[":id"].undelete.$post({ param: { id } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["seasons"] });
        qc.invalidateQueries({ queryKey: ["admin-seasons"] });
      }
    })
  });
}

/**
 * DELETE /api/seasons/admin/:id/purge - Permanently delete season
 */
export function usePurgeSeason(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, string>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (id) => {
      const response = await client.seasons.admin[":id"].purge.$delete({ param: { id } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["seasons"] });
        qc.invalidateQueries({ queryKey: ["admin-seasons"] });
      }
    })
  });
}
