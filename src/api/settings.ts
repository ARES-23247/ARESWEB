/**
 * Settings API - Integration Settings, Public Configuration
 *
 * Types imported from backend route definitions in @shared/routes/settings.ts
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { client, unwrapResponse } from "./honoClient";

export interface SettingsResponse {
  success: boolean;
  settings: Record<string, string>;
}

export interface UpdateSettingsResponse {
  success: boolean;
  updated: number;
}

export interface PlatformStatsResponse {
  posts: number;
  events: number;
  docs: number;
  inquiries: number;
  users: number;
}

export interface BackupResponse {
  success: boolean;
  timestamp: string;
  backup: Record<string, unknown[]>;
}



// ============================================
// Settings
// ============================================

/**
 * GET /api/settings/admin/settings - Get all integration settings (admin)
 */
export function useGetSettings(
  options?: Omit<UseQueryOptions<SettingsResponse>, "queryKey" | "queryFn">
) {
  return useQuery<SettingsResponse>({
    queryKey: ["settings"],
    queryFn: async () => {
      const response = await client.settings.admin.settings.$get();
      return unwrapResponse<SettingsResponse>(response);
    },
    ...options,
  });
}

/**
 * GET /api/settings/public/settings - Get public integration settings
 */
export function useGetPublicSettings(
  options?: Omit<UseQueryOptions<SettingsResponse>, "queryKey" | "queryFn">
) {
  return useQuery<SettingsResponse>({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const response = await client.settings.public.settings.$get();
      return unwrapResponse<SettingsResponse>(response);
    },
    ...options,
  });
}

/**
 * POST /api/settings/admin/settings - Update integration settings (admin)
 */
export function useUpdateSettings(
  options?: Omit<UseMutationOptions<UpdateSettingsResponse, Error, Record<string, string>>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<UpdateSettingsResponse, Error, Record<string, string>>({
    mutationFn: async (settings) => {
      const response = await client.settings.admin.settings.$post({ json: settings });
      return unwrapResponse<UpdateSettingsResponse>(response);
    },
    ...options,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["public-settings"] });
    }
  });
}

/**
 * GET /api/settings/admin/stats - Get platform quick stats (admin)
 */
export function useGetPlatformStats(
  options?: Omit<UseQueryOptions<PlatformStatsResponse>, "queryKey" | "queryFn">
) {
  return useQuery<PlatformStatsResponse>({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      const response = await client.settings.admin.stats.$get();
      return unwrapResponse<PlatformStatsResponse>(response);
    },
    ...options,
  });
}

/**
 * GET /api/settings/admin/backup - Export database backup (admin)
 */
export function useGetBackup(
  options?: Omit<UseQueryOptions<BackupResponse>, "queryKey" | "queryFn">
) {
  return useQuery<BackupResponse>({
    queryKey: ["backup"],
    queryFn: async () => {
      const response = await client.settings.admin.backup.$get();
      return unwrapResponse<BackupResponse>(response);
    },
    ...options,
  });
}
