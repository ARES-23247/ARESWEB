import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { openApiStandardErrors } from "./common";
import { sponsorSchema } from "../schemas/sponsorSchema";

// Response schema - id is always present in responses
export const sponsorResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  tier: z.enum(["Titanium", "Gold", "Silver", "Bronze", "In-Kind"]),
  logo_url: z.string().nullable(),
  website_url: z.string().nullable(),
  is_active: z.number(),
  created_at: z.string().nullable().optional(),
});

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
  sponsor_name: z.string().optional(),
  created_at: z.string().nullable(),
  last_used: z.string().nullable(),
});

// Route: Get all public sponsors
export const getSponsorsRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    ...openApiStandardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            sponsors: z.array(sponsorResponseSchema),
          }),
        },
      },
      description: "Get all public sponsors",
    },
  },
});

// Route: Get public ROI dashboard by token
export const getRoiRoute = createRoute({
  method: "get",
  path: "/roi/{token}",
  request: {
    params: z.object({
      token: z.string(),
    }),
  },
  responses: {
    ...openApiStandardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            sponsor: sponsorResponseSchema,
            metrics: z.array(sponsorRoiMetricSchema),
          }),
        },
      },
      description: "Get public (hidden) ROI dashboard",
    },
  },
});

// Route: Admin list all sponsors
export const adminListSponsorsRoute = createRoute({
  method: "get",
  path: "/admin/list",
  responses: {
    ...openApiStandardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            sponsors: z.array(sponsorResponseSchema),
          }),
        },
      },
      description: "Get all sponsors (admin view)",
    },
  },
});

// Route: Admin save/create sponsor
export const saveSponsorRoute = createRoute({
  method: "post",
  path: "/admin/save",
  request: {
    body: {
      content: {
        "application/json": {
          schema: sponsorSchema,
        },
      },
    },
  },
  responses: {
    ...openApiStandardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            id: z.string(),
          }),
        },
      },
      description: "Create or update a sponsor",
    },
  },
});

// Route: Admin delete sponsor
export const deleteSponsorRoute = createRoute({
  method: "delete",
  path: "/admin/{id}",
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    ...openApiStandardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
          }),
        },
      },
      description: "Delete a sponsor",
    },
  },
});

// Route: Admin get tokens
export const getAdminTokensRoute = createRoute({
  method: "get",
  path: "/admin/tokens",
  responses: {
    ...openApiStandardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            tokens: z.array(sponsorTokenSchema),
          }),
        },
      },
      description: "Get all sponsor tokens",
    },
  },
});

// Route: Admin generate token
export const generateTokenRoute = createRoute({
  method: "post",
  path: "/admin/tokens/generate",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            sponsor_id: z.string(),
          }),
        },
      },
    },
  },
  responses: {
    ...openApiStandardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            token: z.string().optional(),
          }),
        },
      },
      description: "Generate a new sponsor token",
    },
  },
});
