import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrorsWithAuth, standardErrors } from "./common";
import { 
  albumSchema, 
  albumPayloadSchema, 
  albumMediaPayloadSchema, 
  albumMediaReorderPayloadSchema 
} from "../schemas/albumSchema";

export const importedPhotoSchema = z.object({
  id: z.string(),
  r2Key: z.string(),
  filename: z.string().nullable().optional(),
  mimeType: z.string(),
  createdAt: z.string(),
});

export const albumDetailSchema = albumSchema.extend({
  media: z.array(z.object({
    id: z.string(),
    sortOrder: z.number(),
    photo: importedPhotoSchema,
  })).optional(),
});

export const getAlbumsRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            albums: z.array(albumSchema),
          }),
        },
      },
      description: "Get all albums",
    },
  },
  tags: ["albums"],
});

export const getAlbumRoute = createRoute({
  method: "get",
  path: "/{id}",
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            album: albumDetailSchema,
          }),
        },
      },
      description: "Get album by ID",
    },
  },
  tags: ["albums"],
});

export const createAlbumRoute = createRoute({
  method: "post",
  path: "/",
  request: {
    body: {
      content: {
        "application/json": {
          schema: albumPayloadSchema,
        },
      },
    },
  },
  responses: {
    ...standardErrorsWithAuth,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            id: z.string(),
          }),
        },
      },
      description: "Album created",
    },
  },
  tags: ["albums", "admin"],
});

export const updateAlbumRoute = createRoute({
  method: "patch",
  path: "/{id}",
  request: {
    params: z.object({
      id: z.string(),
    }),
    body: {
      content: {
        "application/json": {
          schema: albumPayloadSchema.partial(),
        },
      },
    },
  },
  responses: {
    ...standardErrorsWithAuth,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
          }),
        },
      },
      description: "Album updated",
    },
  },
  tags: ["albums", "admin"],
});

export const deleteAlbumRoute = createRoute({
  method: "delete",
  path: "/{id}",
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    ...standardErrorsWithAuth,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
          }),
        },
      },
      description: "Album soft-deleted",
    },
  },
  tags: ["albums", "admin"],
});

export const addAlbumMediaRoute = createRoute({
  method: "post",
  path: "/{id}/media",
  request: {
    params: z.object({
      id: z.string(),
    }),
    body: {
      content: {
        "application/json": {
          schema: albumMediaPayloadSchema,
        },
      },
    },
  },
  responses: {
    ...standardErrorsWithAuth,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            added: z.number(),
          }),
        },
      },
      description: "Media added to album",
    },
  },
  tags: ["albums", "admin"],
});

export const removeAlbumMediaRoute = createRoute({
  method: "delete",
  path: "/{id}/media/{mediaId}",
  request: {
    params: z.object({
      id: z.string(),
      mediaId: z.string(),
    }),
  },
  responses: {
    ...standardErrorsWithAuth,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
          }),
        },
      },
      description: "Media removed from album",
    },
  },
  tags: ["albums", "admin"],
});

export const reorderAlbumMediaRoute = createRoute({
  method: "put",
  path: "/{id}/media/reorder",
  request: {
    params: z.object({
      id: z.string(),
    }),
    body: {
      content: {
        "application/json": {
          schema: albumMediaReorderPayloadSchema,
        },
      },
    },
  },
  responses: {
    ...standardErrorsWithAuth,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
          }),
        },
      },
      description: "Media reordered in album",
    },
  },
  tags: ["albums", "admin"],
});
