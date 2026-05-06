import { createRoute, z } from "@hono/zod-openapi";
import { openApiStandardErrors } from "./common";
import { commentSchema as commentInputSchema } from "../commentSchema";

/**
 * Comment response schema (database record).
 * Note: This is different from commentInputSchema which is for user input.
 */
export const commentSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  nickname: z.string().nullable(),
  avatar: z.string().nullable(),
  content: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const listCommentsRoute = createRoute({
  method: "get",
  path: "/{targetType}/{targetId}",
  request: {
    params: z.object({
      targetType: z.enum(["post", "event", "doc"]),
      targetId: z.string(),
    }),
  },
  responses: {
    200: {
      description: "List comments for a target",
      content: {
        "application/json": {
          schema: z.object({
            comments: z.array(commentSchema),
            authenticated: z.boolean(),
            role: z.string().nullable(),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

export const submitCommentRoute = createRoute({
  method: "post",
  path: "/{targetType}/{targetId}",
  request: {
    params: z.object({
      targetType: z.enum(["post", "event", "doc"]),
      targetId: z.string(),
    }),
    body: {
      content: { "application/json": { schema: commentInputSchema } },
    },
  },
  responses: {
    200: {
      description: "Submit a new comment",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const updateCommentRoute = createRoute({
  method: "patch",
  path: "/{id}",
  request: {
    params: z.object({
      id: z.string(),
    }),
    body: {
      content: { "application/json": { schema: commentInputSchema } },
    },
  },
  responses: {
    200: {
      description: "Update an existing comment",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const deleteCommentRoute = createRoute({
  method: "delete",
  path: "/{id}",
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      description: "Delete a comment",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});
