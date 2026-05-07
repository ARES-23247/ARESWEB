/**
 * Profiles API - User Profiles, Team Roster
 *
 * Types imported from backend route definitions in @shared/routes/profiles.ts
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { z } from "zod";
import { client, unwrapResponse } from "./honoClient";
import { profileMeSchema, rosterMemberSchema, badgeSchema, MemberTypeEnum } from "@shared/routes/profiles";

// Infer TypeScript types from Zod schemas
export type ProfileMe = z.infer<typeof profileMeSchema>;
export type RosterMember = z.infer<typeof rosterMemberSchema>;
export type ProfileBadge = z.infer<typeof badgeSchema>;
export type ProfileMemberType = z.infer<typeof MemberTypeEnum>;

export interface TeamRosterResponse {
  members: RosterMember[];
}

export interface PublicProfileResponse {
  profile: Record<string, unknown>;
  badges: ProfileBadge[];
}


// ============================================
// Profiles
// ============================================

/**
 * GET /api/profiles/me - Get current user profile
 */
export function useGetMe(
  options?: Omit<UseQueryOptions<ProfileMe>, "queryKey" | "queryFn">
) {
  return useQuery<ProfileMe>({
    queryKey: ["profile", "me"],
    queryFn: async () => {
      const response = await client.profile.me.$get();
      return unwrapResponse<ProfileMe>(response);
    },
    ...options,
  });
}

/**
 * PUT /api/profiles/me - Update current user profile
 */
export function useUpdateMe(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, Record<string, unknown>>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, Record<string, unknown>>({
    mutationFn: async (data) => {
      const response = await client.profile.me.$put({ json: data });
      return unwrapResponse<{ success: boolean }>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", "me"] });
    },
    ...options,
  });
}

/**
 * PUT /api/profiles/avatar - Update avatar
 */
export function useUpdateAvatar(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, { image?: string | null }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, { image?: string | null }>({
    mutationFn: async (data) => {
      const response = await client.profile.avatar.$put({ json: data });
      return unwrapResponse<{ success: boolean }>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", "me"] });
    },
    ...options,
  });
}

/**
 * GET /api/profiles/team-roster - Get public team roster
 */
export function useGetTeamRoster(
  options?: Omit<UseQueryOptions<TeamRosterResponse>, "queryKey" | "queryFn">
) {
  return useQuery<TeamRosterResponse>({
    queryKey: ["profiles", "team-roster"],
    queryFn: async () => {
      const response = await client.profile["team-roster"].$get();
      return unwrapResponse<TeamRosterResponse>(response);
    },
    ...options,
  });
}

/**
 * GET /api/profiles/:userId - Get public user profile
 */
export function useGetPublicProfile(
  userId: string,
  options?: Omit<UseQueryOptions<PublicProfileResponse>, "queryKey" | "queryFn" | "enabled">
) {
  return useQuery<PublicProfileResponse>({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const response = await client.profile[":userId"].$get({ param: { userId } });
      return unwrapResponse<PublicProfileResponse>(response);
    },
    enabled: !!userId,
    ...options,
  });
}
