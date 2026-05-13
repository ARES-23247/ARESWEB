import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { client, unwrapResponse, toastApiError, withMutationCallbacks } from "./honoClient";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * GOOGLE PHOTOS API HOOKS
 * ─────────────────────────────────────────────────────────────────────────────
 * Type-safe React Query hooks for Google Photos Library API endpoints.
 * Provides type inference from route contracts defined in shared/routes/google-photos.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Query parameters for listing media items
 */
export interface GetMediaItemsParams {
  /** Filter by album ID per D-10 */
  albumId?: string;
  /** Pagination token from Photos API */
  pageToken?: string;
  /** Items per page (1-50, default 25) */
  pageSize?: number;
}

/**
 * Response from listMediaItems query
 */
export interface GetMediaItemsResponse {
  /** Array of Google Photos media items (photos only per PHOTO-02) */
  mediaItems: Array<{
    /** Google Photos media item ID */
    id: string;
    /** Original filename */
    filename: string;
    /** MIME type (images only, no videos per PHOTO-02) */
    mimeType: string;
    /** Base URL for photo access (use =w200-h200 for thumbnails) */
    baseUrl: string;
    /** Image width in pixels */
    width?: string;
    /** Image height in pixels */
    height?: string;
    /** Photo creation time (ISO 8601) */
    creationTime?: string;
    /** User-provided description */
    description?: string;
  }>;
  /** Token for next page of results, if more items exist */
  nextPageToken?: string;
}

/**
 * Query parameters for listing albums
 */
export interface GetAlbumsParams {
  /** Pagination token from Photos API */
  pageToken?: string;
  /** Albums per page (1-50, default 25) */
  pageSize?: number;
}

/**
 * Response from listAlbums query
 */
export interface GetAlbumsResponse {
  /** Array of Google Photos albums */
  albums: Array<{
    /** Album ID */
    id: string;
    /** Album title */
    title: string;
    /** Number of items in album */
    mediaItemsCount?: string;
    /** Cover photo URL (use =w200-h200 for thumbnail) */
    coverPhotoBaseUrl?: string;
  }>;
  /** Token for next page of results, if more albums exist */
  nextPageToken?: string;
}

/**
 * React Query hook for listing Google Photos media items
 *
 * @param params - Query parameters for album filtering and pagination
 * @returns React Query result with mediaItems array and pagination token
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useGetMediaItems({ albumId: "album123" });
 * console.log(data?.mediaItems); // Array of photo items
 * ```
 */
export function useGetMediaItems(params?: GetMediaItemsParams) {
  return useQuery({
    queryKey: ["google-photos", "media", params],
    queryFn: async () => {
      const res = await client["google-photos"].media.$get({
        query: params ?? {},
      });
      return unwrapResponse<GetMediaItemsResponse>(res);
    },
  });
}

/**
 * React Query hook for listing Google Photos albums
 *
 * @param params - Query parameters for pagination
 * @returns React Query result with albums array and pagination token
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useGetAlbums();
 * console.log(data?.albums); // Array of albums
 * ```
 */
export function useGetAlbums(params?: GetAlbumsParams) {
  return useQuery({
    queryKey: ["google-photos", "albums", params],
    queryFn: async () => {
      const res = await client["google-photos"].albums.$get({
        query: params ?? {},
      });
      return unwrapResponse<GetAlbumsResponse>(res);
    },
  });
}

/**
 * Export query keys for manual invalidation
 *
 * @example
 * ```tsx
 * const queryClient = useQueryClient();
 * queryClient.invalidateQueries({ queryKey: mediaItemsQueryKey });
 * ```
 */
export const mediaItemsQueryKey = ["google-photos", "media"];
export const albumsQueryKey = ["google-photos", "albums"];

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * GOOGLE PHOTOS UPLOAD MUTATION
 * ─────────────────────────────────────────────────────────────────────────────
 * Mutation hook for uploading photos to Google Photos.
 * Per D-14: On success, refresh media list to show new uploads.
 * Per D-21: Display upload errors inline.
 * Per D-22: Retry failed uploads with per-file error tracking.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Parameters for uploading photos
 */
export interface UploadPhotosParams {
  /** Array of image files to upload (JPG, PNG, WEBP, GIF, HEIC per D-11) */
  files: File[];
  /** Optional title for all uploaded photos */
  title?: string;
  /** Optional description for all uploaded photos */
  description?: string;
  /** Optional album ID to assign photos to (per D-12) */
  albumId?: string;
}

/**
 * Response from uploadPhotos mutation
 */
