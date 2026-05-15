/**
 * Albums API - Native Photo Album Management
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { z } from "zod";
import { client, unwrapResponse, withMutationCallbacks } from "./honoClient";
import { albumSchema, albumPayloadSchema } from "@shared/schemas/albumSchema";
import { albumDetailSchema } from "@shared/routes/albums";

// Infer TypeScript types from Zod schemas
export type Album = z.infer<typeof albumSchema>;
export type AlbumDetail = z.infer<typeof albumDetailSchema>;
export type CreateAlbumPayload = z.infer<typeof albumPayloadSchema>;
export type UpdateAlbumPayload = Partial<CreateAlbumPayload>;

export interface AlbumsResponse {
  albums: Album[];
}

export interface AlbumResponse {
  album: AlbumDetail;
}

// ============================================
// Public Albums
// ============================================

/**
 * GET /api/albums - Get all albums
 */
export function useGetAlbums(
  options?: Omit<UseQueryOptions<AlbumsResponse>, "queryKey" | "queryFn">
) {
  return useQuery<AlbumsResponse>({
    queryKey: ["albums"],
    queryFn: async () => {
      const response = await client.albums.$get();
      return unwrapResponse<AlbumsResponse>(response);
    },
    ...options,
  });
}

/**
 * GET /api/albums/:id - Get a single album with media
 */
export function useGetAlbum(
  id: string,
  options?: Omit<UseQueryOptions<AlbumResponse>, "queryKey" | "queryFn" | "enabled">
) {
  return useQuery<AlbumResponse>({
    queryKey: ["albums", id],
    queryFn: async () => {
      const response = await client.albums[":id"].$get({ param: { id } });
      return unwrapResponse<AlbumResponse>(response);
    },
    enabled: !!id,
    ...options,
  });
}

// ============================================
// Admin Albums
// ============================================

/**
 * POST /api/albums - Create an album
 */
export function useCreateAlbum(
  options?: Omit<UseMutationOptions<{ success: boolean; id: string }, Error, CreateAlbumPayload>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; id: string }, Error, CreateAlbumPayload>({
    mutationFn: async (data) => {
      const response = await client.albums.$post({ json: data });
      return unwrapResponse<{ success: boolean; id: string }>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["albums"] });
      }
    })
  });
}

/**
 * PATCH /api/albums/:id - Update an album
 */
export function useUpdateAlbum(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, { id: string } & UpdateAlbumPayload>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, { id: string } & UpdateAlbumPayload>({
    mutationFn: async ({ id, ...data }) => {
      const response = await client.albums[":id"].$patch({ param: { id }, json: data });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc, data, variables) => {
        qc.invalidateQueries({ queryKey: ["albums"] });
        qc.invalidateQueries({ queryKey: ["albums", variables.id] });
      }
    })
  });
}

/**
 * DELETE /api/albums/:id - Soft-delete an album
 */
export function useDeleteAlbum(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, string>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (id) => {
      const response = await client.albums[":id"].$delete({ param: { id } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc, data, id) => {
        qc.invalidateQueries({ queryKey: ["albums"] });
        qc.invalidateQueries({ queryKey: ["albums", id] });
      }
    })
  });
}

/**
 * POST /api/albums/:id/media - Add media to an album
 */
export function useAddAlbumMedia(
  options?: Omit<UseMutationOptions<{ success: boolean; added: number }, Error, { id: string; mediaIds: string[] }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; added: number }, Error, { id: string; mediaIds: string[] }>({
    mutationFn: async ({ id, mediaIds }) => {
      const response = await client.albums[":id"].media.$post({ param: { id }, json: { mediaIds } });
      return unwrapResponse<{ success: boolean; added: number }>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc, data, variables) => {
        qc.invalidateQueries({ queryKey: ["albums", variables.id] });
      }
    })
  });
}

/**
 * DELETE /api/albums/:id/media/:mediaId - Remove media from an album
 */
export function useRemoveAlbumMedia(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, { id: string; mediaId: string }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, { id: string; mediaId: string }>({
    mutationFn: async ({ id, mediaId }) => {
      const response = await client.albums[":id"].media[":mediaId"].$delete({ param: { id, mediaId } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc, data, variables) => {
        qc.invalidateQueries({ queryKey: ["albums", variables.id] });
      }
    })
  });
}

/**
 * PUT /api/albums/:id/media/reorder - Reorder media in an album
 */
export function useReorderAlbumMedia(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, { id: string; mediaIds: string[] }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, { id: string; mediaIds: string[] }>({
    mutationFn: async ({ id, mediaIds }) => {
      const response = await client.albums[":id"].media.reorder.$put({ param: { id }, json: { mediaIds } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc, data, variables) => {
        qc.invalidateQueries({ queryKey: ["albums", variables.id] });
      }
    })
  });
}
