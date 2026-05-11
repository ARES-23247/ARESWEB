import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";
import { titleField, slugField, descriptionField, MAX_INPUT_LENGTHS } from "../validation/constants";
import { selectPostSchema, selectPostHistorySchema } from "../db/schema-zod";
import { toCamelCaseResponse } from "../db/schema-openapi";

// Define a more specific schema for Tiptap AST nodes
const tiptapNodeSchema: z.ZodType<{
  type?: string;
  content?: unknown[];
  attrs?: Record<string, unknown>;
  marks?: unknown[];
  text?: string;
}> = z.object({
  type: z.string().optional(),
  content: z.array(z.lazy(() => tiptapNodeSchema)).optional(),
  attrs: z.record(z.string(), z.unknown()).optional(),
  marks: z.array(z.unknown()).optional(),
  text: z.string().optional(),
});

export const postSchema = z.object({
  title: titleField.openapi({ example: "Match Preview" }),
  slug: slugField.openapi({ example: "match-preview" }),
  thumbnail: z.string().max(255).optional().or(z.literal("")).openapi({ example: "/images/match.jpg" }),
  ast: tiptapNodeSchema.openapi({ description: "JSON AST from Tiptap editor" }),
  content: descriptionField.openapi({ description: "Plain text content for legacy support" }),
  category: z.string().max(100).optional().openapi({ example: "engineering" }),
  isPortfolio: z.boolean().optional().openapi({ example: false }),
  socials: z.record(z.string().max(255), z.boolean()).optional().openapi({ example: { twitter: true, bluesky: false } }),
  isDraft: z.boolean().optional().openapi({ example: false }),
  publishedAt: z.string().max(255).optional().openapi({ example: "2025-01-15T10:00:00Z" }),
  seasonId: z.union([z.string(), z.number()]).transform(v => v === "" ? undefined : Number(v)).optional().openapi({ example: 1 }),
}).refine(
  (data) => !data.content || data.content.length <= MAX_INPUT_LENGTHS.content,
  {
    message: `Content cannot exceed ${MAX_INPUT_LENGTHS.content} characters`,
    path: ["content"],
  }
);

// Response schema derived from Drizzle selectPostSchema with OpenAPI metadata
export const postResponseSchema = toCamelCaseResponse(
  selectPostSchema.pick({
    slug: true,
    title: true,
    date: true,
    snippet: true,
    thumbnail: true,
    status: true,
    author: true,
    cfEmail: true,
    authorAvatar: true,
    publishedAt: true,
    seasonId: true,
    isDeleted: true,
    isPortfolio: true,
    zulipStream: true,
    zulipTopic: true,
  })
).extend({
  authorNickname: z.string().nullable().optional(),
}).openapi({
  example: {
    slug: "match-preview",
    title: "Match Preview",
    date: "2025-01-15",
    snippet: "A preview of our upcoming match...",
    thumbnail: "/images/match.jpg",
    status: "published",
    author: "John Doe",
    cfEmail: null,
    authorAvatar: "/avatars/john.jpg",
    publishedAt: "2025-01-15T10:00:00Z",
    seasonId: 1,
    isDeleted: 0,
    isPortfolio: 0,
    zulipStream: "blog",
    zulipTopic: "Blog: Match Preview",
    authorNickname: "John",
  },
});

export const postDetailSchema = postResponseSchema.extend({
  ast: z.string().openapi({ example: '{"type":"doc","content":[]}', description: "JSON AST from Tiptap editor" }),
});

// History schema derived from Drizzle selectPostHistorySchema
export const postHistorySchema = toCamelCaseResponse(
  selectPostHistorySchema
).openapi({
  example: {
    id: 1,
    slug: "match-preview",
    title: "Match Preview",
    author: "John Doe",
    authorEmail: "john@example.com",
    thumbnail: "/images/match.jpg",
    snippet: "A preview of our upcoming match...",
    ast: '{"type":"doc","content":[]}',
    createdAt: "2025-01-15T10:00:00Z",
    seasonId: 1,
  },
});

