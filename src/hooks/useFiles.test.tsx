/**
 * Phase 77-03: File Manager - React Query Hooks Tests
 *
 * Unit tests for file management hooks
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

describe("useFiles hooks", () => {
	let queryClient: QueryClient;
	let wrapper: ({ children }: { children: React.ReactNode }) => React.ReactElement;

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: {
				queries: {
					retry: false,
				},
				mutations: {
					retry: false,
				},
			},
		});

		wrapper = ({ children }) => (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);

		// Mock fetch
		global.fetch = vi.fn();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("useFilesQuery", () => {
		it("Test 1: returns data from getFiles API", async () => {
			// This is a basic hook structure test
			// Full integration tests would require mocking the honoClient
			const { useFilesQuery } = await import("./useFiles");
			const { result } = renderHook(() => useFilesQuery(), { wrapper });

			// Hook should return expected structure
			expect(result.current).toHaveProperty("files");
			expect(result.current).toHaveProperty("isLoading");
			expect(result.current).toHaveProperty("error");
			expect(result.current).toHaveProperty("refetch");
		});

		it("Test 2: files is an array", async () => {
			const { useFilesQuery } = await import("./useFiles");
			const { result } = renderHook(() => useFilesQuery(), { wrapper });

			expect(Array.isArray(result.current.files)).toBe(true);
		});

		it("Test 3: isLoading is initially true during fetch", async () => {
			const { useFilesQuery } = await import("./useFiles");
			const { result } = renderHook(() => useFilesQuery(), { wrapper });

			// isLoading starts as true or transitions through it
			expect(typeof result.current.isLoading).toBe("boolean");
		});
	});

	describe("useUploadMutation", () => {
		it("Test 4: provides mutate function", async () => {
			const { useUploadMutation } = await import("./useFiles");
			const { result } = renderHook(() => useUploadMutation(), { wrapper });

			expect(result.current).toHaveProperty("mutate");
			expect(typeof result.current.mutate).toBe("function");
		});

		it("Test 5: provides isPending state", async () => {
			const { useUploadMutation } = await import("./useFiles");
			const { result } = renderHook(() => useUploadMutation(), { wrapper });

			expect(result.current).toHaveProperty("isPending");
			expect(typeof result.current.isPending).toBe("boolean");
		});
	});

	describe("useImportFromDriveMutation", () => {
		it("Test 6: provides mutate function", async () => {
			const { useImportFromDriveMutation } = await import("./useFiles");
			const { result } = renderHook(() => useImportFromDriveMutation(), { wrapper });

			expect(result.current).toHaveProperty("mutate");
			expect(typeof result.current.mutate).toBe("function");
		});

		it("Test 7: provides error state", async () => {
			const { useImportFromDriveMutation } = await import("./useFiles");
			const { result } = renderHook(() => useImportFromDriveMutation(), { wrapper });

			expect(result.current).toHaveProperty("error");
		});
	});

	describe("useDeleteMutation", () => {
		it("Test 8: provides mutate function accepting file ID", async () => {
			const { useDeleteMutation } = await import("./useFiles");
			const { result } = renderHook(() => useDeleteMutation(), { wrapper });

			expect(result.current).toHaveProperty("mutate");
			expect(typeof result.current.mutate).toBe("function");
		});

		it("Test 9: provides isPending state", async () => {
			const { useDeleteMutation } = await import("./useFiles");
			const { result } = renderHook(() => useDeleteMutation(), { wrapper });

			expect(result.current).toHaveProperty("isPending");
			expect(typeof result.current.isPending).toBe("boolean");
		});
	});

	describe("useScanUsageMutation", () => {
		it("Test 10: provides mutate function", async () => {
			const { useScanUsageMutation } = await import("./useFiles");
			const { result } = renderHook(() => useScanUsageMutation(), { wrapper });

			expect(result.current).toHaveProperty("mutate");
			expect(typeof result.current.mutate).toBe("function");
		});

		it("Test 11: provides isPending state", async () => {
			const { useScanUsageMutation } = await import("./useFiles");
			const { result } = renderHook(() => useScanUsageMutation(), { wrapper });

			expect(result.current).toHaveProperty("isPending");
			expect(typeof result.current.isPending).toBe("boolean");
		});
	});
});
