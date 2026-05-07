/**
 * GitHub API - Projects, activity, and webhook endpoints
 *
 * Types imported from backend route definitions in @shared/routes/github.ts
 */

import { useQuery, useMutation, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { z } from "zod";
import { client, unwrapResponse } from "./honoClient";

// Re-export schemas for type inference
import { githubProjectItemSchema, githubHeatmapDaySchema } from "@shared/routes/github";

// Infer TypeScript types from Zod schemas
export type GithubProjectItem = z.infer<typeof githubProjectItemSchema>;
export type GithubHeatmapDay = z.infer<typeof githubHeatmapDaySchema>;

export interface BoardResponse {
  success: boolean;
  board: GithubProjectItem[];
}

export interface ActivityResponse {
  grid: GithubHeatmapDay[][];
  totalCommits: number;
  repoCount: number;
}

// ============================================
// GitHub Projects
// ============================================

/**
 * GET /api/github/projects - Get GitHub Projects board
 */
export function useGetGitHubBoard(
  options?: Omit<UseQueryOptions<BoardResponse>, "queryKey" | "queryFn">
) {
  return useQuery<BoardResponse>({
    queryKey: ["github", "board"],
    queryFn: async () => {
      const response = await client.github.projects.$get();
      return unwrapResponse<BoardResponse>(response);
    },
    ...options,
  });
}

/**
 * POST /api/github/projects/items - Create a GitHub Project item
 */
export function useCreateGitHubItem(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, { title: string }>, "mutationFn">
) {
  return useMutation<{ success: boolean }, Error, { title: string }>({
    mutationFn: async (data) => {
      const response = await client.github.projects.items.$post({ json: data });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...options,
  });
}

// ============================================
// GitHub Activity
// ============================================

/**
 * GET /api/github/activity - Get team GitHub contribution heatmap data
 */
export function useGetGitHubActivity(
  options?: Omit<UseQueryOptions<ActivityResponse>, "queryKey" | "queryFn">
) {
  return useQuery<ActivityResponse>({
    queryKey: ["github", "activity"],
    queryFn: async () => {
      const response = await client.github.activity.$get();
      return unwrapResponse<ActivityResponse>(response);
    },
    ...options,
  });
}
