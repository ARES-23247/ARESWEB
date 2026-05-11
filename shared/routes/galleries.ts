import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";

export const gallerySchema = z.object({
  id: z.string().openapi({ example: "gal_abc123" }),
  title: z.string().openapi({ example: "2025 Season Kickoff" }),
  description: z.string().nullable().optional().openapi({ example: "Photos from our season kickoff event." }),
  googlePhotosUrl: z.string().nullable().optional().openapi({ example: "https://photos.app.goo.gl/xyz" }),
  heroImageKey: z.string().nullable().optional().openapi({ example: "gallery/kickoff-hero.jpg" }),
  heroImageUrl: z.string().nullable().optional().openapi({ example: "/api/media/gallery/kickoff-hero.jpg" }),
  createdAt: z.string().openapi({ example: "2025-01-15T10:00:00Z" }),
  updatedAt: z.string().openapi({ example: "2025-01-15T10:00:00Z" }),
});

export const createGallerySchema = z.object({
  title: z.string().min(1).openapi({ example: "2025 Season Kickoff" }),
  description: z.string().optional().openapi({ example: "Photos from our season kickoff event." }),
  googlePhotosUrl: z.string().url().nullable().optional().openapi({ example: "https://photos.app.goo.gl/xyz" }),
  heroImageKey: z.string().optional().openapi({ example: "gallery/kickoff-hero.jpg" }),
});

export const updateGallerySchema = createGallerySchema.partial();

export const listGalleriesRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            galleries: z.array(gallerySchema),
          }),
        },
      },
      description: "List all galleries",
    },
  },
  tags: ["galleries"],
});

export const getGalleryRoute = createRoute({
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
            gallery: gallerySchema,
          }),
        },
      },
      description: "Get a single gallery",
    },
  },
  tags: ["galleries"],
});

export const createGalleryRoute = createRoute({
  method: "post",
  path: "/admin",
  request: {
    body: {
      content: {
        "application/json": {
          schema: createGallerySchema,
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
            gallery: gallerySchema,
          }),
        },
      },
      description: "Gallery created successfully",
    },
  },
  tags: ["galleries", "admin"],
});

export const updateGalleryRoute = createRoute({
  method: "put",
  path: "/admin/{id}",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: updateGallerySchema,
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
            gallery: gallerySchema,
          }),
        },
      },
      description: "Gallery updated successfully",
    },
  },
  tags: ["galleries", "admin"],
});

export const deleteGalleryRoute = createRoute({
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
      description: "Gallery deleted successfully",
    },
  },
  tags: ["galleries", "admin"],
});
