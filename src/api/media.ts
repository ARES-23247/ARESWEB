/**
 * Media API - R2 Media Gallery, Upload, Management
 *
 * Types imported from backend route definitions in @shared/routes/media.ts
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { z } from "zod";
import { client, unwrapResponse, wrapOnSuccess } from "./honoClient";
import { r2ObjectSchema, assetSchema } from "@shared/routes/media";

// Infer TypeScript types from Zod schemas
export type R2MediaItem = z.infer<typeof r2ObjectSchema>;
export type Asset = z.infer<typeof assetSchema>;

export interface MediaResponse {
  media: Asset[];
}

/**
 * Wrapper type for FormData to ensure type safety with Hono client.
 *
 * Hono's type inference for FormData is limited because FormData structure
 * is dynamic and cannot be statically typed. This wrapper ensures the
 * underlying FormData is passed correctly while maintaining type safety
 * in our API layer.
 */
export class UploadFormData {
  constructor(public readonly data: FormData) {}
}

// ============================================
// Media
// ============================================

/**
 * GET /api/media/ - Get public gallery media
 */
export function useGetMedia(
  options?: Omit<UseQueryOptions<MediaResponse>, "queryKey" | "queryFn">
) {
  return useQuery<MediaResponse>({
    queryKey: ["public-media"],
    queryFn: async () => {
      const response = await client.media.$get();
      return unwrapResponse<MediaResponse>(response);
    },
    ...options,
  });
}

/**
 * GET /api/media/admin - Get all media (admin view)
 */
export function useGetAdminMedia(
  options?: Omit<UseQueryOptions<MediaResponse>, "queryKey" | "queryFn">
) {
  return useQuery<MediaResponse>({
    queryKey: ["admin-media"],
    queryFn: async () => {
      const response = await client.media.admin.$get();
      return unwrapResponse<MediaResponse>(response);
    },
    ...options,
  });
}

/**
 * POST /api/media/admin/upload - Upload media file
 */
export function useUploadMedia(
  options?: Omit<UseMutationOptions<{ success: boolean; key: string; url: string; altText?: string }, Error, UploadFormData>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; key: string; url: string; altText?: string }, Error, UploadFormData>({
    mutationFn: async (uploadFormData) => {
      const response = await client.media.admin.upload.$post({
        // Hono client expects FormData but doesn't infer it correctly from OpenAPIHono types.
        // The UploadFormData wrapper ensures we pass actual FormData at runtime.
        body: uploadFormData.data as never
      });
      return unwrapResponse<{ success: boolean; key: string; url: string; altText?: string }>(response);
    },
    ...wrapOnSuccess(options, (_data, _variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-media"] });
      queryClient.invalidateQueries({ queryKey: ["public-media"] });
    }),
  });
}

/**
 * PUT /api/media/admin/move/:key - Move media to folder
 */
export function useMoveMedia(
  options?: Omit<UseMutationOptions<{ success: boolean; newKey?: string }, Error, { key: string; folder: string }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; newKey?: string }, Error, { key: string; folder: string }>({
    mutationFn: async ({ key, folder }) => {
      const response = await client.media.admin.move[":key"].$put({
        param: { key },
        json: { folder }
      });
      return unwrapResponse<{ success: boolean; newKey?: string }>(response);
    },
    ...wrapOnSuccess(options, (_data, _variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-media"] });
      queryClient.invalidateQueries({ queryKey: ["public-media"] });
    }),
  });
}

/**
 * DELETE /api/media/admin/:key - Delete media
 */
export function useDeleteMedia(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, string>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (key) => {
      const response = await client.media.admin[":key"].$delete({ param: { key } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...wrapOnSuccess(options, (_data, _variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-media"] });
      queryClient.invalidateQueries({ queryKey: ["public-media"] });
    }),
  });
}

/**
 * POST /api/media/admin/syndicate - Syndicate media to social channels
 */
export function useSyndicateMedia(
  options?: Omit<UseMutationOptions<{ success: boolean; message: string }, Error, { key: string; caption?: string }>, "mutationFn">
) {
  return useMutation<{ success: boolean; message: string }, Error, { key: string; caption?: string }>({
    mutationFn: async ({ key, caption }) => {
      const response = await client.media.admin.syndicate.$post({
        json: { key, caption }
      });
      return unwrapResponse<{ success: boolean; message: string }>(response);
    },
    ...options,
  });
}
