/**
 * Awards API - Team Awards and Recognition
 *
 * Types imported from backend route definitions in @shared/routes/awards.ts
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { z } from "zod";
import { client, unwrapResponse } from "./honoClient";
import { awardSchema } from "@shared/routes/awards";

// Infer TypeScript types from Zod schemas
export type Award = z.infer<typeof awardSchema>;

export interface AwardsResponse {
  awards: Award[];
}

export interface AwardPayload {
  id?: string;
  title: string;
  year: number;
  event_name?: string | null;
  description?: string | null;
  image_url?: string | null;
  season_id?: number | null;
}

// ============================================
// Awards
// ============================================

/**
 * GET /api/awards - Get all awards
 */
export function useGetAwards(
  query?: { limit?: number; offset?: number },
  options?: Omit<UseQueryOptions<AwardsResponse>, "queryKey" | "queryFn">
) {
  return useQuery<AwardsResponse>({
    queryKey: ["awards", query],
    queryFn: async () => {
      const response = await client.awards.$get({ query });
      return unwrapResponse<AwardsResponse>(response);
    },
    ...options,
  });
}

/**
 * POST /api/awards/admin/save - Create or update an award
 */
export function useSaveAward(
  options?: Omit<UseMutationOptions<{ success: boolean; id?: string }, Error, AwardPayload>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; id?: string }, Error, AwardPayload>({
    mutationFn: async (data) => {
      const response = await client.awards.admin.save.$post({ json: data });
      return unwrapResponse<{ success: boolean; id?: string }>(response);
    },
    ...options,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["awards"] });
      options?.onSuccess?.();
    }
  });
}

/**
 * DELETE /api/awards/admin/:id - Soft-delete an award
 */
export function useDeleteAward(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, string>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (id) => {
      const response = await client.awards.admin[":id"].$delete({ param: { id } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...options,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["awards"] });
      options?.onSuccess?.();
    }
  });
}
