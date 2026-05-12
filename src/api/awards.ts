/**
 * Awards API - Team Awards and Recognition
 *
 * Types imported from backend route definitions in @shared/routes/awards.ts
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { z } from "zod";
import { client, unwrapResponse, withMutationCallbacks } from "./honoClient";
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
  eventName?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  seasonId?: number | null;
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
      const response = await client.awards.$get({ query: query || {} });
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
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["awards"] });
      }
    })
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
    onMutate: async (id) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ["awards"] });

      // Snapshot the previous value
      const previousAwards = queryClient.getQueryData<{ awards: Award[] }>(["awards"]);

      // Optimistically update to the new value
      if (previousAwards) {
        queryClient.setQueryData(["awards"], {
          ...previousAwards,
          awards: previousAwards.awards.filter((a) => String(a.id) !== String(id)),
        });
      }

      // Return a context object with the snapshotted value
      return { previousAwards };
    },
    onError: (err, id, context: any) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousAwards) {
        queryClient.setQueryData(["awards"], context.previousAwards);
      }
      toastApiError(err, "Delete failed");
    },
    onSettled: () => {
      // Always refetch after error or success to keep server and client in sync
      queryClient.invalidateQueries({ queryKey: ["awards"] });
    },
    ...options
  });
}