export const authorSchema = z.object({
  id: z.string().openapi({ example: "123" }),
  name: z.string().nullable().optional().openapi({ example: "John Doe" }),
  image: z.string().nullable().optional(),
  role: z.string().openapi({ example: "author" }),
});

// Public Routes
export const getPostsRoute = createRoute({
  method: "get",
  path: "/",
  request: {
    query: z.object({
      q: z.string().optional().openapi({ example: "match" }),
      limit: z.coerce.number().optional().openapi({ example: 10 }),
      offset: z.coerce.number().optional().openapi({ example: 0 }),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            posts: z.array(postResponseSchema),
          }),
          example: {
            posts: [
              {
                slug: "match-preview-2025",
                title: "Competition Match Preview",
                date: "2025-01-15",
                snippet: "A preview of our upcoming competition match at the regional qualifier...",
                thumbnail: "/images/match-preview.jpg",
                status: "published",
                author: "Jane Doe",
                cfEmail: "jane@example.com",
                authorAvatar: "/avatars/jane.jpg",
                publishedAt: "2025-01-15T10:00:00Z",
                seasonId: 1,
                isDeleted: 0,
                isPortfolio: 1,
                zulipStream: "blog",
                zulipTopic: "Blog: Competition Match Preview",
              },
            ],
          },
        },
      },
      description: "List of public blog posts",
    },
  },
  tags: ["posts"],
});

export const getPostRoute = createRoute({
  method: "get",
  path: "/{slug}",
  request: {
    params: z.object({
      slug: z.string().openapi({ example: "match-preview" }),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            post: postDetailSchema,
            is_editor: z.boolean().openapi({ example: false }),
            author: authorSchema.optional(),
          }),
          example: {
            post: {
              slug: "match-preview",
              title: "Competition Match Preview",
              date: "2025-01-15",
              snippet: "A preview of our upcoming competition match...",
              thumbnail: "/images/match-preview.jpg",
              status: "published",
              author: "Jane Doe",
              cfEmail: "jane@example.com",
              authorAvatar: "/avatars/jane.jpg",
              publishedAt: "2025-01-15T10:00:00Z",
              seasonId: 1,
              isDeleted: 0,
              isPortfolio: 1,
              zulipStream: "blog",
              zulipTopic: "Blog: Competition Match Preview",
              ast: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Full post content here..."}]}]}',
            },
            is_editor: false,
            author: {
              id: "123",
              name: "Jane Doe",
              image: "/avatars/jane.jpg",
              role: "author",
            },
          },
        },
      },
      description: "Single blog post with author info",
    },
  },
  tags: ["posts"],
});

// Admin Routes
export const getAdminPostsRoute = createRoute({
  method: "get",
  path: "/admin/list",
  request: {
    query: z.object({
      limit: z.coerce.number().optional().openapi({ example: 50 }),
      offset: z.coerce.number().optional().openapi({ example: 0 }),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            posts: z.array(postResponseSchema),
          }),
        },
      },
      description: "List of all posts (admin view)",
    },
  },
  tags: ["posts", "admin"],
});

export const getAdminPostRoute = createRoute({
  method: "get",
  path: "/admin/{slug}",
  request: {
    params: z.object({
      slug: z.string().openapi({ example: "match-preview" }),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            post: postDetailSchema,
          }),
        },
      },
      description: "Single post for admin editing",
    },
  },
  tags: ["posts", "admin"],
});

