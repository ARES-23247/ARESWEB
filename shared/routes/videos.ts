import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";

export const videoPlatformSchema = z.enum(["youtube", "other"]);

export const videoTypeSchema = z.enum(["video", "short"]);

export const videoInputSchema = z.object({
  title: z.string().min(1, "Title is required").openapi({ example: "2025 Match Highlights" }),
  description: z.string().nullish().openapi({ example: "Highlights from our match at the qualifier." }),
  platform: videoPlatformSchema.default("youtube").openapi({ example: "youtube" }),
  videoId: z.string().min(1, "Video ID is required").openapi({ example: "dQw4w9WgXcQ" }),
  thumbnailKey: z.string().nullish().openapi({ example: "videos/match-thumb.jpg" }),
  type: videoTypeSchema.default("video").openapi({ example: "video" }),
  createBlogPost: z.boolean().optional(),
  crossPostSocial: z.boolean().optional(),
});

export const videoSchema = z.object({
  id: z.string().openapi({ example: "abc123" }),
  title: z.string().openapi({ example: "2025 Match Highlights" }),
  description: z.string().nullish().openapi({ example: "Highlights from our match at the qualifier." }),
  platform: videoPlatformSchema.openapi({ example: "youtube" }),
  videoId: z.string().openapi({ example: "dQw4w9WgXcQ" }),
  thumbnailKey: z.string().nullish().openapi({ example: "videos/match-thumb.jpg" }),
  thumbnailUrl: z.string().nullish().openapi({ example: "/api/media/videos/match-thumb.jpg" }),
  embedUrl: z.string().openapi({ example: "https://www.youtube.com/embed/dQw4w9WgXcQ" }),
  type: videoTypeSchema.openapi({ example: "video" }),
  createdAt: z.string().openapi({ example: "2025-01-15T10:00:00Z" }),
  updatedAt: z.string().openapi({ example: "2025-01-15T10:00:00Z" }),
});

export type VideoInput = z.infer<typeof videoInputSchema>;
export type VideoPlatform = z.infer<typeof videoPlatformSchema>;

export const parseVideoUrlSchema = z.object({
  url: z.string().min(1, "URL is required").openapi({ example: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }),
});

export const parseVideoUrlResponseSchema = z.object({
  platform: videoPlatformSchema,
  videoId: z.string().openapi({ example: "dQw4w9WgXcQ" }),
  embedUrl: z.string().openapi({ example: "https://www.youtube.com/embed/dQw4w9WgXcQ" }),
});

// Public Routes
export const listVideosRoute = createRoute({
  method: "get",
  path: "/",
  request: {
    query: z.object({
      platform: videoPlatformSchema.optional().openapi({ example: "youtube" }),
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
            videos: z.array(videoSchema),
          }),
        },
      },
      description: "List of all videos",
    },
  },
  tags: ["videos"],
});

export const getVideoRoute = createRoute({
  method: "get",
  path: "/{id}",
  request: {
    params: z.object({
      id: z.string().openapi({ example: "abc123" }),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            video: videoSchema,
          }),
        },
      },
      description: "Single video",
    },
    404: {
      content: {
        "application/json": {
          schema: z.object({ error: z.string() }),
        },
      },
      description: "Video not found",
    },
  },
  tags: ["videos"],
});

export const parseVideoUrlRoute = createRoute({
  method: "post",
  path: "/parse-url",
  request: {
    body: {
      content: {
        "application/json": {
          schema: parseVideoUrlSchema,
        },
      },
    },
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: parseVideoUrlResponseSchema,
        },
      },
      description: "Parsed video info from URL",
    },
    400: {
      content: {
        "application/json": {
          schema: z.object({ error: z.string() }),
        },
      },
      description: "Invalid URL or unsupported platform",
    },
  },
  tags: ["videos"],
});

// Admin Routes
export const createVideoRoute = createRoute({
  method: "post",
  path: "/",
  request: {
    body: {
      content: {
        "application/json": {
          schema: videoInputSchema,
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
            video: videoSchema,
          }),
        },
      },
      description: "Video created successfully",
    },
  },
  tags: ["videos", "admin"],
});

export const updateVideoRoute = createRoute({
  method: "patch",
  path: "/{id}",
  request: {
    params: z.object({
      id: z.string().openapi({ example: "abc123" }),
    }),
    body: {
      content: {
        "application/json": {
          schema: videoInputSchema.partial(),
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
            video: videoSchema,
          }),
        },
      },
      description: "Video updated successfully",
    },
    404: {
      content: {
        "application/json": {
          schema: z.object({ error: z.string() }),
        },
      },
      description: "Video not found",
    },
  },
  tags: ["videos", "admin"],
});

export const deleteVideoRoute = createRoute({
  method: "delete",
  path: "/{id}",
  request: {
    params: z.object({
      id: z.string().openapi({ example: "abc123" }),
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
      description: "Video deleted successfully",
    },
  },
  tags: ["videos", "admin"],
});

export const syncYoutubeVideosRoute = createRoute({
  method: "post",
  path: "/sync",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            added: z.coerce.number(),
            total: z.coerce.number().optional(),
          }),
        },
      },
      description: "Videos synced successfully",
    },
    500: {
      content: {
        "application/json": {
          schema: z.object({ error: z.string() }),
        },
      },
      description: "Failed to sync videos",
    },
  },
  tags: ["videos", "admin"],
});
