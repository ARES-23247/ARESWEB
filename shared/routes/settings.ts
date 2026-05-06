import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";

export const getSettingsRoute = createRoute({
  method: "get",
  path: "/admin/settings",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            settings: z.record(z.string(), z.string()),
          }),
        },
      },
      description: "Get all integration settings (admin)",
    },
  },
  tags: ["settings"],
});

export const updateSettingsRoute = createRoute({
  method: "post",
  path: "/admin/settings",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.record(z.string(), z.string().max(10000)),
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
            updated: z.number(),
          }),
        },
      },
      description: "Update integration settings (admin)",
    },
  },
  tags: ["settings"],
});

export const getStatsRoute = createRoute({
  method: "get",
  path: "/admin/stats",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            posts: z.number(),
            events: z.number(),
            docs: z.number(),
            inquiries: z.number(),
            users: z.number(),
          }),
        },
      },
      description: "Get platform quick stats (admin)",
    },
  },
  tags: ["settings"],
});

export const getPublicSettingsRoute = createRoute({
  method: "get",
  path: "/public/settings",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            settings: z.record(z.string(), z.string()),
          }),
        },
      },
      description: "Get public integration settings",
    },
  },
  tags: ["settings"],
});

export const getBackupRoute = createRoute({
  method: "get",
  path: "/admin/backup",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            timestamp: z.string(),
            backup: z.record(z.string(), z.array(z.unknown())),
          }),
        },
      },
      description: "Export database backup (admin)",
    },
  },
  tags: ["settings"],
});
