/**
 * File Manager React Query Hooks
 *
 * Type-safe hooks for file operations with automatic cache management.
 */

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toastApiError, withMutationCallbacks } from "../api/honoClient";
import {
	useGetFiles,
	useUploadFile,
	useImportFromDrive,
	useDeleteFile,
	useScanUsage,
	UploadFileFormData,
	type UploadedFile,
	type ListFilesQuery,
	type ImportFromDriveInput,
} from "../api/files";

export type { UploadedFile, ListFilesQuery, ImportFromDriveInput };

/**
 * Hook for fetching files list with optional search filter
 */
export function useFilesQuery(params: ListFilesQuery = {}) {
	const { data, isLoading, error, refetch } = useGetFiles(params);

	return {
		files: data?.files || [],
		isLoading,
		error,
		refetch,
	};
}

/**
 * Hook for uploading files with toast notifications
 */
export function useUploadMutation(options?: {
	onSuccess?: (data: UploadedFile, variables: UploadFileFormData) => void | Promise<void>;
}) {
	const queryClient = useQueryClient();

	return useUploadFile(
		withMutationCallbacks(queryClient, options, {
			onSuccess: async (queryClient, _data, _variables) => {
				// Invalidate files query
				await queryClient.invalidateQueries({ queryKey: ["files"] });
				toast.success("File uploaded successfully");
			},
			onError: (queryClient, error) => {
				toastApiError(error, "Upload failed");
			},
		})
	);
}

/**
 * Hook for importing files from Google Drive
 */
export function useImportFromDriveMutation(options?: {
	onSuccess?: (data: UploadedFile, variables: ImportFromDriveInput) => void | Promise<void>;
}) {
	const queryClient = useQueryClient();

	return useImportFromDrive(
		withMutationCallbacks(queryClient, options, {
			onSuccess: async (queryClient, data, _variables) => {
				// Invalidate files query
				await queryClient.invalidateQueries({ queryKey: ["files"] });
				toast.success(`Imported "${data.filename}" from Google Drive`);
			},
			onError: (queryClient, error) => {
				toastApiError(error, "Import from Drive failed");
			},
		})
	);
}

/**
 * Hook for deleting files with confirmation
 */
export function useDeleteMutation(options?: {
	onSuccess?: (data: { success: boolean }, variables: string) => void | Promise<void>;
}) {
	const queryClient = useQueryClient();

	return useDeleteFile(
		withMutationCallbacks(queryClient, options, {
			onSuccess: async (queryClient, _data, _variables) => {
				// Invalidate files query
				await queryClient.invalidateQueries({ queryKey: ["files"] });
				toast.success("File deleted");
			},
			onError: (queryClient, error) => {
				toastApiError(error, "Delete failed");
			},
		})
	);
}

/**
 * Hook for scanning file usage in blog posts
 */
export function useScanUsageMutation(options?: {
	onSuccess?: (data: { scanned: number; updated: number }) => void | Promise<void>;
}) {
	const queryClient = useQueryClient();

	return useScanUsage(
		withMutationCallbacks(queryClient, options, {
			onSuccess: async (queryClient, data) => {
				// Invalidate files query to refresh usage counts
				await queryClient.invalidateQueries({ queryKey: ["files"] });
				toast.success(`Scanned ${data.scanned} posts, updated ${data.updated} file references`);
			},
			onError: (queryClient, error) => {
				toastApiError(error, "Usage scan failed");
			},
		})
	);
}
