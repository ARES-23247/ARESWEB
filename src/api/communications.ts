/**
 * Communications API - Mass email and notification endpoints
 *
 * Types imported from backend route definitions in @shared/routes/communications.ts
 */

import { useQuery, useMutation, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { client, unwrapResponse } from "./honoClient";

export interface MassEmailStatsResponse {
  activeUsers: number;
}

export interface MassEmailSendResponse {
  success: boolean;
  message?: string;
  recipientCount?: number;
  error?: string;
}

export interface MassEmailRequest {
  subject: string;
  htmlContent: string;
}

// ============================================
// Mass Email
// ============================================

/**
 * POST /api/communications/admin/mass-email - Send mass email to all users
 */
export function useSendMassEmail(
  options?: Omit<UseMutationOptions<MassEmailSendResponse, Error, MassEmailRequest>, "mutationFn">
) {
  return useMutation<MassEmailSendResponse, Error, MassEmailRequest>({
    mutationFn: async (data) => {
      const response = await client.communications.admin["mass-email"].$post({ json: data });
      return unwrapResponse<MassEmailSendResponse>(response);
    },
    ...options,
  });
}

/**
 * GET /api/communications/admin/stats - Get count of active users for mass email preview
 */
export function useGetMassEmailStats(
  options?: Omit<UseQueryOptions<MassEmailStatsResponse>, "queryKey" | "queryFn">
) {
  return useQuery<MassEmailStatsResponse>({
    queryKey: ["communications", "admin", "stats"],
    queryFn: async () => {
      const response = await client.communications.admin.stats.$get();
      return unwrapResponse<MassEmailStatsResponse>(response);
    },
    ...options,
  });
}
