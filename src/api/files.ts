/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * File Manager API - Document Upload, Download, Management
 *
 * Types imported from backend route definitions in @shared/routes/files.ts
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { z } from "zod";
import { client, unwrapResponse, wrapOnSuccess } from "./honoClient";
import { uploadedFileSchema } from "@shared/routes/files";

// Infer TypeScript types from Zod schemas
export type UploadedFile = z.infer<typeof uploadedFileSchema>;

export interface FilesResponse {
	files: UploadedFile[];
}

export interface ListFilesQuery {
	search?: string;
}

export interface UploadFileInput {
	file: File;
	title?: string;
	description?: string;
}

export interface ImportFromDriveInput {
	fileId: string;
	fileName: string;
	mimeType: string;
}

export interface ScanUsageResponse {
	scanned: number;
	updated: number;
}

/**
 * Wrapper type for FormData to ensure type safety with Hono client.
 */
export class UploadFileFormData {
	constructor(public readonly data: FormData) {}
}

// ============================================
// Files
// ============================================

/**
 * GET /api/files/ - List uploaded files with optional search filter
 */
export function useGetFiles(
	params: ListFilesQuery = {},
	options?: Omit<UseQueryOptions<FilesResponse>, "queryKey" | "queryFn">
) {
	return useQuery<FilesResponse>({
		queryKey: ["files", params.search],
		queryFn: async () => {
			const response = await client.files.$get({
				query: params,
			});
			return unwrapResponse<FilesResponse>(response);
		},
		...options,
	});
}

/**
 * POST /api/files/upload - Upload document file
 */
export function useUploadFile(
	options?: Omit<UseMutationOptions<UploadedFile, Error, UploadFileFormData>, "mutationFn">
) {
	const queryClient = useQueryClient();
	return useMutation<UploadedFile, Error, UploadFileFormData>({
		mutationFn: async (uploadFormData) => {
			const response = await client.files.upload.$post({
				form: {
					file: uploadFormData.data.get("file") as any,
					title: (uploadFormData.data.get("title") as string | undefined) || undefined,
					description: (uploadFormData.data.get("description") as string | undefined) || undefined,
				}
			});
			return unwrapResponse<UploadedFile>(response);
		},
		...wrapOnSuccess(options, (_data, _variables) => {
			queryClient.invalidateQueries({ queryKey: ["files"] });
		}),
	});
}

/**
 * POST /api/files/import-from-drive - Import file from Google Drive
 */
export function useImportFromDrive(
	options?: Omit<UseMutationOptions<UploadedFile, Error, ImportFromDriveInput>, "mutationFn">
) {
	const queryClient = useQueryClient();
	return useMutation<UploadedFile, Error, ImportFromDriveInput>({
		mutationFn: async (input) => {
			const response = await client.files["import-from-drive"].$post({
				json: {
					fileId: input.fileId,
					fileName: input.fileName,
					mimeType: input.mimeType,
				}
			});
			return unwrapResponse<UploadedFile>(response);
		},
		...wrapOnSuccess(options, (_data, _variables) => {
			queryClient.invalidateQueries({ queryKey: ["files"] });
		}),
	});
}

/**
 * DELETE /api/files/:id - Delete file
 */
export function useDeleteFile(
	options?: Omit<UseMutationOptions<{ success: boolean }, Error, string>, "mutationFn">
) {
	const queryClient = useQueryClient();
	return useMutation<{ success: boolean }, Error, string>({
		mutationFn: async (id) => {
			const response = await client.files[":id"].$delete({
				param: { id },
			});
			return unwrapResponse<{ success: boolean }>(response);
		},
		...wrapOnSuccess(options, (_data, _variables) => {
			queryClient.invalidateQueries({ queryKey: ["files"] });
		}),
	});
}

/**
 * POST /api/files/scan-usage - Scan blog posts for file references
 */
export function useScanUsage(
	options?: Omit<UseMutationOptions<ScanUsageResponse, Error, void>, "mutationFn">
) {
	const queryClient = useQueryClient();
	return useMutation<ScanUsageResponse, Error, void>({
		mutationFn: async () => {
			const response = await client.files["scan-usage"].$post({
				json: {},
			});
			return unwrapResponse<ScanUsageResponse>(response);
		},
		...wrapOnSuccess(options, (_data, _variables) => {
			queryClient.invalidateQueries({ queryKey: ["files"] });
		}),
	});
}
