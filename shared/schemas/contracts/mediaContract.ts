import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

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

export const mediaContract = c.router({
  // --- PUBLIC ---
  getMedia: {
    method: "GET",
    path: "/",
    responses: {
      200: z.object({
        media: z.array(assetSchema),
      }),
      429: z.string(),
      500: z.object({
        error: z.string(),
        media: z.array(z.any()),
      }),
    },
    summary: "Get public gallery media",
  },

  // --- ADMIN ---
  adminList: {
    method: "GET",
    path: "/admin",
    responses: {
      200: z.object({
        media: z.array(assetSchema),
      }),
      500: z.object({
        error: z.string(),
        media: z.array(z.any()),
      }),
    },
    summary: "Get all media (admin view)",
  },
  upload: {
    method: "POST",
    path: "/admin/upload",
    body: c.type<FormData>(),
    responses: {
      200: z.object({
        success: z.boolean(),
        key: z.string(),
        url: z.string(),
        altText: z.string().optional(),
      }),
      400: z.object({ error: z.string() }),
      500: z.object({ error: z.string() }),
    },
    summary: "Upload a media file",
  },
  move: {
    method: "PUT",
    path: "/admin/move/:key",
    pathParams: z.object({
      key: z.string(),
    }),
    body: z.object({
      folder: z.string(),
    }),
    responses: {
      200: z.object({
        success: z.boolean(),
        newKey: z.string().optional(),
      }),
      400: z.object({ error: z.string() }),
      404: z.object({ error: z.string() }),
      500: z.object({ error: z.string() }),
    },
    summary: "Move object to folder",
  },
  delete: {
    method: "DELETE",
    path: "/admin/:key",
    pathParams: z.object({
      key: z.string(),
    }),
    body: c.noBody(),
    responses: {
      200: z.object({
        success: z.boolean(),
      }),
      500: z.object({
        error: z.string(),
      }),
    },
    summary: "Delete an asset",
  },
  syndicate: {
    method: "POST",
    path: "/admin/syndicate",
    body: z.object({
      key: z.string(),
      caption: z.string().optional(),
    }),
    responses: {
      200: z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      400: z.object({ error: z.string() }),
      500: z.object({ error: z.string() }),
    },
  },
});