export const savePostRoute = createRoute({
  method: "post",
  path: "/admin/save",
  request: {
    body: {
      content: {
        "application/json": {
          schema: postSchema,
          example: {
            title: "Competition Match Preview",
            slug: "match-preview",
            thumbnail: "/images/match-preview.jpg",
            ast: { type: "doc", content: [{ type: "paragraph" }] },
            content: "Full post content here...",
            category: "engineering",
            isPortfolio: true,
            socials: { twitter: true, bluesky: false },
            isDraft: false,
            publishedAt: "2025-01-15T10:00:00Z",
            seasonId: 1,
          },
        },
      },
    },
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            slug: z.string().optional(),
            warning: z.string().optional(),
          }),
          example: {
            success: true,
            slug: "match-preview",
          },
        },
      },
      description: "Post created successfully",
    },
    409: {
      content: {
        "application/json": {
          schema: z.object({ error: z.string() }),
          example: {
            error: "A post with this title already exists for today",
          },
        },
      },
      description: "Conflict - duplicate post",
    },
  },
  tags: ["posts", "admin"],
});

export const updatePostRoute = createRoute({
  method: "patch",
  path: "/admin/{slug}",
  request: {
    params: z.object({
      slug: z.string().openapi({ example: "match-preview" }),
    }),
    body: {
      content: {
        "application/json": {
          schema: postSchema,
        },
      },
    },
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            slug: z.string().optional(),
          }),
        },
      },
      description: "Post updated successfully",
    },
  },
  tags: ["posts", "admin"],
});

export const deletePostRoute = createRoute({
  method: "delete",
  path: "/admin/{slug}",
  request: {
    params: z.object({
      slug: z.string().openapi({ example: "match-preview" }),
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
      description: "Post soft-deleted",
    },
  },
  tags: ["posts", "admin"],
});

export const undeletePostRoute = createRoute({
  method: "post",
  path: "/admin/{slug}/undelete",
  request: {
    params: z.object({
      slug: z.string().openapi({ example: "match-preview" }),
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
      description: "Post restored",
    },
  },
  tags: ["posts", "admin"],
});

export const purgePostRoute = createRoute({
  method: "delete",
  path: "/admin/{slug}/purge",
  request: {
    params: z.object({
      slug: z.string().openapi({ example: "match-preview" }),
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
      description: "Post permanently deleted",
    },
  },
  tags: ["posts", "admin"],
});

export const approvePostRoute = createRoute({
  method: "post",
  path: "/admin/{slug}/approve",
  request: {
    params: z.object({
      slug: z.string().openapi({ example: "match-preview" }),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            warnings: z.array(z.string()).optional(),
          }),
        },
      },
      description: "Post approved",
    },
  },
  tags: ["posts", "admin"],
});

export const rejectPostRoute = createRoute({
  method: "post",
  path: "/admin/{slug}/reject",
  request: {
    params: z.object({
      slug: z.string().openapi({ example: "match-preview" }),
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            reason: z.string().optional().openapi({ example: "Needs more details" }),
          }),
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
      description: "Post rejected",
    },
  },
  tags: ["posts", "admin"],
});

export const getPostHistoryRoute = createRoute({
  method: "get",
  path: "/admin/{slug}/history",
  request: {
    params: z.object({
      slug: z.string().openapi({ example: "match-preview" }),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            history: z.array(postHistorySchema),
          }),
        },
      },
      description: "Post revision history",
    },
  },
  tags: ["posts", "admin"],
});

export const restorePostHistoryRoute = createRoute({
  method: "post",
  path: "/admin/{slug}/history/{id}/restore",
  request: {
    params: z.object({
      slug: z.string().openapi({ example: "match-preview" }),
      id: z.string().openapi({ example: "123" }),
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
      description: "Post restored to revision",
    },
  },
  tags: ["posts", "admin"],
});

export const repushSocialsRoute = createRoute({
  method: "post",
  path: "/admin/{slug}/repush",
  request: {
    params: z.object({
      slug: z.string().openapi({ example: "match-preview" }),
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            socials: z.array(z.string()).optional().openapi({ example: ["twitter", "bluesky"] }),
          }),
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
      description: "Social media repost queued",
    },
    502: {
      content: {
        "application/json": {
          schema: z.object({ error: z.string() }),
        },
      },
      description: "Social media service error",
    },
  },
  tags: ["posts", "admin"],
});
