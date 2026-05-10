import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import {
  selectSponsorSchema,
  selectSponsorMetricSchema,
  selectSponsorTokenSchema,
} from "@shared/db/schema-zod";
import { responseWrappers } from "@shared/db/schema-openapi";
import { openApiStandardErrors } from "./common";
import { sponsorSchema as sponsorRequestSchema } from "../schemas/sponsorSchema";

// ============================================================================
// DERIVED RESPONSE SCHEMAS (from Drizzle)
// ============================================================================

/**
 * Sponsor response schema - derived from Drizzle select schema
 */
export const sponsorResponseSchema = selectSponsorSchema;

/**
 * Sponsor ROI metric schema - derived from Drizzle
 */
export const sponsorRoiMetricSchema = selectSponsorMetricSchema;

/**
 * Sponsor token schema - derived from Drizzle
 */
export const sponsorTokenSchema = selectSponsorTokenSchema;

// ============================================================================
// ROUTES
// ============================================================================

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

export const saveSponsorRoute = createRoute({
  method: "post",
  path: "/admin/save",
  request: {
    body: {
      content: {
        "application/json": {
          schema: sponsorRequestSchema,
        },
      },
    },
  },
  responses: {
    ...openApiStandardErrors,
    200: {
      content: {
        "application/json": {
          schema: responseWrappers.created(),
        },
      },
      description: "Create or update a sponsor",
    },
  },
});

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
          schema: responseWrappers.success(),
        },
      },
      description: "Delete a sponsor",
    },
  },
});

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

export const generateTokenRoute = createRoute({
  method: "post",
  path: "/admin/tokens/generate",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            sponsorId: z.string(),
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
