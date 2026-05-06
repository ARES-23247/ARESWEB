import { createRoute, z } from "@hono/zod-openapi";
import { openApiStandardErrors } from "./common";
import { sponsorSchema } from "../sponsorSchema";

export const sponsorRoiMetricSchema = z.object({
  id: z.string().nullable(),
  sponsor_id: z.string(),
  clicks: z.number().nullable(),
  impressions: z.number().nullable(),
  year_month: z.string(),
});

export const sponsorTokenSchema = z.object({
  sponsor_id: z.string(),
  token: z.string(),
  created_at: z.string().nullable(),
  last_used: z.string().nullable(),
});

// --- PUBLIC ---

export const getSponsorsRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    200: {
      description: "Get all public sponsors",
      content: { "application/json": { schema: z.object({ sponsors: z.array(sponsorSchema) }) } },
    },
    ...openApiStandardErrors,
  },
});

export const getRoiRoute = createRoute({
  method: "get",
  path: "/roi/{token}",
  request: {
    params: z.object({ token: z.string() }),
  },
  responses: {
    200: {
      description: "Get public (hidden) ROI dashboard",
      content: {
        "application/json": {
          schema: z.object({
            sponsor: sponsorSchema,
            metrics: z.array(sponsorRoiMetricSchema),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

// --- ADMIN ---

export const adminListSponsorsRoute = createRoute({
  method: "get",
  path: "/admin/list",
  responses: {
    200: {
      description: "Get all sponsors (admin view)",
      content: { "application/json": { schema: z.object({ sponsors: z.array(sponsorSchema) }) } },
    },
    ...openApiStandardErrors,
  },
});

export const saveSponsorRoute = createRoute({
  method: "post",
  path: "/admin/save",
  request: {
    body: {
      content: { "application/json": { schema: sponsorSchema } },
    },
  },
  responses: {
    200: {
      description: "Create or update a sponsor",
      content: { "application/json": { schema: z.object({ success: z.boolean(), id: z.string().optional() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const deleteSponsorRoute = createRoute({
  method: "delete",
  path: "/admin/{id}",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: "Delete a sponsor",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const getAdminTokensRoute = createRoute({
  method: "get",
  path: "/admin/tokens",
  responses: {
    200: {
      description: "Get all sponsor tokens",
      content: { "application/json": { schema: z.object({ tokens: z.array(sponsorTokenSchema) }) } },
    },
    ...openApiStandardErrors,
  },
});

export const generateTokenRoute = createRoute({
  method: "post",
  path: "/admin/tokens/generate",
  request: {
    body: {
      content: { "application/json": { schema: z.object({ sponsor_id: z.string() }) } },
    },
  },
  responses: {
    200: {
      description: "Generate a new sponsor token",
      content: { "application/json": { schema: z.object({ success: z.boolean(), token: z.string().optional() }) } },
    },
    ...openApiStandardErrors,
  },
});
