/**
 * Social Media Queue API
 *
 * Types inferred from backend route definitions in @shared/routes/socialQueue.ts
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { z } from "zod";
import { client, unwrapResponse, withMutationCallbacks } from "./honoClient";
import { socialQueueSchema } from "@shared/routes/socialQueue";

// Infer TypeScript types from Zod schemas
export type SocialQueuePost = z.infer<typeof socialQueueSchema>;

export interface SocialQueueListResponse {
  posts: SocialQueuePost[];
  total: number;
}

export interface SocialQueueCalendarResponse {
  posts: SocialQueuePost[];
}

export interface CreateSocialPostRequest {
  content: string;
  mediaUrls?: string[];
  scheduledFor: string;
  platforms: {
    twitter?: boolean;
    bluesky?: boolean;
    facebook?: boolean;
    instagram?: boolean;
    discord?: boolean;
    slack?: boolean;
    teams?: boolean;
    gchat?: boolean;
    linkedin?: boolean;
    tiktok?: boolean;
    band?: boolean;
  };
  linkedType?: "blog" | "event" | "document" | "asset";
  linkedId?: string;
}

export interface UpdateSocialPostRequest extends Partial<Omit<CreateSocialPostRequest, "linkedType" | "linkedId">> {
  status?: "pending" | "processing" | "sent" | "failed" | "cancelled";
}

export interface SocialAnalyticsQuery {
  start?: string;
  end?: string;
}

export interface SocialAnalyticsResponse {
  totalPosts: number;
  totalSent: number;
  totalPending: number;
  totalFailed: number;
  byPlatform: Record<string, number>;
  engagement: {
    totalImpressions: number;
    totalLikes: number;
    totalShares: number;
    totalComments: number;
  };
}

// ============================================
// Social Queue Hooks
// ============================================

/**
 * GET /api/social-queue - List all scheduled social posts
 */
export function useGetSocialQueue(
  query?: { status?: string; limit?: number; offset?: number },
  options?: Omit<UseQueryOptions<SocialQueueListResponse>, "queryKey" | "queryFn">
) {
  return useQuery<SocialQueueListResponse>({
    queryKey: ["social-queue", query],
    queryFn: async () => {
      const response = await client["social-queue"].$get({ query: query as never });  
      return unwrapResponse<SocialQueueListResponse>(response);
    },
    ...options,
  });
}

/**
 * GET /api/social-queue/calendar - Get posts within a date range for calendar view
 */
export function useGetSocialCalendar(
  query: { start: string; end: string },
  options?: Omit<UseQueryOptions<SocialQueueCalendarResponse>, "queryKey" | "queryFn" | "enabled">
) {
  return useQuery<SocialQueueCalendarResponse>({
    queryKey: ["social-queue", "calendar", query] as const,
    queryFn: async () => {
      const response = await client["social-queue"].calendar.$get({ query });
      return unwrapResponse<SocialQueueCalendarResponse>(response);
    },
    enabled: !!(query.start && query.end),
    ...options,
  });
}

/**
 * POST /api/social-queue - Create a new scheduled social post
 */
export function useCreateSocialPost(
  options?: Omit<UseMutationOptions<{ success: boolean; post: SocialQueuePost }, Error, CreateSocialPostRequest>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; post: SocialQueuePost }, Error, CreateSocialPostRequest>({
    mutationFn: async (data) => {
      const response = await client["social-queue"].$post({ json: data as never });
      return unwrapResponse<{ success: boolean; post: SocialQueuePost }>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["social-queue"] });
        qc.invalidateQueries({ queryKey: ["social-queue", "calendar"] });
      }
    })
  });
}

/**
 * PATCH /api/social-queue/:id - Update a scheduled social post
 */
export function useUpdateSocialPost(
  options?: Omit<UseMutationOptions<{ success: boolean; post: SocialQueuePost }, Error, { id: string; updates: UpdateSocialPostRequest }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; post: SocialQueuePost }, Error, { id: string; updates: UpdateSocialPostRequest }>({
    mutationFn: async ({ id, updates }) => {
      const response = await client["social-queue"][":id"].$patch({ param: { id }, json: updates as never });
      return unwrapResponse<{ success: boolean; post: SocialQueuePost }>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["social-queue"] });
        qc.invalidateQueries({ queryKey: ["social-queue", "calendar"] });
      }
    })
  });
}

/**
 * DELETE /api/social-queue/:id - Cancel/delete a scheduled social post
 */
export function useDeleteSocialPost(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, string>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (id) => {
      const response = await client["social-queue"][":id"].$delete({ param: { id } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["social-queue"] });
        qc.invalidateQueries({ queryKey: ["social-queue", "calendar"] });
      }
    })
  });
}

/**
 * POST /api/social-queue/:id/send-now - Immediately send a scheduled post
 */
export function useSendSocialPostNow(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, string>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (id) => {
      const response = await client["social-queue"][":id"]["send-now"].$post({ param: { id } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["social-queue"] });
        qc.invalidateQueries({ queryKey: ["social-queue", "calendar"] });
      }
    })
  });
}

/**
 * GET /api/social-queue/analytics - Get analytics for social media posts
 */
export function useGetSocialAnalytics(
  query: SocialAnalyticsQuery = {},
  options?: Omit<UseQueryOptions<SocialAnalyticsResponse>, "queryKey" | "queryFn">
) {
  return useQuery<SocialAnalyticsResponse>({
    queryKey: ["social-queue", "analytics", query] as const,
    queryFn: async () => {
      const response = await client["social-queue"].analytics.$get({ query: query as never });  
      return unwrapResponse<SocialAnalyticsResponse>(response);
    },
    ...options,
  });
}
