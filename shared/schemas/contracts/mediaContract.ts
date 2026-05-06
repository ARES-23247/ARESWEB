import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { standardErrors } from "./common";

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
      ...standardErrors,
      200: z.object({
        media: z.array(assetSchema),
      }),
      429: z.string(),
    },
    summary: "Get public gallery media",
  },

  // --- ADMIN ---
  adminList: {
    method: "GET",
    path: "/admin",
    responses: {
      ...standardErrors,
      200: z.object({
        media: z.array(assetSchema),
      }),
    },
    summary: "Get all media (admin view)",
  },
  upload: {
    method: "POST",
    path: "/admin/upload",
    contentType: "multipart/form-data",
    body: c.type<FormData>(),
    responses: {
      ...standardErrors,
      200: z.object({
        success: z.boolean(),
        key: z.string(),
        url: z.string(),
        altText: z.string().optional(),
      }),
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
      ...standardErrors,
      200: z.object({
        success: z.boolean(),
        newKey: z.string().optional(),
      }),
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
      ...standardErrors,
      200: z.object({
        success: z.boolean(),
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
      ...standardErrors,
      200: z.object({
        success: z.boolean(),
        message: z.string(),
      }),
    },
  },
});
export type MediaContract = typeof mediaContract;
