/**
 * Galleries API - Photo Gallery Management
 *
 * Types imported from backend route definitions in @shared/routes/galleries.ts
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { z } from "zod";
import { client, unwrapResponse, withMutationCallbacks } from "./honoClient";
import { gallerySchema } from "@shared/routes/galleries";

// Infer TypeScript types from Zod schemas
export type Gallery = z.infer<typeof gallerySchema>;

export type CreateGalleryPayload = {
  title: string;
  description?: string;
  googlePhotosUrl?: string | null;
  heroImageKey?: string;
};

export type UpdateGalleryPayload = Partial<CreateGalleryPayload>;

export interface GalleriesResponse {
  galleries: Gallery[];
}

export interface GalleryResponse {
  gallery: Gallery;
}

// ============================================
// Public Galleries
// ============================================

/**
 * GET /api/galleries - Get all galleries
 */
export function useGetGalleries(
  options?: Omit<UseQueryOptions<GalleriesResponse>, "queryKey" | "queryFn">
) {
  return useQuery<GalleriesResponse>({
    queryKey: ["galleries"],
    queryFn: async () => {
      const response = await client.galleries.$get();
      return unwrapResponse<GalleriesResponse>(response);
    },
    ...options,
  });
}

/**
 * GET /api/galleries/:id - Get a single gallery
 */
export function useGetGallery(
  id: string,
  options?: Omit<UseQueryOptions<GalleryResponse>, "queryKey" | "queryFn" | "enabled">
) {
  return useQuery<GalleryResponse>({
    queryKey: ["galleries", id],
    queryFn: async () => {
      const response = await client.galleries[":id"].$get({ param: { id } });
      return unwrapResponse<GalleryResponse>(response);
    },
    enabled: !!id,
    ...options,
  });
}

// ============================================
// Admin Galleries
// ============================================

/**
 * POST /api/galleries/admin - Create a gallery
 */
export function useCreateGallery(
  options?: Omit<UseMutationOptions<GalleryResponse, Error, CreateGalleryPayload>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<GalleryResponse, Error, CreateGalleryPayload>({
    mutationFn: async (data) => {
      const response = await client.galleries.admin.$post({ json: data });
      return unwrapResponse<GalleryResponse>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["galleries"] });
      }
    })
  });
}

/**
 * PUT /api/galleries/admin/:id - Update a gallery
 */
export function useUpdateGallery(
  options?: Omit<UseMutationOptions<GalleryResponse, Error, { id: string } & UpdateGalleryPayload>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<GalleryResponse, Error, { id: string } & UpdateGalleryPayload>({
    mutationFn: async ({ id, ...data }) => {
      const response = await client.galleries.admin[":id"].$put({ param: { id }, json: data });
      return unwrapResponse<GalleryResponse>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["galleries"] });
      }
    })
  });
}

/**
 * DELETE /api/galleries/admin/:id - Delete a gallery
 */
export function useDeleteGallery(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, string>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (id) => {
      const response = await client.galleries.admin[":id"].$delete({ param: { id } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["galleries"] });
      }
    })
  });
}
