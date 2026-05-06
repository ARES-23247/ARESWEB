import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";

export const seasonSchema = z.object({
  original_year: z.number().optional().openapi({ example: 2024 }),
  start_year: z.number().openapi({ example: 2024 }),
  end_year: z.number().openapi({ example: 2025 }),
  challenge_name: z.string().openapi({ example: "Rapid React" }),
  robot_name: z.string().nullable().optional().openapi({ example: "Atlas" }),
  robot_image: z.string().nullable().optional().openapi({ example: "https://example.com/robot.jpg" }),
  robot_description: z.string().nullable().optional().openapi({ example: "A tall robot with a shooter" }),
  robot_cad_url: z.string().nullable().optional().openapi({ example: "https://example.com/cad" }),
  summary: z.string().nullable().optional().openapi({ example: "Season summary" }),
  album_url: z.string().nullable().optional().openapi({ example: "https://photos.app.goo.gl/xyz" }),
  album_cover: z.string().nullable().optional().openapi({ example: "https://example.com/cover.jpg" }),
  status: z.string().nullable().optional().openapi({ example: "published" }),
  is_deleted: z.number().nullable().optional().openapi({ example: 0 }),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});

export const listSeasonsRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            seasons: z.array(seasonSchema),
          }),
        },
      },
      description: "List all published seasons",
    },
  },
  tags: ["seasons"],
});

export const adminListSeasonsRoute = createRoute({
  method: "get",
  path: "/admin/list",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            seasons: z.array(seasonSchema),
          }),
        },
      },
      description: "List all seasons (admin)",
    },
  },
  tags: ["seasons"],
});

export const adminDetailSeasonRoute = createRoute({
  method: "get",
  path: "/admin/{id}",
  request: {
    params: z.object({
      id: z.string().openapi({ example: "2024" }),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            season: seasonSchema,
          }),
        },
      },
      description: "Get season details (admin)",
    },
  },
  tags: ["seasons"],
});

export const getSeasonDetailRoute = createRoute({
  method: "get",
  path: "/{year}",
  request: {
    params: z.object({
      year: z.string().openapi({ example: "2024" }),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            season: seasonSchema,
            awards: z.array(z.unknown()),
            events: z.array(z.unknown()),
            posts: z.array(z.unknown()),
            outreach: z.array(z.unknown()),
          }),
        },
      },
      description: "Get public season details",
    },
  },
  tags: ["seasons"],
});

export const saveSeasonRoute = createRoute({
  method: "post",
  path: "/admin/save",
  request: {
    body: {
      content: {
        "application/json": {
          schema: seasonSchema,
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
      description: "Save/Update a season",
    },
  },
  tags: ["seasons"],
});

export const deleteSeasonRoute = createRoute({
  method: "delete",
  path: "/admin/{id}",
  request: {
    params: z.object({
      id: z.string().openapi({ example: "2024" }),
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
      description: "Soft delete a season",
    },
  },
  tags: ["seasons"],
});

export const undeleteSeasonRoute = createRoute({
  method: "post",
  path: "/admin/{id}/undelete",
  request: {
    params: z.object({
      id: z.string().openapi({ example: "2024" }),
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
      description: "Restore a deleted season",
    },
  },
  tags: ["seasons"],
});

export const purgeSeasonRoute = createRoute({
  method: "delete",
  path: "/admin/{id}/purge",
  request: {
    params: z.object({
      id: z.string().openapi({ example: "2024" }),
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
      description: "Permanently delete a season",
    },
  },
  tags: ["seasons"],
});
