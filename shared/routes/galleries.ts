import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";
import { assetSchema } from "./media";

export const galleryInputSchema = z.object({
  title: z.string().min(1, "Title is required").openapi({ example: "2025 Season Kickoff Gallery" }),
  description: z.string().nullish().openapi({ example: "Photos from our season kickoff event." }),
  googlePhotosUrl: z.string().url().nullish().openapi({ example: "https://photos.app.goo.gl/xyz" }),
  heroImageKey: z.string().nullish().openapi({ example: "galleries/kickoff-hero.jpg" }),
});

export const gallerySchema = z.object({
  id: z.string().openapi({ example: "abc123" }),
  title: z.string().openapi({ example: "2025 Season Kickoff Gallery" }),
  description: z.string().nullish().openapi({ example: "Photos from our season kickoff event." }),
  googlePhotosUrl: z.string().nullish().openapi({ example: "https://photos.app.goo.gl/xyz" }),
  heroImageKey: z.string().nullish().openapi({ example: "galleries/kickoff-hero.jpg" }),
  heroImageUrl: z.string().nullish().openapi({ example: "/api/media/galleries/kickoff-hero.jpg" }),
  createdAt: z.string().openapi({ example: "2025-01-15T10:00:00Z" }),
  updatedAt: z.string().openapi({ example: "2025-01-15T10:00:00Z" }),
});

export type GalleryInput = z.infer<typeof galleryInputSchema>;

// Public Routes
export const listGalleriesRoute = createRoute({
  method: "get",
  path: "/",
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
            galleries: z.array(gallerySchema),
          }),
        },
      },
      description: "List of all galleries",
    },
  },
  tags: ["galleries"],
});

export const getGalleryRoute = createRoute({
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
            gallery: gallerySchema,
          }),
        },
      },
      description: "Single gallery",
    },
    404: {
      content: {
        "application/json": {
          schema: z.object({ error: z.string() }),
        },
      },
      description: "Gallery not found",
    },
  },
  tags: ["galleries"],
});

export const getGalleryMediaRoute = createRoute({
  method: "get",
  path: "/{id}/media",
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
            media: z.array(assetSchema),
          }),
        },
      },
      description: "List of gallery media",
    },
    404: {
      content: {
        "application/json": {
          schema: z.object({ error: z.string() }),
        },
      },
      description: "Gallery not found",
    },
  },
  tags: ["galleries"],
});

// Admin Routes
export const createGalleryRoute = createRoute({
  method: "post",
  path: "/admin",
  request: {
    body: {
      content: {
        "application/json": {
          schema: galleryInputSchema,
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
  method: "patch",
  path: "/admin/{id}",
  request: {
    params: z.object({
      id: z.string().openapi({ example: "abc123" }),
    }),
    body: {
      content: {
        "application/json": {
          schema: galleryInputSchema.partial(),
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
    404: {
      content: {
        "application/json": {
          schema: z.object({ error: z.string() }),
        },
      },
      description: "Gallery not found",
    },
  },
  tags: ["galleries", "admin"],
});

export const deleteGalleryRoute = createRoute({
  method: "delete",
  path: "/admin/{id}",
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
      description: "Gallery deleted successfully",
    },
  },
  tags: ["galleries", "admin"],
});
