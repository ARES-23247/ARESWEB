import { createRoute, z } from "@hono/zod-openapi";
import { standardErrors } from "./common";
import { selectJudgeAccessCodeSchema } from "@shared/db/schema-zod";
import { createResponseSchema, responseWrappers, toCamelCaseResponse } from "@shared/db/schema-openapi";

// ============================================================================
// JUDGE ACCESS CODE RESPONSE SCHEMAS (derived from Drizzle)
// ============================================================================

/**
 * Judge access code schema derived from Drizzle judge_access_codes table.
 * Uses camelCase naming (created_at -> createdAt, expires_at -> expiresAt).
 */
export const judgeAccessCodeSchema = createResponseSchema(
  toCamelCaseResponse(
    selectJudgeAccessCodeSchema.pick({
      id: true,
      code: true,
      label: true,
      createdAt: true,
      expiresAt: true,
    })
  ),
  {
    title: "Judge Access Code",
    description: "An access code for judge authentication to view portfolio content",
    example: {
      id: "550e8400-e29b-41d4-a716-446655440000",
      code: "AB12CD34EF56",
      label: "Championship Judges",
      createdAt: "2026-05-06T12:00:00Z",
      expiresAt: null,
    },
  }
);

// ============================================================================
// JUDGE ROUTES
// ============================================================================

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

/**
 * Portfolio document item for judge review
 */
const portfolioDocItem = z.object({
  slug: z.string().openapi({
    example: "executive-summary",
    description: "URL slug for the document",
  }),
  title: z.string().openapi({
    example: "Executive Summary",
    description: "Document title",
  }),
  category: z.string().openapi({
    example: "overview",
    description: "Document category",
  }),
  description: z.string().openapi({
    example: "Overview of team accomplishments",
    description: "Document description",
  }),
  content: z.string().openapi({
    description: "Full document content (Markdown/HTML)",
  }),
  isExecutiveSummary: z.number().optional().openapi({
    example: 1,
    description: "Whether this is the executive summary document",
  }),
});

/**
 * Outreach event log item for judge review
 */
const outreachEventItem = z.object({
  id: z.number().openapi({
    example: 123,
    description: "Event ID",
  }),
  title: z.string().openapi({
    example: "STEM Workshop at Local Elementary",
    description: "Event title",
  }),
  date: z.string().openapi({
    example: "2026-04-15",
    description: "Event date",
  }),
  location: z.string().openapi({
    example: "Mountainview Elementary School",
    description: "Event location",
  }),
  studentsCount: z.number().openapi({
    example: 45,
    description: "Number of students reached",
  }),
  hoursLogged: z.number().openapi({
    example: 3,
    description: "Hours spent on this outreach",
  }),
  reachCount: z.number().openapi({
    example: 200,
    description: "Estimated community reach",
  }),
  description: z.string().openapi({
    example: "Taught students about robotics and programming",
    description: "Event description",
  }),
});

/**
 * Award item for judge review
 */
const awardItem = z.object({
  id: z.number().openapi({
    example: 42,
    description: "Award ID",
  }),
  title: z.string().openapi({
    example: "Inspire Award",
    description: "Award title",
  }),
  date: z.string().openapi({
    example: "2026-03-10",
    description: "Award date",
  }),
  eventName: z.string().openapi({
    example: "WV FTC Championship",
    description: "Event where award was received",
  }),
  imageUrl: z.string().nullable().optional().openapi({
    example: "https://example.com/awards/inspire.jpg",
    description: "URL to award image",
  }),
  description: z.string().openapi({
    example: "Highest honor awarded at the championship",
    description: "Award description",
  }),
  year: z.number().openapi({
    example: 2026,
    description: "Award year",
  }),
});

/**
 * Sponsor item for judge review
 */
const sponsorItem = z.object({
  id: z.string().openapi({
    example: "sponsor_acme",
    description: "Sponsor ID",
  }),
  name: z.string().openapi({
    example: "Acme Corporation",
    description: "Sponsor name",
  }),
  tier: z.string().openapi({
    example: "Gold",
    description: "Sponsorship tier",
  }),
  logoUrl: z.string().nullable().optional().openapi({
    example: "https://example.com/sponsors/acme.png",
    description: "URL to sponsor logo",
  }),
  websiteUrl: z.string().nullable().optional().openapi({
    example: "https://acme.com",
    description: "Sponsor website URL",
  }),
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
            portfolioDocs: z.array(portfolioDocItem).openapi({
              description: "Portfolio documents including executive summary and category docs",
            }),
            outreach: z.array(outreachEventItem).openapi({
              description: "Outreach event logs",
            }),
            awards: z.array(awardItem).openapi({
              description: "Team awards and recognition",
            }),
            sponsors: z.array(sponsorItem).openapi({
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
          schema: responseWrappers.success(),
        },
      },
      description: "Access code deleted successfully",
    },
  },
  tags: ["judges", "admin"],
  summary: "Delete an access code (admin)",
  description: "Deletes a judge access code by its ID. Requires admin authentication.",
});
