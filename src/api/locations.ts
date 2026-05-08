/**
 * Locations API - Venues, Map Integration
 *
 * Types imported from backend route definitions in @shared/routes/locations.ts
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { z } from "zod";
import { client, unwrapResponse } from "./honoClient";
import { locationSchema } from "@shared/routes/locations";

// Infer TypeScript types from Zod schemas
export type Location = z.infer<typeof locationSchema>;

export interface LocationsResponse {
  locations: Location[];
}

export interface SaveLocationResponse {
  success: boolean;
  id: string;
}

export interface SuccessResponse {
  success: boolean;
}

// ============================================
// Public Locations
// ============================================

/**
 * GET /api/locations - Get all public locations
 */
export function useGetLocations(
  options?: Omit<UseQueryOptions<LocationsResponse>, "queryKey" | "queryFn">
) {
  return useQuery<LocationsResponse>({
    queryKey: ["locations"],
    queryFn: async () => {
      const response = await client.locations.$get();
      return unwrapResponse<LocationsResponse>(response);
    },
    ...options,
  });
}

// ============================================
// Admin Locations
// ============================================

/**
 * GET /api/locations/admin/list - List all locations (including deleted)
 */
export function useGetAdminLocations(
  options?: Omit<UseQueryOptions<LocationsResponse>, "queryKey" | "queryFn">
) {
  return useQuery<LocationsResponse>({
    queryKey: ["admin_locations"],
    queryFn: async () => {
      const response = await client.locations.admin.list.$get();
      return unwrapResponse<LocationsResponse>(response);
    },
    ...options,
  });
}

/**
 * POST /api/locations/admin/save - Create or update a location
 */
export function useSaveLocation(
  options?: Omit<UseMutationOptions<SaveLocationResponse, Error, Location>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<SaveLocationResponse, Error, Location>({
    mutationFn: async (payload) => {
      const response = await client.locations.admin.save.$post({ json: payload });
      return unwrapResponse<SaveLocationResponse>(response);
    },
    ...options,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      queryClient.invalidateQueries({ queryKey: ["admin_locations"] });
      options?.onSuccess?.();
    }
  });
}

/**
 * DELETE /api/locations/admin/:id - Soft delete a location
 */
export function useDeleteLocation(
  options?: Omit<UseMutationOptions<SuccessResponse, Error, string>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<SuccessResponse, Error, string>({
    mutationFn: async (id) => {
      const response = await client.locations.admin[":id"].$delete({ param: { id } });
      return unwrapResponse<SuccessResponse>(response);
    },
    ...options,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      queryClient.invalidateQueries({ queryKey: ["admin_locations"] });
      options?.onSuccess?.();
    }
  });
}
