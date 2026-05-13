import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";

export const getAuthUrlResponseSchema = z.object({
  url: z.string().url().openapi({ example: "https://accounts.google.com/o/oauth2/v2/auth?..." }),
});

export const youtubeCallbackQuerySchema = z.object({
  code: z.string().optional().openapi({ example: "4/0AeaYSHD_..." }),
  error: z.string().optional().openapi({ example: "access_denied" }),
  state: z.string().optional(),
});

export const getResumableUrlInputSchema = z.object({
  title: z.string().min(1, "Title is required").openapi({ example: "Match Highlights" }),
  description: z.string().nullish().openapi({ example: "Highlights from competition" }),
  privacyStatus: z.enum(["public", "unlisted", "private"]).default("unlisted").openapi({ example: "unlisted" }),
  fileSize: z.number().int().positive().openapi({ example: 104857600 }), // In bytes
  mimeType: z.string().openapi({ example: "video/mp4" }),
});

export const getResumableUrlResponseSchema = z.object({
  uploadUrl: z.string().url().openapi({ example: "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&upload_id=..." }),
});

export const updateYoutubeVideoInputSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  privacyStatus: z.enum(["public", "unlisted", "private"]).optional(),
});

export const youtubeVideoSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  thumbnailUrl: z.string().optional(),
  privacyStatus: z.string(),
  publishedAt: z.string(),
});

export const getAuthUrlRoute = createRoute({
  method: "get",
  path: "/auth-url",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: getAuthUrlResponseSchema,
        },
      },
      description: "Google OAuth Authorization URL",
    },
  },
  tags: ["youtube", "admin"],
});

export const youtubeCallbackRoute = createRoute({
  method: "get",
  path: "/callback",
  request: {
    query: youtubeCallbackQuerySchema,
  },
  responses: {
    ...standardErrors,
    302: {
      description: "Redirect to dashboard",
    },
  },
  tags: ["youtube", "admin"],
});

export const getResumableUrlRoute = createRoute({
  method: "post",
  path: "/resumable-url",
  request: {
    body: {
      content: {
        "application/json": {
          schema: getResumableUrlInputSchema,
        },
      },
    },
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: getResumableUrlResponseSchema,
        },
      },
      description: "Resumable Upload URL",
    },
  },
  tags: ["youtube", "admin"],
});

export const updateYoutubeVideoRoute = createRoute({
  method: "put",
  path: "/{id}",
  request: {
    params: z.object({
      id: z.string().openapi({ example: "dQw4w9WgXcQ" }), // YouTube Video ID
    }),
    body: {
      content: {
        "application/json": {
          schema: updateYoutubeVideoInputSchema,
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
      description: "Video metadata updated on YouTube",
    },
  },
  tags: ["youtube", "admin"],
});

export const listYoutubeVideosRoute = createRoute({
  method: "get",
  path: "/videos",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            videos: z.array(youtubeVideoSchema),
          }),
        },
      },
      description: "List of YouTube videos from the authenticated channel",
    },
  },
  tags: ["youtube", "admin"],
});

export const checkAuthStatusRoute = createRoute({
  method: "get",
  path: "/status",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            isAuthenticated: z.boolean(),
            memberType: z.enum(["student", "mentor", "coach"]).optional(),
          }),
        },
      },
      description: "Returns true if a YouTube refresh token is stored",
    },
  },
  tags: ["youtube", "admin"],
});

export const disconnectYoutubeRoute = createRoute({
  method: "post",
  path: "/disconnect",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Disconnect YouTube account by removing refresh token",
    },
  },
  tags: ["youtube", "admin"],
});
