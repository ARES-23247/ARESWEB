import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";

export const r2ObjectSchema = z.object({
  key: z.string().openapi({ example: "gallery/robot_1.jpg" }),
  size: z.number().openapi({ example: 1024 }),
  uploaded: z.string().openapi({ example: "2025-01-15T10:00:00Z" }),
  url: z.string().openapi({ example: "/media/gallery/robot_1.jpg" }),
  httpEtag: z.string().optional(),
  httpMetadata: z.object({
    contentType: z.string().optional(),
  }).optional(),
});

export const assetSchema = r2ObjectSchema.extend({
  folder: z.string().nullable().optional(),
  tags: z.string().nullable().optional(),
});

export const getMediaRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            media: z.array(assetSchema),
          }),
        },
      },
      description: "Get public gallery media",
    },
  },
  tags: ["media"],
});

export const getAdminMediaRoute = createRoute({
  method: "get",
  path: "/admin",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            media: z.array(assetSchema),
          }),
        },
      },
      description: "Get all media (admin view)",
    },
  },
  tags: ["media", "admin"],
});

export const uploadMediaRoute = createRoute({
  method: "post",
  path: "/admin/upload",
  request: {
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({
            file: z.any().openapi({ type: "string", format: "binary" }),
            altText: z.string().optional(),
            folder: z.string().optional(),
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
          schema: z.object({
            success: z.boolean(),
            key: z.string(),
            url: z.string(),
            altText: z.string().optional(),
          }),
        },
      },
      description: "Media uploaded successfully",
    },
  },
  tags: ["media", "admin"],
});

export const moveMediaRoute = createRoute({
  method: "put",
  path: "/admin/move/{key}",
  request: {
    params: z.object({ key: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            folder: z.string(),
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
          schema: z.object({
            success: z.boolean(),
            newKey: z.string().optional(),
          }),
        },
      },
      description: "Media moved to folder",
    },
  },
  tags: ["media", "admin"],
});

export const deleteMediaRoute = createRoute({
  method: "delete",
  path: "/admin/{key}",
  request: {
    params: z.object({ key: z.string() }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Media deleted",
    },
  },
  tags: ["media", "admin"],
});

export const syndicateMediaRoute = createRoute({
  method: "post",
  path: "/admin/syndicate",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            key: z.string(),
            caption: z.string().optional(),
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
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
      description: "Media syndicated to social channels",
    },
  },
  tags: ["media", "admin"],
});
