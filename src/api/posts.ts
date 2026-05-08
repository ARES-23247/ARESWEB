/**
 * Posts API - Blog Posts
 *
 * Types imported from backend route definitions in @shared/routes/posts.ts
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { z } from "zod";
import { client, unwrapResponse } from "./honoClient";
import { postSchema, postResponseSchema, postDetailSchema, postHistorySchema, authorSchema } from "@shared/routes/posts";

// Infer TypeScript types from Zod schemas
export type PostPayload = z.input<typeof postSchema>;
export type Post = z.infer<typeof postResponseSchema>;
export type PostDetail = z.infer<typeof postDetailSchema>;
export type PostHistory = z.infer<typeof postHistorySchema>;
export type PostAuthor = z.infer<typeof authorSchema>;

export interface PostsResponse {
  posts: Post[];
}

export interface PostDetailResponse {
  post: PostDetail;
  is_editor?: boolean;
  author?: PostAuthor;
}

export interface PostHistoryResponse {
  history: PostHistory[];
}

export interface SavePostResponse {
  success: boolean;
  slug?: string;
  warning?: string;
}

export interface UpdatePostResponse {
  success: boolean;
  slug?: string;
  warning?: string;
}


// ============================================
// Public Posts
// ============================================

/**
 * GET /api/posts - Get all public blog posts
 */
export function useGetPosts(
  query?: { q?: string; limit?: number; offset?: number },
  options?: Omit<UseQueryOptions<PostsResponse>, "queryKey" | "queryFn">
) {
  return useQuery<PostsResponse>({
    queryKey: ["posts", query],
    queryFn: async () => {
      const response = await client.posts.$get({ query });
      return unwrapResponse<PostsResponse>(response);
    },
    ...options,
  });
}

/**
 * GET /api/posts/:slug - Get a single post by slug
 */
export function useGetPost(
  slug: string,
  options?: Omit<UseQueryOptions<PostDetailResponse>, "queryKey" | "queryFn" | "enabled">
) {
  return useQuery<PostDetailResponse>({
    queryKey: ["post", slug],
    queryFn: async () => {
      const response = await client.posts[":slug"].$get({ param: { slug } });
      return unwrapResponse<PostDetailResponse>(response);
    },
    enabled: !!slug,
    ...options,
  });
}

// ============================================
// Admin Posts
// ============================================

/**
 * GET /api/posts/admin/list - Get all posts (admin view)
 */
export function useGetAdminPosts(
  query?: { limit?: number; offset?: number },
  options?: Omit<UseQueryOptions<PostsResponse>, "queryKey" | "queryFn">
) {
  return useQuery<PostsResponse>({
    queryKey: ["admin_posts", query],
    queryFn: async () => {
      const response = await client.posts.admin.list.$get({ query });
      return unwrapResponse<PostsResponse>(response);
    },
    ...options,
  });
}

/**
 * GET /api/posts/admin/:slug - Get a single post for admin editing
 */
export function useGetAdminPost(
  slug: string,
  options?: Omit<UseQueryOptions<{ post: PostDetail }>, "queryKey" | "queryFn" | "enabled">
) {
  return useQuery<{ post: PostDetail }>({
    queryKey: ["admin_post_detail", slug],
    queryFn: async () => {
      const response = await client.posts.admin[":slug"].$get({ param: { slug } });
      return unwrapResponse<{ post: PostDetail }>(response);
    },
    enabled: !!slug,
    ...options,
  });
}

/**
 * POST /api/posts/admin/save - Create or update a post
 */
export function useSavePost(
  options?: Omit<UseMutationOptions<SavePostResponse, Error, PostPayload>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<SavePostResponse, Error, PostPayload>({
    mutationFn: async (data) => {
      const response = await client.posts.admin.save.$post({ json: data });
      return unwrapResponse<SavePostResponse>(response);
    },
    ...options,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["admin_posts"] });
      options?.onSuccess?.();
    }
  });
}

/**
 * POST /api/posts/admin/:slug - Update an existing post
 */
