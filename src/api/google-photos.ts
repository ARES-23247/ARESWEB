import { useQuery } from "@tanstack/react-query";
import { client, unwrapResponse } from "./honoClient";

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
      const res = await client.googlePhotos.media.$get({
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
      const res = await client.googlePhotos.albums.$get({
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
