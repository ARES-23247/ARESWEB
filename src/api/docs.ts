/**
 * Docs API - Documentation, Knowledge Base
 *
 * Types imported from backend route definitions in @shared/schemas/docs.ts
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { z } from "zod";
import { client, unwrapResponse } from "./honoClient";
import {
  DocResponseSchema,
  DocDetailResponseSchema,
  ContributorSchema,
  SearchResultSchema,
  DocHistorySchema,
  DocSchema,
} from "@shared/schemas/docs";

// Infer TypeScript types from Zod schemas
export type Doc = z.infer<typeof DocResponseSchema>;
export type DocDetail = z.infer<typeof DocDetailResponseSchema>;
export type Contributor = z.infer<typeof ContributorSchema>;
export type DocSearchResult = z.infer<typeof SearchResultSchema>;
export type DocHistory = z.infer<typeof DocHistorySchema>;
export type DocRecord = Doc;
export type DocPayload = z.input<typeof DocSchema>;

export interface DocsResponse {
  docs: Doc[];
}

export interface DocListResponse {
  docs: Doc[];
}

export interface DocDetailWithContributors {
  doc: DocDetail;
  contributors: Contributor[];
}

export interface DocSearchResponse {
  results: SearchResult[];
}

export interface DocHistoryResponse {
  history: DocHistory[];
}


// ============================================
// Public Docs
// ============================================

/**
 * GET /api/docs - Get all docs
 */
export function useGetAllDocs(
  options?: Omit<UseQueryOptions<DocsResponse>, "queryKey" | "queryFn">
) {
  return useQuery<DocsResponse>({
    queryKey: ["docs"],
    queryFn: async () => {
      const response = await client.docs.$get();
      return unwrapResponse<DocsResponse>(response);
    },
    ...options,
  });
}

/**
 * GET /api/docs/:slug - Get single doc with contributors
 */
export function useGetDocWithContributors(
  slug: string,
  options?: Omit<UseQueryOptions<DocDetailWithContributors>, "queryKey" | "queryFn" | "enabled">
) {
  return useQuery<DocDetailWithContributors>({
    queryKey: ["docs", slug],
    queryFn: async () => {
      const response = await client.docs[":slug"].$get({ param: { slug } });
      return unwrapResponse<DocDetailWithContributors>(response);
    },
    enabled: !!slug,
    ...options,
  });
}

/**
 * GET /api/docs/search - Search docs
 */
export function useSearchDocs(
  query: string,
  options?: Omit<UseQueryOptions<DocSearchResponse>, "queryKey" | "queryFn" | "enabled">
) {
  return useQuery<DocSearchResponse>({
    queryKey: ["docs", "search", query],
    queryFn: async () => {
      const response = await client.docs.search.$get({ query: { q: query } });
      return unwrapResponse<DocSearchResponse>(response);
    },
    enabled: query.length >= 2,
    ...options,
  });
}

// ============================================
// Admin Docs
// ============================================

/**
 * GET /api/docs/admin/list - Get all docs (admin)
 */
export function useGetAdminDocs(
  options?: Omit<UseQueryOptions<DocListResponse>, "queryKey" | "queryFn">
) {
  return useQuery<DocListResponse>({
    queryKey: ["admin-docs"],
    queryFn: async () => {
      const response = await client.docs.admin.list.$get();
      return unwrapResponse<DocListResponse>(response);
    },
    ...options,
  });
}

/**
 * GET /api/docs/admin/:slug/detail - Get doc detail (admin)
 */
export function useGetAdminDocDetail(
  slug: string,
  options?: Omit<UseQueryOptions<{ doc: DocDetail }>, "queryKey" | "queryFn" | "enabled">
) {
  return useQuery<{ doc: DocDetail }>({
    queryKey: ["admin-doc-detail", slug],
    queryFn: async () => {
      const response = await client.docs.admin[":slug"].detail.$get({ param: { slug } });
      return unwrapResponse<{ doc: DocDetail }>(response);
    },
    enabled: !!slug,
    ...options,
  });
}

/**
 * POST /api/docs/admin/save - Save/create doc
 */
export function useSaveDoc(
  options?: Omit<UseMutationOptions<{ success: boolean; slug?: string }, Error, DocPayload>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; slug?: string }, Error, DocPayload>({
    mutationFn: async (data) => {
      const response = await client.docs.admin.save.$post({ json: data });
      return unwrapResponse<{ success: boolean; slug?: string }>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["docs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-docs"] });
    },
    ...options,
  });
}

/**
 * PATCH /api/docs/admin/:slug/sort - Update doc sort order
 */
