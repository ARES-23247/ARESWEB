import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";
import { commentSchema as commentInputSchema } from "../schemas/commentSchema";
import { selectCommentSchema } from "../db/schema-zod";
import { toCamelCaseResponse } from "../db/schema-openapi";

// Response schema derived from Drizzle selectCommentSchema
export const commentSchema = toCamelCaseResponse(
  selectCommentSchema.pick({
    id: true,
    targetType: true,
    targetId: true,
    userId: true,
    content: true,
    createdAt: true,
    updatedAt: true,
  })
).extend({
  nickname: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
}).openapi({
  example: {
    id: "abc123",
    targetType: "post",
    targetId: "post-123",
    userId: "user-456",
    nickname: "John Doe",
    avatar: "/avatars/john.jpg",
    content: "Great post!",
    createdAt: "2025-01-15T10:00:00Z",
    updatedAt: "2025-01-15T10:00:00Z",
  },
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
