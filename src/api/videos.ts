/**
 * Videos API - Video Management (YouTube, Vimeo, etc.)
 *
 * Types imported from backend route definitions in @shared/routes/videos.ts
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { z } from "zod";
import { client, unwrapResponse, withMutationCallbacks } from "./honoClient";
import { videoSchema, parseVideoUrlResponseSchema } from "@shared/routes/videos";

// Infer TypeScript types from Zod schemas
export type Video = z.infer<typeof videoSchema>;
export type VideoPlatform = "youtube" | "vimeo" | "other";

export type CreateVideoPayload = {
  title: string;
  description?: string;
  platform: VideoPlatform;
  videoId: string;
  thumbnailKey?: string;
};

export type UpdateVideoPayload = Partial<CreateVideoPayload>;

export type ParseVideoUrlPayload = {
  url: string;
};

export type ParseVideoUrlResponse = z.infer<typeof parseVideoUrlResponseSchema>;

export interface VideosResponse {
  videos: Video[];
}

export interface VideoResponse {
  video: Video;
}

// ============================================
// Public Videos
// ============================================

/**
 * GET /api/videos - Get all videos
 */
export function useGetVideos(
  options?: Omit<UseQueryOptions<VideosResponse>, "queryKey" | "queryFn">
) {
  return useQuery<VideosResponse>({
    queryKey: ["videos"],
    queryFn: async () => {
      const response = await client.videos.$get({ query: {} });
      return unwrapResponse<VideosResponse>(response);
    },
    ...options,
  });
}

/**
 * GET /api/videos/:id - Get a single video
 */
export function useGetVideo(
  id: string,
  options?: Omit<UseQueryOptions<VideoResponse>, "queryKey" | "queryFn" | "enabled">
) {
  return useQuery<VideoResponse>({
    queryKey: ["videos", id],
    queryFn: async () => {
      const response = await client.videos[":id"].$get({ param: { id } });
      return unwrapResponse<VideoResponse>(response);
    },
    enabled: !!id,
    ...options,
  });
}

/**
 * POST /api/videos/parse-url - Parse a video URL
 */
export function useParseVideoUrl(
  options?: Omit<UseQueryOptions<ParseVideoUrlResponse, Error>, "queryKey" | "queryFn" | "enabled">
) {
  return useQuery<ParseVideoUrlResponse, Error>({
    queryKey: ["parse_video_url"],
    queryFn: async () => {
      const response = await client.videos["parse-url"].$post({ json: { url: "" } });
      return unwrapResponse<ParseVideoUrlResponse>(response);
    },
    enabled: false, // Only run when manually triggered
    ...options,
  });
}

/**
 * Mutation to parse a video URL
 */
export function useParseVideoUrlMutation(
  options?: Omit<UseMutationOptions<ParseVideoUrlResponse, Error, ParseVideoUrlPayload>, "mutationFn">
) {
  return useMutation<ParseVideoUrlResponse, Error, ParseVideoUrlPayload>({
    mutationFn: async (data) => {
      const response = await client.videos["parse-url"].$post({ json: data });
      return unwrapResponse<ParseVideoUrlResponse>(response);
    },
    ...options,
  });
}

// ============================================
// Admin Videos
// ============================================

/**
 * POST /api/videos/admin - Create a video
 */
export function useCreateVideo(
  options?: Omit<UseMutationOptions<VideoResponse, Error, CreateVideoPayload>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<VideoResponse, Error, CreateVideoPayload>({
    mutationFn: async (data) => {
      const response = await client.videos.admin.$post({ json: data });
      return unwrapResponse<VideoResponse>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["videos"] });
      }
    })
  });
}

/**
 * PUT /api/videos/admin/:id - Update a video
 */
export function useUpdateVideo(
  options?: Omit<UseMutationOptions<VideoResponse, Error, { id: string } & UpdateVideoPayload>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<VideoResponse, Error, { id: string } & UpdateVideoPayload>({
    mutationFn: async ({ id, ...data }) => {
      const response = await client.videos.admin[":id"].$patch({ param: { id }, json: data });
      return unwrapResponse<VideoResponse>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["videos"] });
      }
    })
  });
}

/**
 * DELETE /api/videos/admin/:id - Delete a video
 */
export function useDeleteVideo(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, string>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (id) => {
      const response = await client.videos.admin[":id"].$delete({ param: { id } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["videos"] });
      }
    })
  });
}
