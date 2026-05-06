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

/**
 * POST /api/locations - Create a new location
 */
export function useCreateLocation(
  options?: Omit<UseMutationOptions<{ success: boolean; id?: string }, Error, Location>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; id?: string }, Error, Location>({
    mutationFn: async (payload) => {
      const response = await client.locations.$post({ json: payload });
      return unwrapResponse<{ success: boolean; id?: string }>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      queryClient.invalidateQueries({ queryKey: ["admin_locations"] });
    },
    ...options,
  });
}
