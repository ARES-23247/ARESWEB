import { useQuery } from "@tanstack/react-query";
import { client, unwrapResponse } from "./honoClient";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * GOOGLE DRIVE API HOOKS
 * ─────────────────────────────────────────────────────────────────────────────
 * Type-safe React Query hooks for Google Drive files endpoint.
 * Provides type inference from route contracts defined in shared/routes/google-drive.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Query parameters for listing Drive files
 */
export interface ListDriveFilesParams {
  /** Search query - filters by file name contains (case-insensitive) */
  q?: string;
  /** Pagination token from previous response's nextPageToken */
  pageToken?: string;
  /** Number of files to return per page (1-100, default 50) */
  pageSize?: number;
}

/**
 * Response from listDriveFiles query
 */
export interface ListDriveFilesResponse {
  /** Array of Google Workspace documents matching the query */
  files: Array<{
    /** Google Drive file ID */
    id: string;
    /** File name */
    name: string;
    /** Google MIME type indicating file format */
    mimeType: string;
    /** Last modification time (RFC 3339) */
    modifiedTime: string;
    /** File owner display name */
    owner?: string;
    /** Link to open file in Google web interface */
    webViewLink?: string;
  }>;
  /** Token for next page of results, if more files exist */
  nextPageToken?: string;
}

/**
 * React Query hook for listing Google Drive files
 *
 * @param params - Query parameters for filtering and pagination
 * @returns React Query result with files array and pagination token
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useGetDriveFiles({ q: "meeting" });
 * console.log(data?.files); // Array of Drive files
 * ```
 */
export function useGetDriveFiles(params?: ListDriveFilesParams) {
  return useQuery({
    queryKey: ["google-drive", "files", params],
    queryFn: async () => {
      const res = await client.googleDrive.files.$get({
        query: params ?? {},
      });
      return unwrapResponse<ListDriveFilesResponse>(res);
    },
  });
}

/**
 * Export the query key for manual invalidation if needed
 *
 * @example
 * ```tsx
 * const queryClient = useQueryClient();
 * queryClient.invalidateQueries({ queryKey: driveFilesQueryKey });
 * ```
 */
export const driveFilesQueryKey = ["google-drive", "files"];
