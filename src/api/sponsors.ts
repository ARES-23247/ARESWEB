/**
 * Sponsors API - Sponsors, ROI Dashboard, Tokens
 *
 * Types imported from backend route definitions in @shared/routes/sponsors.ts
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { z } from "zod";
import { client, unwrapResponse } from "./honoClient";
import { sponsorResponseSchema, sponsorRoiMetricSchema, sponsorTokenSchema } from "@shared/routes/sponsors";
import { sponsorSchema } from "@shared/schemas/sponsorSchema";

// Infer TypeScript types from Zod schemas
export type Sponsor = z.infer<typeof sponsorResponseSchema>;
export type SponsorRoiMetric = z.infer<typeof sponsorRoiMetricSchema>;
export type SponsorToken = z.infer<typeof sponsorTokenSchema>;
export type SponsorPayload = z.input<typeof sponsorSchema>;

export interface SponsorsResponse {
  sponsors: Sponsor[];
}

export interface SponsorRoiResponse {
  sponsor?: Sponsor;
  metrics: SponsorRoiMetric[];
}

export interface SponsorTokensResponse {
  tokens: SponsorToken[];
}


// ============================================
// Public Sponsors
// ============================================

/**
 * GET /api/sponsors - Get all public sponsors
 */
export function useGetSponsors(
  options?: Omit<UseQueryOptions<SponsorsResponse>, "queryKey" | "queryFn">
) {
  return useQuery<SponsorsResponse>({
    queryKey: ["sponsors"],
    queryFn: async () => {
      const response = await client.sponsors.$get();
      return unwrapResponse<SponsorsResponse>(response);
    },
    ...options,
  });
}

/**
 * GET /api/sponsors/roi/:token - Get sponsor ROI dashboard
 */
export function useGetSponsorRoi(
  tokenId: string,
  options?: Omit<UseQueryOptions<SponsorRoiResponse>, "queryKey" | "queryFn" | "enabled">
) {
  return useQuery<SponsorRoiResponse>({
    queryKey: ["sponsors", "roi", tokenId],
    queryFn: async () => {
      const response = await client.sponsors.roi[":token"].$get({ param: { token: tokenId } });
      return unwrapResponse<SponsorRoiResponse>(response);
    },
    enabled: !!tokenId,
    ...options,
  });
}

// ============================================
// Admin Sponsors
// ============================================

/**
 * GET /api/sponsors/admin/list - List all sponsors (Admin)
 */
export function useGetAdminSponsors(
  options?: Omit<UseQueryOptions<SponsorsResponse>, "queryKey" | "queryFn">
) {
  return useQuery<SponsorsResponse>({
    queryKey: ["admin_sponsors"],
    queryFn: async () => {
      const response = await client.sponsors.admin.list.$get();
      return unwrapResponse<SponsorsResponse>(response);
    },
    ...options,
  });
}

/**
 * POST /api/sponsors/admin/save - Save/create sponsor
 */
export function useSaveSponsor(
  options?: Omit<UseMutationOptions<{ success: boolean; id: string }, Error, SponsorPayload>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; id: string }, Error, SponsorPayload>({
    mutationFn: async (data) => {
      const response = await client.sponsors.admin.save.$post({ json: data });
      return unwrapResponse<{ success: boolean; id: string }>(response);
    },
    ...options,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sponsors"] });
      queryClient.invalidateQueries({ queryKey: ["admin_sponsors"] });
      (options?.onSuccess as any)?.();
    }
  });
}

/**
 * DELETE /api/sponsors/admin/:id - Delete sponsor
 */
export function useDeleteSponsor(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, string>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (id) => {
      const response = await client.sponsors.admin[":id"].$delete({ param: { id } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...options,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sponsors"] });
      queryClient.invalidateQueries({ queryKey: ["admin_sponsors"] });
      (options?.onSuccess as any)?.();
    }
  });
}

/**
 * GET /api/sponsors/admin/tokens - Get admin tokens
 */
export function useGetAdminTokens(
  options?: Omit<UseQueryOptions<SponsorTokensResponse>, "queryKey" | "queryFn">
) {
  return useQuery<SponsorTokensResponse>({
    queryKey: ["sponsor_tokens"],
    queryFn: async () => {
      const response = await client.sponsors.admin.tokens.$get();
      return unwrapResponse<SponsorTokensResponse>(response);
    },
    ...options,
  });
}

/**
 * POST /api/sponsors/admin/tokens/generate - Generate sponsor token
 */
export function useGenerateSponsorToken(
  options?: Omit<UseMutationOptions<{ success: boolean; token?: string }, Error, { sponsor_id: string }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; token?: string }, Error, { sponsor_id: string }>({
    mutationFn: async (data) => {
      const response = await client.sponsors.admin.tokens.generate.$post({ json: data });
      return unwrapResponse<{ success: boolean; token?: string }>(response);
    },
    ...options,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sponsor_tokens"] });
      (options?.onSuccess as any)?.();
    }
  });
}
