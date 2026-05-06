import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";
import { commentSchema as commentInputSchema } from "../schemas/commentSchema";

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
    ...standardErrors,
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
  tags: ["comments"],
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
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Submit a new comment",
    },
  },
  tags: ["comments"],
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
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Update an existing comment",
    },
  },
  tags: ["comments"],
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
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Delete a comment",
    },
  },
  tags: ["comments"],
});
