import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";
import { commentSchema as commentInputSchema } from "../commentSchema";

// Convert standardErrors to OpenAPI responses format
const openApiErrorResponses = {
  400: { content: { "application/json": { schema: standardErrors[400] } }, description: "Bad Request" },
  401: { content: { "application/json": { schema: standardErrors[401] } }, description: "Unauthorized" },
  403: { content: { "application/json": { schema: standardErrors[403] } }, description: "Forbidden" },
  404: { content: { "application/json": { schema: standardErrors[404] } }, description: "Not Found" },
  500: { content: { "application/json": { schema: standardErrors[500] } }, description: "Internal Server Error" },
};

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
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            comments: z.array(commentSchema),
            authenticated: z.boolean(),
            role: z.string().nullable(),
          }),
        },
      },
      description: "List comments for a target",
    },
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
      content: {
        "application/json": {
          schema: commentInputSchema,
        },
      },
    },
  },
  responses: {
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Submit a new comment",
    },
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
      content: {
        "application/json": {
          schema: commentInputSchema,
        },
      },
    },
  },
  responses: {
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Update an existing comment",
    },
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
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Delete a comment",
    },
  },
});
