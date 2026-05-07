import { createRoute, z } from "@hono/zod-openapi";
import { openApiStandardErrors } from "./common";
import { postSchema } from "../postSchema";

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

export const getPostsRoute = createRoute({
  method: "get",
  path: "/",
  request: {
    query: z.object({
      q: z.string().optional(),
      limit: z.coerce.number().optional(),
      offset: z.coerce.number().optional(),
    }),
  },
  responses: {
    200: {
      description: "Get all public blog posts",
      content: { "application/json": { schema: z.object({ posts: z.array(postResponseSchema) }) } },
    },
    ...openApiStandardErrors,
  },
});

export const getAdminPostsRoute = createRoute({
  method: "get",
  path: "/admin/list",
  request: {
    query: z.object({
      limit: z.coerce.number().optional(),
      offset: z.coerce.number().optional(),
    }),
  },
  responses: {
    200: {
      description: "Get all posts (admin view)",
      content: { "application/json": { schema: z.object({ posts: z.array(postResponseSchema) }) } },
    },
    ...openApiStandardErrors,
  },
});

export const getAdminPostRoute = createRoute({
  method: "get",
  path: "/admin/{slug}",
  request: {
    params: z.object({ slug: z.string() }),
  },
  responses: {
    200: {
      description: "Get a single post for admin editing",
      content: { "application/json": { schema: z.object({ post: postDetailSchema }) } },
    },
    ...openApiStandardErrors,
  },
});

export const getPostRoute = createRoute({
  method: "get",
  path: "/{slug}",
  request: {
    params: z.object({ slug: z.string() }),
  },
  responses: {
    200: {
      description: "Get a single post by slug",
      content: {
        "application/json": {
          schema: z.object({
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
      },
    },
    ...openApiStandardErrors,
  },
});

export const savePostRoute = createRoute({
  method: "post",
  path: "/admin/save",
  request: {
    body: {
      content: { "application/json": { schema: postSchema } },
    },
  },
  responses: {
    200: {
      description: "Create or update a post",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            slug: z.string().optional(),
            warning: z.string().optional(),
          }),
        },
      },
    },
    409: {
      description: "Conflict",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const updatePostRoute = createRoute({
  method: "post",
  path: "/admin/{slug}",
  request: {
    params: z.object({ slug: z.string() }),
    body: {
      content: { "application/json": { schema: postSchema } },
    },
  },
  responses: {
    200: {
      description: "Update an existing post",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            slug: z.string().optional(),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

export const deletePostRoute = createRoute({
  method: "delete",
  path: "/admin/{slug}",
  request: {
    params: z.object({ slug: z.string() }),
  },
  responses: {
    200: {
      description: "Soft-delete a post",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const undeletePostRoute = createRoute({
  method: "post",
  path: "/admin/{slug}/undelete",
  request: {
    params: z.object({ slug: z.string() }),
  },
  responses: {
    200: {
      description: "Restore a soft-deleted post",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const purgePostRoute = createRoute({
  method: "delete",
  path: "/admin/{slug}/purge",
  request: {
    params: z.object({ slug: z.string() }),
  },
  responses: {
    200: {
      description: "Permanently delete a post",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const approvePostRoute = createRoute({
  method: "post",
  path: "/admin/{slug}/approve",
  request: {
    params: z.object({ slug: z.string() }),
  },
  responses: {
    200: {
      description: "Approve a pending post",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            warnings: z.array(z.string()).optional(),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

export const rejectPostRoute = createRoute({
  method: "post",
  path: "/admin/{slug}/reject",
  request: {
    params: z.object({ slug: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            reason: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Reject a pending post",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const getPostHistoryRoute = createRoute({
  method: "get",
  path: "/admin/{slug}/history",
  request: {
    params: z.object({ slug: z.string() }),
  },
  responses: {
    200: {
      description: "Get revision history for a post",
      content: { "application/json": { schema: z.object({ history: z.array(postHistorySchema) }) } },
    },
    ...openApiStandardErrors,
  },
});

export const restorePostHistoryRoute = createRoute({
  method: "post",
  path: "/admin/{slug}/history/{id}/restore",
  request: {
    params: z.object({ slug: z.string(), id: z.string() }),
  },
  responses: {
    200: {
      description: "Restore a post to a specific revision",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const repushSocialsRoute = createRoute({
  method: "post",
  path: "/admin/{slug}/repush",
  request: {
    params: z.object({ slug: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            socials: z.array(z.string()).optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Re-broadcast post to social media",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    502: {
      description: "Bad Gateway",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
    ...openApiStandardErrors,
  },
});
