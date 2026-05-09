/**
 * Users API - User Management
 *
 * Types imported from backend route definitions in @shared/routes/users.ts
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { z } from "zod";
import { client, unwrapResponse } from "./honoClient";
import { userResponseSchema, UserRoleEnum, MemberTypeEnum } from "@shared/routes/users";

// Infer TypeScript types from Zod schemas
export type User = z.infer<typeof userResponseSchema>;
export type UserRole = z.infer<typeof UserRoleEnum>;
export type UserMemberType = z.infer<typeof MemberTypeEnum>;

export interface UsersListResponse {
  users: User[];
  nextCursor?: string | null;
}

export interface UserResponse {
  user: User;
}


// ============================================
// Users (Admin)
// ============================================

/**
 * GET /api/users/admin/list - List all users (admin only)
 */
export function useGetUsers(
  query?: { limit?: number; cursor?: string },
  options?: Omit<UseQueryOptions<UsersListResponse>, "queryKey" | "queryFn">
) {
  return useQuery<UsersListResponse>({
    queryKey: ["users", "admin", "list", query],
    queryFn: async function getUsersList() {
      const response = await client.users.admin.list.$get({ query });
      return unwrapResponse<UsersListResponse>(response);
    },
    ...options,
  });
}

/**
 * GET /api/users/admin/:id - Get single user detail
 */
export function useGetUser(
  id: string,
  options?: Omit<UseQueryOptions<UserResponse>, "queryKey" | "queryFn" | "enabled">
) {
  return useQuery<UserResponse>({
    queryKey: ["users", "admin", id],
    queryFn: async () => {
      const response = await client.users.admin[":id"].$get({ param: { id } });
      return unwrapResponse<UserResponse>(response);
    },
    enabled: !!id,
    ...options,
  });
}

/**
 * PATCH /api/users/admin/:id - Update user role or type
 */
export function usePatchUser(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, { id: string; role?: UserRole; member_type?: UserMemberType }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, { id: string; role?: UserRole; member_type?: UserMemberType }>({
    mutationFn: async function patchUser({ id, ...data }) {
      const response = await client.users.admin[":id"].$patch({ param: { id }, json: data });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...options,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    }
  });
}

/**
 * GET /api/users/admin/:id/profile - Get full user profile
 */
export function useGetUserProfile(
  id: string,
  options?: Omit<UseQueryOptions<{ profile: Record<string, unknown> }>, "queryKey" | "queryFn" | "enabled">
) {
  return useQuery<{ profile: Record<string, unknown> }>({
    queryKey: ["users", "admin", id, "profile"],
    queryFn: async () => {
      const response = await client.users.admin[":id"].profile.$get({ param: { id } });
      return unwrapResponse<{ profile: Record<string, unknown> }>(response);
    },
    enabled: !!id,
    ...options,
  });
}

/**
 * PUT /api/users/admin/:id/profile - Update user profile
 */
export function useUpdateUserProfile(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, { id: string; profile: Record<string, unknown> }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, { id: string; profile: Record<string, unknown> }>({
    mutationFn: async ({ id, profile }) => {
      const response = await client.users.admin[":id"].profile.$put({ param: { id }, json: profile });
      return unwrapResponse<{ success: boolean }>(response);
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      options?.onSuccess?.(...args);
    },
    onError: (...args) => {
      options?.onError?.(...args);
    }
  });
}

/**
 * DELETE /api/users/admin/:id - Delete user
 */
export function useDeleteUser(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, string>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (id) => {
      const response = await client.users.admin[":id"].$delete({ param: { id } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      options?.onSuccess?.(...args);
    },
    onError: (...args) => {
      options?.onError?.(...args);
    }
  });
}
