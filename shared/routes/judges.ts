import { createRoute, z } from "@hono/zod-openapi";
import { standardErrors } from "./common";

export const judgeAccessCodeSchema = z.object({
  id: z.string().openapi({
    example: "550e8400-e29b-41d4-a716-446655440000",
    description: "Unique identifier for the access code",
  }),
  code: z.string().openapi({
    example: "AB12CD34EF56",
    description: "The access code for judges",
  }),
  label: z.string().openapi({
    example: "Championship Judges",
    description: "Human-readable label for this code",
  }),
  created_at: z.string().openapi({
    example: "2026-05-06T12:00:00Z",
    description: "ISO timestamp when the code was created",
  }),
  expires_at: z.string().nullable().openapi({
    example: null,
    description: "ISO timestamp when the code expires, or null if no expiration",
  }),
});

export const judgeLoginRoute = createRoute({
  method: "post",
  path: "/login",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            code: z.string().min(1).openapi({
              example: "AB12CD34EF56",
              description: "The judge access code to verify",
            }),
            turnstileToken: z.string().optional().openapi({
              example: "0x...",
              description: "Cloudflare Turnstile verification token for bot protection",
            }),
          }),
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
            success: z.boolean().openapi({
              example: true,
              description: "Whether the login was successful",
            }),
            label: z.string().optional().openapi({
              example: "Championship Judges",
              description: "Label associated with the access code",
            }),
          }),
        },
      },
      description: "Login successful",
    },
  },
  tags: ["judges"],
  summary: "Verify judge access code",
  description: "Authenticates a judge by verifying their access code. Rate limited to prevent brute force attacks.",
});

export const judgePortfolioRoute = createRoute({
  method: "get",
  path: "/portfolio",
  request: {
    headers: z.object({
      "x-judge-code": z.string().optional().openapi({
        example: "AB12CD34EF56",
        description: "Judge access code for authentication",
      }),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            portfolioDocs: z.array(z.object({
              slug: z.string(),
              title: z.string(),
              category: z.string(),
              description: z.string(),
              content: z.string(),
              is_executive_summary: z.number().optional(),
            })).openapi({
              description: "Portfolio documents including executive summary and category docs",
            }),
            outreach: z.array(z.object({
              id: z.number(),
              title: z.string(),
              date: z.string(),
              location: z.string(),
              students_count: z.number(),
              hours_logged: z.number(),
              reach_count: z.number(),
              description: z.string(),
            })).openapi({
              description: "Outreach event logs",
            }),
            awards: z.array(z.object({
              id: z.number(),
              title: z.string(),
              date: z.string(),
              event_name: z.string(),
              image_url: z.string(),
              description: z.string(),
              year: z.number(),
            })).openapi({
              description: "Team awards and recognition",
            }),
            sponsors: z.array(z.object({
              id: z.string(),
              name: z.string(),
              tier: z.string(),
              logo_url: z.string().nullable(),
              website_url: z.string().nullable(),
            })).openapi({
              description: "Team sponsors and partners",
            }),
          }),
        },
      },
      description: "Portfolio data retrieved successfully",
    },
  },
  tags: ["judges"],
  summary: "Get all portfolio content",
  description: "Retrieves the complete portfolio content for judge review. Requires valid access code via header.",
});

export const listJudgeCodesRoute = createRoute({
  method: "get",
  path: "/admin/codes",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            codes: z.array(judgeAccessCodeSchema).openapi({
              description: "All judge access codes",
            }),
          }),
        },
      },
      description: "Successfully retrieved access codes",
    },
  },
  tags: ["judges", "admin"],
  summary: "List all access codes (admin)",
  description: "Retrieves all judge access codes. Requires admin authentication.",
});

export const createJudgeCodeRoute = createRoute({
  method: "post",
  path: "/admin/codes",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            label: z.string().optional().openapi({
              example: "Championship Judges",
              description: "Label for the access code",
            }),
            expiresAt: z.string().optional().openapi({
              example: "2026-12-31T23:59:59Z",
              description: "Optional expiration timestamp in ISO format",
            }),
          }),
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
            success: z.boolean().openapi({
              example: true,
              description: "Whether the code was created successfully",
            }),
            code: z.string().openapi({
              example: "AB12CD34EF56",
              description: "The generated access code",
            }),
            id: z.string().openapi({
              example: "550e8400-e29b-41d4-a716-446655440000",
              description: "Unique identifier for the code",
            }),
          }),
        },
      },
      description: "Access code created successfully",
    },
  },
  tags: ["judges", "admin"],
  summary: "Create a new access code (admin)",
  description: "Generates a new unique judge access code with optional label and expiration. Requires admin authentication.",
});

export const deleteJudgeCodeRoute = createRoute({
  method: "delete",
  path: "/admin/codes/{id}",
  request: {
    params: z.object({
      id: z.string().openapi({
        example: "550e8400-e29b-41d4-a716-446655440000",
        description: "Unique identifier of the code to delete",
      }),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean().openapi({
              example: true,
              description: "Whether the deletion was successful",
            }),
          }),
        },
      },
      description: "Access code deleted successfully",
    },
  },
  tags: ["judges", "admin"],
  summary: "Delete an access code (admin)",
  description: "Deletes a judge access code by its ID. Requires admin authentication.",
});