export interface UploadPhotosResponse {
  /** Number of photos successfully uploaded */
  uploadedCount: number;
  /** Upload failures per file (D-21/D-22) */
  failures?: Array<{
    filename: string;
    error: string;
  }>;
}

/**
 * React Query mutation hook for uploading photos to Google Photos
 *
 * @param options - Optional mutation callbacks (onSuccess, onError, etc.)
 * @returns Mutation object with mutate, mutateAsync, isLoading, error
 *
 * @example
 * ```tsx
 * const uploadMutation = useUploadPhotos({
 *   onSuccess: (data) => {
 *     toast.success(`Uploaded ${data.uploadedCount} photos`);
 *   },
 * });
 *
 * const handleUpload = (files: File[]) => {
 *   uploadMutation.mutate({
 *     files,
 *     title: "Team Photos",
 *     description: "From championship",
 *   });
 * };
 * ```
 */
export function useUploadPhotos(
  options?: import("@tanstack/react-query").UseMutationOptions<
    UploadPhotosResponse,
    unknown,
    UploadPhotosParams
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: UploadPhotosParams) => {
      // Create FormData from params
      const formData = new FormData();
      params.files.forEach((file) => {
        formData.append("files", file);
      });
      if (params.title) {
        formData.append("title", params.title);
      }
      if (params.description) {
        formData.append("description", params.description);
      }
      if (params.albumId) {
        formData.append("albumId", params.albumId);
      }

      // Call upload endpoint
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- FormData typing requires dynamic access
      const res = await (client["google-photos"] as any).upload.$post({
        // FormData typing issue is fixed in recent Hono versions
        body: formData,
      });

      return unwrapResponse<UploadPhotosResponse>(res);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (queryClient, _data, _variables) => {
        // Invalidate media items query to refresh list per D-14
        queryClient.invalidateQueries({
          queryKey: mediaItemsQueryKey,
        });
      },
      onError: (queryClient, error, _variables) => {
        // Display toast error with diagnostic code per D-21
        toastApiError(error, "Photo upload failed");
      },
    }),
  });
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * GOOGLE PHOTOS IMPORT MUTATION (Phase 76)
 * ─────────────────────────────────────────────────────────────────────────────
 * Mutation hook for importing photos from Google Photos to R2 storage.
 * Per IMG-03/IMG-04: Downloads from Photos API, validates, uploads to R2.
 * Per IMG-06: Tracks imports in D1 and invalidates media queries on success.
 * Per IMG-07: Returns detailed error information for failed imports.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Parameters for importing photos
 */
export interface ImportPhotosParams {
  /** Google Photos media item IDs to import */
  mediaItemIds: string[];
  /** Optional album ID for R2 folder structure (per D-11) */
  albumId?: string;
}

/**
 * Response from importPhotos mutation
 * Per D-23: Returns success/failure counts and per-item results
 */
export interface ImportPhotosResponse {
  /** Number of photos successfully imported */
  imported: number;
  /** Number of failed imports */
  failed: number;
  /** Per-item import results */
  results: Array<{
    mediaItemId: string;
    status: "success" | "failed";
    r2Key?: string;
    error?: string;
    filename: string;
  }>;
}

/**
 * React Query mutation hook for importing photos from Google Photos to R2
 *
 * @param options - Optional mutation callbacks (onSuccess, onError, etc.)
 * @returns Mutation object with mutate, mutateAsync, isLoading, error
 *
 * @example
 * ```tsx
 * const importMutation = useImportPhotos({
 *   onSuccess: (data) => {
 *     toast.success(`Imported ${data.imported} photos`);
 *   },
 * });
 *
 * const handleImport = (ids: string[]) => {
 *   importMutation.mutate({
 *     mediaItemIds: ids,
 *     albumId: selectedAlbumId ?? undefined,
 *   });
 * };
 * ```
 */
export function useImportPhotos(
  options?: import("@tanstack/react-query").UseMutationOptions<
    ImportPhotosResponse,
    unknown,
    ImportPhotosParams
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ImportPhotosParams) => {
      const res = await client["google-photos"].import.$post({
        json: {
          mediaItemIds: params.mediaItemIds,
          albumId: params.albumId,
        },
      });

      return unwrapResponse<ImportPhotosResponse>(res);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (queryClient, _data) => {
        // Invalidate media items query to refresh list per IMG-06
        queryClient.invalidateQueries({
          queryKey: mediaItemsQueryKey,
        });
      },
      onError: (queryClient, error) => {
        // Display toast error with diagnostic code per IMG-07
        toastApiError(error, "Photo import failed");
      },
    }),
  });
}
