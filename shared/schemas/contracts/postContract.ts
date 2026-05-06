import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { standardErrors } from "./common";
import { postSchema } from "../postSchema";

const c = initContract();

export const postResponseSchema = z.object({
  slug: z.string(),
  title: z.string(),
  date: z.string().nullish(),
  snippet: z.string().nullish(),
  thumbnail: z.string().nullish(),
  status: z.string().nullish(),
  author: z.string().nullish(),
  author_nickname: z.string().nullish(),
  author_avatar: z.string().nullish(),
  published_at: z.string().nullish(),
  season_id: z.coerce.number().nullish(),
  is_deleted: z.number().nullish(),
  is_portfolio: z.number().optional(),
  zulip_stream: z.string().nullable().optional(),
  zulip_topic: z.string().nullable().optional()
});

export const postDetailSchema = postResponseSchema.extend({
  ast: z.string(),
});

export const postHistorySchema = z.object({
  id: z.coerce.number(),
  slug: z.string(),
  title: z.string(),
  author: z.string().nullable(),
  thumbnail: z.string().nullable(),
  snippet: z.string().nullable(),
  ast: z.string(),
  created_at: z.string(),
});

export const postContract = c.router({
  getPosts: {
    method: "GET",
    path: "/",
    query: z.object({
      q: z.string().optional(),
      limit: z.coerce.number().optional(),
      offset: z.coerce.number().optional(),
    }),
    responses: {
      ...standardErrors,
      200: z.object({
        posts: z.array(postResponseSchema),
      }),
    },
    summary: "Get all public blog posts",
  },
  getAdminPosts: {
    method: "GET",
    path: "/admin/list",
    query: z.object({
      limit: z.coerce.number().optional(),
      offset: z.coerce.number().optional(),
    }),
    responses: {
      ...standardErrors,
      200: z.object({
        posts: z.array(postResponseSchema),
      }),
    },
    summary: "Get all posts (admin view)",
  },
  getAdminPost: {
    method: "GET",
    path: "/admin/:slug",
    responses: {
      ...standardErrors,
      200: z.object({
        post: postDetailSchema,
      }),
    },
    summary: "Get a single post for admin editing",
  },
  getPost: {
    method: "GET",
    path: "/:slug",
    responses: {
      ...standardErrors,
      200: z.object({
        post: postDetailSchema,
        is_editor: z.boolean(),
        author: z
          .object({
            id: z.string(),
            name: z.string().nullable(),
            image: z.string().nullable(),
            role: z.string(),
          })
          .optional(),
      }),
    },
    summary: "Get a single post by slug",
  },
  savePost: {
    method: "POST",
    path: "/admin/save",
    body: postSchema,
    responses: {
      ...standardErrors,
      200: z.object({
        success: z.boolean(),
        slug: z.string().optional(),
        warning: z.string().optional(),
      }),
      409: z.object({ error: z.string() }),
    },
    summary: "Create or update a post",
  },
  updatePost: {
    method: "POST",
    path: "/admin/:slug",
      pathParams: z.object({ slug: z.string() }),
    body: postSchema,
    responses: {
      ...standardErrors,
      200: z.object({
        success: z.boolean(),
        slug: z.string().optional(),
      }),
    },
    summary: "Update an existing post",
  },
  deletePost: {
    method: "DELETE",
    path: "/admin/:slug",
      pathParams: z.object({ slug: z.string() }),
    body: c.noBody(),
    responses: {
      ...standardErrors,
      200: z.object({ success: z.boolean() }),
    },
    summary: "Soft-delete a post",
  },
  undeletePost: {
    method: "POST",
    path: "/admin/:slug/undelete",
      pathParams: z.object({ slug: z.string() }),
    body: c.noBody(),
    responses: {
      ...standardErrors,
      200: z.object({ success: z.boolean() }),
    },
    summary: "Restore a soft-deleted post",
  },
  purgePost: {
    method: "DELETE",
    path: "/admin/:slug/purge",
    body: c.noBody(),
    responses: {
      ...standardErrors,
      200: z.object({ success: z.boolean() }),
    },
    summary: "Permanently delete a post",
  },
  approvePost: {
    method: "POST",
    path: "/admin/:slug/approve",
    body: c.noBody(),
    responses: {
      ...standardErrors,
      200: z.object({
        success: z.boolean(),
        warnings: z.array(z.string()).optional(),
      }),
    },
    summary: "Approve a pending post",
  },
  rejectPost: {
    method: "POST",
    path: "/admin/:slug/reject",
    body: z.object({
      reason: z.string().optional(),
    }),
    responses: {
      ...standardErrors,
      200: z.object({ success: z.boolean() }),
    },
    summary: "Reject a pending post",
  },
  getPostHistory: {
    method: "GET",
    path: "/admin/:slug/history",
    responses: {
      ...standardErrors,
      200: z.object({ history: z.array(postHistorySchema) }),
    },
    summary: "Get revision history for a post",
  },
  restorePostHistory: {
    method: "POST",
    path: "/admin/:slug/history/:id/restore",
    body: c.noBody(),
    responses: {
      ...standardErrors,
      200: z.object({ success: z.boolean() }),
    },
    summary: "Restore a post to a specific revision",
  },
  repushSocials: {
    method: "POST",
    path: "/admin/:slug/repush",
    body: z.object({
      socials: z.array(z.string()).optional(),
    }),
    responses: {
      ...standardErrors,
      200: z.object({ success: z.boolean() }),
      502: z.object({ error: z.string() }),
    },
    summary: "Re-broadcast post to social media",
  },
});
export type PostContract = typeof postContract;
