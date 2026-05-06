import { createRoute, z } from "@hono/zod-openapi";
import { openApiStandardErrors } from "./common";

export const getSettingsRoute = createRoute({
  method: "get",
  path: "/admin/settings",
  responses: {
    200: {
      description: "Get all integration settings (admin)",
      content: { "application/json": { schema: z.object({ success: z.boolean(), settings: z.record(z.string(), z.string()) }) } },
    },
    ...openApiStandardErrors,
  },
});

export const updateSettingsRoute = createRoute({
  method: "post",
  path: "/admin/settings",
  request: {
    body: {
      content: { "application/json": { schema: z.record(z.string(), z.string()) } },
    },
  },
  responses: {
    200: {
      description: "Update integration settings (admin)",
      content: { "application/json": { schema: z.object({ success: z.boolean(), updated: z.number() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const getStatsRoute = createRoute({
  method: "get",
  path: "/admin/stats",
  responses: {
    200: {
      description: "Get platform quick stats (admin)",
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
    },
    ...openApiStandardErrors,
  },
});

export const getPublicSettingsRoute = createRoute({
  method: "get",
  path: "/public/settings",
  responses: {
    200: {
      description: "Get public integration settings",
      content: { "application/json": { schema: z.object({ success: z.boolean(), settings: z.record(z.string(), z.string()) }) } },
    },
    ...openApiStandardErrors,
  },
});
