/**
 * Badges API - Badge Management and Leaderboard
 *
 * Types imported from backend route definitions in @shared/routes/badges.ts
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { z } from "zod";
import { client, unwrapResponse } from "./honoClient";
import { badgeSchema, userBadgeSchema } from "@shared/routes/badges";

// Infer TypeScript types from Zod schemas
export type Badge = z.infer<typeof badgeSchema>;
export type UserBadge = z.infer<typeof userBadgeSchema>;

export interface BadgesResponse {
  badges: Badge[];
}

export interface BadgeLeaderboardResponse {
  leaderboard: Array<{
    user_id: string;
    nickname: string | null;
    member_type: string | null;
    badge_count: number;
  }>;
}

export interface UsersListResponse {
  users: Array<{
    id: string;
    name: string | null;
    nickname: string | null;
    email: string;
  }>;
}


// ============================================
// Public Badges
// ============================================

/**
 * GET /api/badges - List all badge definitions
 */
export function useGetBadges(
  options?: Omit<UseQueryOptions<BadgesResponse>, "queryKey" | "queryFn">
) {
  return useQuery<BadgesResponse>({
    queryKey: ["badges"],
    queryFn: async () => {
      const response = await client.badges.$get();
      return unwrapResponse<BadgesResponse>(response);
    },
    ...options,
  });
}

/**
 * GET /api/badges/leaderboard - Get badge leaderboard
 */
export function useGetBadgeLeaderboard(
  options?: Omit<UseQueryOptions<BadgeLeaderboardResponse>, "queryKey" | "queryFn">
) {
  return useQuery<BadgeLeaderboardResponse>({
    queryKey: ["badges", "leaderboard"],
    queryFn: async () => {
      const response = await client.badges.leaderboard.$get();
      return unwrapResponse<BadgeLeaderboardResponse>(response);
    },
    ...options,
  });
}

// ============================================
// Admin Badges
// ============================================

/**
 * POST /api/badges/admin - Create a new badge definition
 */
export function useCreateBadge(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, Omit<Badge, "created_at">>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, Omit<Badge, "created_at">>({
    mutationFn: async (data) => {
      const response = await client.badges.admin.$post({ json: data });
      return unwrapResponse<{ success: boolean }>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["badges"] });
    },
    ...options,
  });
}

/**
 * POST /api/badges/admin/grant - Grant a badge to a user
 */
export function useGrantBadge(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, { userId: string; badgeId: string }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, { userId: string; badgeId: string }>({
    mutationFn: async (data) => {
      const response = await client.badges.admin.grant.$post({ json: data });
      return unwrapResponse<{ success: boolean }>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["badges"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
    ...options,
  });
}

/**
 * DELETE /api/badges/admin/grant/:userId/:badgeId - Revoke a badge from a user
 */
export function useRevokeBadge(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, { userId: string; badgeId: string }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, { userId: string; badgeId: string }>({
    mutationFn: async ({ userId, badgeId }) => {
      const response = await client.badges.admin.grant[":userId"][":badgeId"].$delete({
        param: { userId, badgeId }
      });
      return unwrapResponse<{ success: boolean }>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["badges"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
    ...options,
  });
}

/**
 * DELETE /api/badges/admin/:id - Delete a badge definition
 */
export function useDeleteBadge(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, string>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (id) => {
      const response = await client.badges.admin[":id"].$delete({ param: { id } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["badges"] });
    },
    ...options,
  });
}

/**
 * GET /api/users - Get users list for badge assignment
 */
export function useGetUsersForBadges(
  options?: Omit<UseQueryOptions<UsersListResponse>, "queryKey" | "queryFn">
) {
  return useQuery<UsersListResponse>({
    queryKey: ["users", "list"],
    queryFn: async () => {
      const response = await client.users.$get();
      return unwrapResponse<UsersListResponse>(response);
    },
    ...options,
  });
}