export function useUpdateDocSort(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, { slug: string; sortOrder: number }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, { slug: string; sortOrder: number }>({
    mutationFn: async ({ slug, sortOrder }) => {
      const response = await client.docs.admin[":slug"].sort.$patch({ param: { slug }, json: { sortOrder } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["docs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-docs"] });
    },
    ...options,
  });
}

/**
 * POST /api/docs/:slug/feedback - Submit doc feedback
 */
export function useSubmitDocFeedback(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, { slug: string; data: { isHelpful: boolean; comment?: string; turnstileToken: string } }>, "mutationFn">
) {
  return useMutation<{ success: boolean }, Error, { slug: string; data: { isHelpful: boolean; comment?: string; turnstileToken: string } }>({
    mutationFn: async ({ slug, data }) => {
      const response = await client.docs[":slug"].feedback.$post({ param: { slug }, json: data });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...options,
  });
}

/**
 * GET /api/docs/admin/:slug/history - Get doc history
 */
export function useGetDocHistory(
  slug: string,
  options?: Omit<UseQueryOptions<DocHistoryResponse>, "queryKey" | "queryFn">
) {
  return useQuery<DocHistoryResponse>({
    queryKey: ["docs", "history", slug],
    queryFn: async () => {
      const response = await client.docs.admin[":slug"].history.$get({ param: { slug } });
      return unwrapResponse<DocHistoryResponse>(response);
    },
    enabled: !!slug,
    ...options,
  });
}

/**
 * PATCH /api/docs/admin/:slug/history/:id/restore - Restore doc from history
 */
export function useRestoreDocHistory(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, { slug: string; id: number }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, { slug: string; id: number }>({
    mutationFn: async ({ slug, id }) => {
      const response = await client.docs.admin[":slug"].history[":id"].restore.$patch({ param: { slug, id } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["docs", variables.slug] });
      queryClient.invalidateQueries({ queryKey: ["docs", "history", variables.slug] });
    },
    ...options,
  });
}

/**
 * POST /api/docs/admin/:slug/approve - Approve doc
 */
export function useApproveDoc(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, string>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (slug) => {
      const response = await client.docs.admin[":slug"].approve.$post({ param: { slug } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["docs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-docs"] });
    },
    ...options,
  });
}

/**
 * POST /api/docs/admin/:slug/reject - Reject doc
 */
export function useRejectDoc(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, { slug: string; reason?: string }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, { slug: string; reason?: string }>({
    mutationFn: async ({ slug, reason }) => {
      const response = await client.docs.admin[":slug"].reject.$post({ param: { slug }, json: { reason } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["docs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-docs"] });
    },
    ...options,
  });
}

/**
 * DELETE /api/docs/admin/:slug - Delete doc
 */
export function useDeleteDoc(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, string>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (slug) => {
      const response = await client.docs.admin[":slug"].$delete({ param: { slug } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["docs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-docs"] });
    },
    ...options,
  });
}

/**
 * POST /api/docs/admin/:slug/undelete - Restore doc
 */
export function useUndeleteDoc(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, string>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (slug) => {
      const response = await client.docs.admin[":slug"].undelete.$post({ param: { slug } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["docs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-docs"] });
    },
    ...options,
  });
}

/**
 * POST /api/docs/admin/:slug/purge - Purge doc permanently
 */
export function usePurgeDoc(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, string>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (slug) => {
      const response = await client.docs.admin[":slug"].purge.$post({ param: { slug } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["docs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-docs"] });
    },
    ...options,
  });
}

// ============================================
// Export Docs (Legacy - using fetchJson until backend routes are added)
// ============================================

/**
 * GET /api/docs/admin/export - Export all docs as JSON
 * @deprecated Using legacy fetch until export route is added to OpenAPI spec
 */
export function useExportAllDocs(
  options?: Omit<UseMutationOptions<unknown, Error, void>, "mutationFn">
) {
  return useMutation<unknown, Error, void>({
    mutationFn: async () => {
      // Temporary fallback using fetch until backend route is migrated
      const res = await fetch("/api/docs/admin/export");
      if (!res.ok) throw new Error("Failed to export docs");
      return res.json();
    },
    ...options,
  });
}

/**
 * GET /api/docs/admin/:slug/export - Export single doc as Markdown
 * @deprecated Using legacy fetch until export route is added to OpenAPI spec
 */
export function useExportSingleDoc(
  options?: Omit<UseMutationOptions<string, Error, string>, "mutationFn">
) {
  return useMutation<string, Error, string>({
    mutationFn: async (slug) => {
      // Temporary fallback using fetch until backend route is migrated
      const res = await fetch(`/api/docs/admin/${slug}/export`);
      if (!res.ok) throw new Error("Failed to export doc");
      return res.text();
    },
    ...options,
  });
}
