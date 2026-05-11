import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";

export const videoPlatformSchema = z.enum(["youtube", "vimeo", "other"]);

export const videoSchema = z.object({
  id: z.string().openapi({ example: "vid_xyz789" }),
  title: z.string().openapi({ example: "Robot Reveal 2025" }),
  description: z.string().nullable().optional().openapi({ example: "Our competition robot reveal video." }),
  platform: videoPlatformSchema.openapi({ example: "youtube" }),
  videoId: z.string().openapi({ example: "dQw4w9WgXcQ" }),
  thumbnailKey: z.string().nullable().optional().openapi({ example: "video/robot-reveal-thumb.jpg" }),
  thumbnailUrl: z.string().nullable().optional().openapi({ example: "/api/media/video/robot-reveal-thumb.jpg" }),
  embedUrl: z.string().openapi({ example: "https://www.youtube.com/embed/dQw4w9WgXcQ" }),
  createdAt: z.string().openapi({ example: "2025-01-15T10:00:00Z" }),
  updatedAt: z.string().openapi({ example: "2025-01-15T10:00:00Z" }),
});

export const createVideoSchema = z.object({
  title: z.string().min(1).openapi({ example: "Robot Reveal 2025" }),
  description: z.string().optional().openapi({ example: "Our competition robot reveal video." }),
  platform: videoPlatformSchema.openapi({ example: "youtube" }),
  videoId: z.string().min(1).openapi({ example: "dQw4w9WgXcQ" }),
  thumbnailKey: z.string().optional().openapi({ example: "video/robot-reveal-thumb.jpg" }),
});

export const updateVideoSchema = createVideoSchema.partial();

export const parseVideoUrlSchema = z.object({
  url: z.string().url().openapi({ example: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }),
});

export const parseVideoUrlResponseSchema = z.object({
  platform: videoPlatformSchema,
  videoId: z.string(),
  embedUrl: z.string(),
});

export const listVideosRoute = createRoute({
  method: "get",
  path: "/",
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
      description: "List all videos",
    },
  },
  tags: ["videos"],
});

export const getVideoRoute = createRoute({
  method: "get",
  path: "/{id}",
  request: {
    params: z.object({ id: z.string() }),
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
      description: "Get a single video",
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
      description: "Parse a video URL to extract platform and video ID",
    },
  },
  tags: ["videos"],
});

export const createVideoRoute = createRoute({
  method: "post",
  path: "/admin",
  request: {
    body: {
      content: {
        "application/json": {
          schema: createVideoSchema,
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
  method: "put",
  path: "/admin/{id}",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: updateVideoSchema,
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
  },
  tags: ["videos", "admin"],
});

export const deleteVideoRoute = createRoute({
  method: "delete",
  path: "/admin/{id}",
  request: {
    params: z.object({ id: z.string() }),
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
