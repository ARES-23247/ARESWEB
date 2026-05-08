/**
 * Simulations API - Simulation Playground CRUD operations
 *
 * Types imported from backend route definitions in @shared/routes/simulations.ts
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { z } from "zod";
import { client, unwrapResponse } from "./honoClient";

// Re-export schemas for type inference
import {
  SimulationSchema,
} from "@shared/routes/simulations";

// Infer TypeScript types from Zod schemas
export type Simulation = z.infer<typeof SimulationSchema>;

export interface SimulationsListResponse {
  simulations: Simulation[];
}

export interface SimulationResponse {
  simulation: Simulation;
}

export interface SaveSimulationResponse {
  id: string;
}

export interface GistResponse {
  success: boolean;
  gistId: string;
  url: string;
}

export interface SuccessResponse {
  success: boolean;
}

export interface SaveSimulationRequest {
  name?: string;
  files: Record<string, string>;
}

export interface CreateGistRequest {
  name?: string;
  files: Record<string, string>;
}

// ============================================
// Simulations
// ============================================

/**
 * GET /api/simulations - List all simulations
 */
export function useGetSimulations(
  options?: Omit<UseQueryOptions<SimulationsListResponse>, "queryKey" | "queryFn">
) {
  return useQuery<SimulationsListResponse>({
    queryKey: ["simulations"],
    queryFn: async () => {
      const response = await client.simulations.$get();
      return unwrapResponse<SimulationsListResponse>(response);
    },
    ...options,
  });
}

/**
 * GET /api/simulations/:id - Get simulation detail
 */
export function useGetSimulation(
  id: string,
  options?: Omit<UseQueryOptions<SimulationResponse>, "queryKey" | "queryFn" | "enabled">
) {
  return useQuery<SimulationResponse>({
    queryKey: ["simulations", id],
    queryFn: async () => {
      const response = await client.simulations[":id"].$get({ param: { id } });
      return unwrapResponse<SimulationResponse>(response);
    },
    enabled: !!id,
    ...options,
  });
}

/**
 * POST /api/simulations - Save or update simulation
 */
export function useSaveSimulation(
  options?: Omit<UseMutationOptions<SaveSimulationResponse, Error, { name?: string; files: Record<string, string> }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<SaveSimulationResponse, Error, { name?: string; files: Record<string, string> }>({
    mutationFn: async (data) => {
      const response = await client.simulations.$post({ json: data });
      return unwrapResponse<SaveSimulationResponse>(response);
    },
    ...options,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["simulations"] });
    }
  });
}

/**
 * DELETE /api/simulations/:id - Delete simulation
 */
export function useDeleteSimulation(
  options?: Omit<UseMutationOptions<SuccessResponse, Error, string>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<SuccessResponse, Error, string>({
    mutationFn: async (id) => {
      const response = await client.simulations[":id"].$delete({ param: { id } });
      return unwrapResponse<SuccessResponse>(response);
    },
    ...options,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["simulations"] });
    }
  });
}

// ============================================
// GitHub Gists
// ============================================

/**
 * POST /api/simulations/gist - Create GitHub Gist for simulation
 */
export function useCreateGist(
  options?: Omit<UseMutationOptions<GistResponse, Error, { name?: string; files: Record<string, string> }>, "mutationFn">
) {
  return useMutation<GistResponse, Error, { name?: string; files: Record<string, string> }>({
    mutationFn: async (data) => {
      const response = await client.simulations.gist.$post({ json: data });
      return unwrapResponse<GistResponse>(response);
    },
    ...options,
  });
}

/**
 * GET /api/simulations/gist/:id - Get simulation from Gist
 */
export function useGetGist(
  id: string,
  options?: Omit<UseQueryOptions<SimulationResponse>, "queryKey" | "queryFn" | "enabled">
) {
  return useQuery<SimulationResponse>({
    queryKey: ["simulations", "gist", id],
    queryFn: async () => {
      const response = await client.simulations.gist[":id"].$get({ param: { id } });
      return unwrapResponse<SimulationResponse>(response);
    },
    enabled: !!id,
    ...options,
  });
}
