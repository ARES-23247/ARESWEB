/**
 * Points API - Points System, Leaderboard
 *
 * Types imported from backend route definitions in @shared/routes/points.ts
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { z } from "zod";
import { client, unwrapResponse } from "./honoClient";
import { PointsTransactionSchema, PointsBalanceSchema, PointsLeaderboardEntrySchema } from "@shared/routes/points";

// Infer TypeScript types from Zod schemas
export type PointsTransaction = z.infer<typeof PointsTransactionSchema>;
export type PointsBalance = z.infer<typeof PointsBalanceSchema>;
export type PointsLeaderboardEntry = z.infer<typeof PointsLeaderboardEntrySchema>;
export type LeaderboardUser = PointsLeaderboardEntry;

export interface PointsLeaderboardResponse {
  leaderboard: PointsLeaderboardEntry[];
}


// ============================================
// Points
// ============================================

/**
 * GET /api/points/balance/:user_id - Get user point balance
 */
export function useGetPointsBalance(
  userId: string,
  options?: Omit<UseQueryOptions<PointsBalance>, "queryKey" | "queryFn" | "enabled">
) {
  return useQuery<PointsBalance>({
    queryKey: ["points", "balance", userId],
    queryFn: async () => {
      const response = await client.points.balance[":user_id"].$get({ param: { user_id: userId } });
      return unwrapResponse<PointsBalance>(response);
    },
    enabled: !!userId,
    ...options,
  });
}

/**
 * GET /api/points/history/:user_id - Get user point history
 */
export function useGetPointsHistory(
  userId: string,
  options?: Omit<UseQueryOptions<PointsTransaction[]>, "queryKey" | "queryFn" | "enabled">
) {
  return useQuery<PointsTransaction[]>({
    queryKey: ["points", "history", userId],
    queryFn: async () => {
      const response = await client.points.history[":user_id"].$get({ param: { user_id: userId } });
      return unwrapResponse<PointsTransaction[]>(response);
    },
    enabled: !!userId,
    ...options,
  });
}

/**
 * POST /api/points/transaction - Award or deduct points (Admin)
 */
export function useAwardPoints(
  options?: Omit<UseMutationOptions<{ success: boolean; transaction_id: string }, Error, { user_id: string; points_delta: number; reason: string }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; transaction_id: string }, Error, { user_id: string; points_delta: number; reason: string }>({
    mutationFn: async (data) => {
      const response = await client.points.transaction.$post({ json: data });
      return unwrapResponse<{ success: boolean; transaction_id: string }>(response);
    },
    ...options,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["points", "balance", variables.user_id] });
      queryClient.invalidateQueries({ queryKey: ["points", "history", variables.user_id] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      options?.onSuccess?.(_data, variables);
    }
  });
}

/**
 * GET /api/points/leaderboard - Get global points leaderboard
 */
export function useGetPointsLeaderboard(
  options?: Omit<UseQueryOptions<PointsLeaderboardResponse>, "queryKey" | "queryFn">
) {
  return useQuery<PointsLeaderboardResponse>({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const response = await client.points.leaderboard.$get();
      return unwrapResponse<PointsLeaderboardResponse>(response);
    },
    ...options,
  });
}
