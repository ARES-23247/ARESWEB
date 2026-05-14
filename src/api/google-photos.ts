import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { client, unwrapResponse, toastApiError, withMutationCallbacks } from "./honoClient";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * GOOGLE PHOTOS PICKER API HOOKS
 * ─────────────────────────────────────────────────────────────────────────────
 * Type-safe React Query hooks for Google Photos Picker API endpoints.
 * Replaces deprecated Library API (photoslibrary.readonly) as of March 2025.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface PickerSession {
  id: string;
  pickerUri: string;
  mediaItemsSet: boolean;
  pollingConfig?: {
    pollInterval?: string;
    timeoutIn?: string;
  };
}

export interface PickedMediaItem {
  id: string;
  mediaFile?: {
    baseUrl: string;
    mimeType: string;
    filename?: string;
    fileSize?: string;
    mediaFileMetadata?: {
      width?: string;
      height?: string;
      cameraMake?: string;
      cameraModel?: string;
    };
  };
}

export interface ImportPhotosParams {
  items: Array<{
    id: string;
    baseUrl: string;
    filename?: string;
    mimeType?: string;
  }>;
}

export interface ImportPhotosResponse {
  imported: number;
  failed: number;
  results: Array<{
    mediaItemId: string;
    status: "success" | "failed";
    r2Key?: string;
    error?: string;
    filename: string;
  }>;
}

export interface UploadPhotosParams {
  files: File[];
  title?: string;
  description?: string;
  albumId?: string;
}

export interface UploadPhotosResponse {
  uploadedCount: number;
  failures?: Array<{
    filename: string;
    error: string;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// PICKER SESSION HOOKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mutation hook to create a new Picker session
 * Returns the pickerUri to open in a popup for user photo selection
 */
export function useCreatePickerSession() {
  return useMutation({
    mutationFn: async () => {
      const res = await client["google-photos"].picker.session.$post({});
      return unwrapResponse<PickerSession>(res);
    },
  });
}

/**
 * Mutation hook to create a new video-only Picker session
 * Returns the pickerUri to open in a popup for user video selection
 */
export function useCreateVideoPickerSession() {
  return useMutation({
    mutationFn: async () => {
      const res = await client["google-photos"].picker["video-session"].$post({});
      return unwrapResponse<PickerSession>(res);
    },
  });
}

/**
 * Query hook to poll a Picker session status
 * Enabled only when sessionId is provided and mediaItemsSet is not yet true
 * @param sessionId - Active session ID to poll
 * @param enabled - Whether polling should be active
 */
export function useGetPickerSession(sessionId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["google-photos", "picker-session", sessionId],
    queryFn: async () => {
      if (!sessionId) throw new Error("No session ID");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Hono parameterized route typing
      const res = await (client["google-photos"].picker.session as any)[":sessionId"].$get({
        param: { sessionId },
      });
      return unwrapResponse<PickerSession>(res);
    },
    enabled: !!sessionId && enabled,
    refetchInterval: 3000, // Poll every 3 seconds
  });
}

/**
 * Query hook to fetch selected media items from a completed Picker session
 * @param sessionId - Session ID where user has finished selecting
 */
export function useGetPickerItems(sessionId: string | null) {
  return useQuery({
    queryKey: ["google-photos", "picker-items", sessionId],
    queryFn: async () => {
      if (!sessionId) throw new Error("No session ID");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Hono parameterized route typing
      const res = await (client["google-photos"].picker.session as any)[":sessionId"].items.$get({
        param: { sessionId },
      });
      return unwrapResponse<{ mediaItems: PickedMediaItem[] }>(res);
    },
    enabled: !!sessionId,
  });
}

/**
 * Mutation hook to delete a Picker session (cleanup)
 */
export function useDeletePickerSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Hono parameterized route typing
      const res = await (client["google-photos"].picker.session as any)[":sessionId"].$delete({
        param: { sessionId },
      });
      return unwrapResponse<{ success: boolean }>(res);
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["google-photos", "picker-session"] });
      queryClient.removeQueries({ queryKey: ["google-photos", "picker-items"] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT MUTATION (updated for Picker items)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mutation hook for importing picked photos to R2 storage
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
          items: params.items,
        },
      });

      return unwrapResponse<ImportPhotosResponse>(res);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (queryClient, _data) => {
        queryClient.invalidateQueries({
          queryKey: ["google-photos"],
        });
      },
      onError: (queryClient, error) => {
        toastApiError(error, "Photo import failed");
      },
    }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD MUTATION (unchanged — uses photoslibrary.appendonly)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mutation hook for uploading photos to Google Photos
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- FormData typing requires dynamic access
      const res = await (client["google-photos"] as any).upload.$post({
        body: formData,
      });

      return unwrapResponse<UploadPhotosResponse>(res);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (queryClient, _data, _variables) => {
        queryClient.invalidateQueries({
          queryKey: ["google-photos"],
        });
      },
      onError: (queryClient, error, _variables) => {
        toastApiError(error, "Photo upload failed");
      },
    }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE PHOTOS VIDEOS TO YOUTUBE
// ─────────────────────────────────────────────────────────────────────────────

export interface GooglePhotosToYoutubeParams {
  videos: Array<{
    id: string;
    baseUrl: string;
    filename: string;
    mimeType: string;
  }>;
  title: string;
  description?: string;
  privacyStatus?: "public" | "unlisted" | "private";
  mediaType?: "video" | "short";
}

export interface GooglePhotosToYoutubeResponse {
  results: Array<{
    googlePhotosId: string;
    filename: string;
    status: "success" | "failed";
    youtubeVideoId?: string;
    error?: string;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

/**
 * Mutation hook for uploading Google Photos videos to YouTube
 */
export function useUploadGooglePhotosToYoutube(
  options?: import("@tanstack/react-query").UseMutationOptions<
    GooglePhotosToYoutubeResponse,
    unknown,
    GooglePhotosToYoutubeParams
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: GooglePhotosToYoutubeParams) => {
      const res = await client["google-photos"].picker["videos-to-youtube"].$post({
        json: params,
      });

      return unwrapResponse<GooglePhotosToYoutubeResponse>(res);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (queryClient, _data) => {
        queryClient.invalidateQueries({
          queryKey: ["videos"],
        });
      },
      onError: (queryClient, error) => {
        toastApiError(error, "Failed to upload videos to YouTube");
      },
    }),
  });
}

