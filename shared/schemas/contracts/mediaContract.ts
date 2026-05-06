import { createRoute, z } from "@hono/zod-openapi";
import { openApiStandardErrors } from "./common";

export const r2ObjectSchema = z.object({
  key: z.string(),
  size: z.number(),
  uploaded: z.string(),
  url: z.string(),
  httpEtag: z.string().optional(),
  httpMetadata: z
    .object({
      contentType: z.string().optional(),
    })
    .optional(),
});

export const assetSchema = r2ObjectSchema.extend({
  folder: z.string().nullable().optional(),
  tags: z.string().nullable().optional(),
});

// --- PUBLIC ---

export const getMediaRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    200: {
      description: "Get public gallery media",
      content: {
        "application/json": {
          schema: z.object({
            media: z.array(assetSchema),
          }),
        },
      },
    },
    429: {
      description: "Too Many Requests",
      content: { "application/json": { schema: z.string() } },
    },
    ...openApiStandardErrors,
  },
});

// --- ADMIN ---

export const adminListMediaRoute = createRoute({
  method: "get",
  path: "/admin",
  responses: {
    200: {
      description: "Get all media (admin view)",
      content: {
        "application/json": {
          schema: z.object({
            media: z.array(assetSchema),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

export const uploadMediaRoute = createRoute({
  method: "post",
  path: "/admin/upload",
  request: {
    body: {
      content: {
        "multipart/form-data": {
          schema: z.any(), // FormData
        },
      },
    },
  },
  responses: {
    200: {
      description: "Upload a media file",
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
    },
    ...openApiStandardErrors,
  },
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
    200: {
      description: "Move object to folder",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            newKey: z.string().optional(),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

export const deleteMediaRoute = createRoute({
  method: "delete",
  path: "/admin/{key}",
  request: {
    params: z.object({ key: z.string() }),
  },
  responses: {
    200: {
      description: "Delete an asset",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
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
    200: {
      description: "Syndicate media",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});
