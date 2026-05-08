/**
 * Outreach API - Outreach Logs, Community Engagement
 *
 * Types imported from backend route definitions in @shared/routes/outreach.ts
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { z } from "zod";
import { client, unwrapResponse } from "./honoClient";
import { outreachSchema } from "@shared/routes/outreach";

// Infer TypeScript types from Zod schemas
export type Outreach = z.infer<typeof outreachSchema>;

export interface OutreachPayload extends Partial<Omit<Outreach, "id">> {
  id?: string;
}

export interface OutreachResponse {
  logs: Outreach[];
}


// ============================================
// Outreach
// ============================================

/**
 * GET /api/outreach/ - Get all public outreach logs
 */
export function useGetPublicOutreach(
  options?: Omit<UseQueryOptions<OutreachResponse>, "queryKey" | "queryFn">
) {
  return useQuery<OutreachResponse>({
    queryKey: ["public-outreach"],
    queryFn: async () => {
      const response = await client.outreach.$get();
      return unwrapResponse<OutreachResponse>(response);
    },
    ...options,
  });
}

/**
 * GET /api/outreach/admin/list - Get all outreach logs (admin)
 */
export function useGetAdminOutreach(
  options?: Omit<UseQueryOptions<OutreachResponse>, "queryKey" | "queryFn">
) {
  return useQuery<OutreachResponse>({
    queryKey: ["admin-outreach"],
    queryFn: async () => {
      const response = await client.outreach.admin.list.$get();
      return unwrapResponse<OutreachResponse>(response);
    },
    ...options,
  });
}

/**
 * POST /api/outreach/admin/save - Save/update outreach log
 */
export function useSaveOutreach(
  options?: Omit<UseMutationOptions<{ success: boolean; id?: string }, Error, OutreachPayload>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; id?: string }, Error, OutreachPayload>({
    mutationFn: async (payload) => {
      const response = await client.outreach.admin.save.$post({ json: payload });
      return unwrapResponse<{ success: boolean; id?: string }>(response);
    },
    ...options,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-outreach"] });
      queryClient.invalidateQueries({ queryKey: ["public-outreach"] });
      (options?.onSuccess as any)?.();
    }
  });
}

/**
 * DELETE /api/outreach/admin/:id - Delete outreach log
 */
export function useDeleteOutreach(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, string>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (id) => {
      const response = await client.outreach.admin[":id"].$delete({ param: { id } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...options,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-outreach"] });
      queryClient.invalidateQueries({ queryKey: ["public-outreach"] });
      (options?.onSuccess as any)?.();
    }
  });
}