export function useUpdatePost(
  options?: Omit<UseMutationOptions<UpdatePostResponse, Error, { slug: string; body: PostPayload }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<UpdatePostResponse, Error, { slug: string; body: PostPayload }>({
    mutationFn: async ({ slug, body }) => {
      const response = await client.posts.admin[":slug"].$post({ param: { slug }, json: body });
      return unwrapResponse<UpdatePostResponse>(response);
    },
    ...options,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["admin_posts"] });
      if (variables.slug) {
        queryClient.invalidateQueries({ queryKey: ["post", variables.slug] });
        queryClient.invalidateQueries({ queryKey: ["admin_post_detail", variables.slug] });
      }
      options?.onSuccess?.(_data, variables);
    }
  });
}

/**
 * DELETE /api/posts/admin/:slug - Soft-delete a post
 */
export function useDeletePost(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, string>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (slug) => {
      const response = await client.posts.admin[":slug"].$delete({ param: { slug } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...options,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["admin_posts"] });
      options?.onSuccess?.();
    }
  });
}

/**
 * POST /api/posts/admin/:slug/undelete - Restore post
 */
export function useUndeletePost(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, string>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (slug) => {
      const response = await client.posts.admin[":slug"].undelete.$post({ param: { slug } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...options,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["admin_posts"] });
      options?.onSuccess?.();
    }
  });
}

/**
 * DELETE /api/posts/admin/:slug/purge - Purge post permanently
 */
export function usePurgePost(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, string>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (slug) => {
      const response = await client.posts.admin[":slug"].purge.$delete({ param: { slug } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...options,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["admin_posts"] });
      options?.onSuccess?.();
    }
  });
}

/**
 * POST /api/posts/admin/:slug/approve - Approve post
 */
export function useApprovePost(
  options?: Omit<UseMutationOptions<{ success: boolean; warnings?: string[] }, Error, string>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; warnings?: string[] }, Error, string>({
    mutationFn: async (slug) => {
      const response = await client.posts.admin[":slug"].approve.$post({ param: { slug } });
      return unwrapResponse<{ success: boolean; warnings?: string[] }>(response);
    },
    ...options,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["admin_posts"] });
      options?.onSuccess?.();
    }
  });
}

/**
 * POST /api/posts/admin/:slug/reject - Reject post
 */
export function useRejectPost(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, { slug: string; reason?: string }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, { slug: string; reason?: string }>({
    mutationFn: async ({ slug, reason }) => {
      const response = await client.posts.admin[":slug"].reject.$post({ param: { slug }, json: { reason } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...options,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["admin_posts"] });
      options?.onSuccess?.();
    }
  });
}

/**
 * GET /api/posts/admin/:slug/history - Get post revision history
 */
export function useGetPostHistory(
  slug: string,
  options?: Omit<UseQueryOptions<PostHistoryResponse>, "queryKey" | "queryFn">
) {
  return useQuery<PostHistoryResponse>({
    queryKey: ["posts", "history", slug],
    queryFn: async () => {
      const response = await client.posts.admin[":slug"].history.$get({ param: { slug } });
      return unwrapResponse<PostHistoryResponse>(response);
    },
    enabled: !!slug,
    ...options,
  });
}

/**
 * POST /api/posts/admin/:slug/history/:id/restore - Restore post from history
 */
export function useRestorePostHistory(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, { slug: string; id: string }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, { slug: string; id: string }>({
    mutationFn: async ({ slug, id }) => {
      const response = await client.posts.admin[":slug"].history[":id"].restore.$post({ param: { slug, id } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...options,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["post", variables.slug] });
      queryClient.invalidateQueries({ queryKey: ["posts", "history", variables.slug] });
      options?.onSuccess?.(_data, variables);
    }
  });
}

/**
 * POST /api/posts/admin/:slug/repush - Repush to social media
 */
export function useRepushPost(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, { slug: string; socials?: string[] }>, "mutationFn">
) {
  return useMutation<{ success: boolean }, Error, { slug: string; socials?: string[] }>({
    mutationFn: async ({ slug, socials }) => {
      const response = await client.posts.admin[":slug"].repush.$post({ param: { slug }, json: { socials } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...options,
  });
}
