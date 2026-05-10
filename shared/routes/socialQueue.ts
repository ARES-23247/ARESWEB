import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { selectSocialQueueSchema } from "../db/schema-zod";
import { createResponseSchema } from "../db/schema-openapi";
import { openApiStandardErrors } from "./common";

// ============================================================================
// PLATFORM & ANALYTICS SCHEMAS (Custom JSON fields from Drizzle text columns)
// ============================================================================

/**
 * Platform-specific flags for social media posting
 * Maps to the `platforms` text column (stored as JSON string in DB)
 */
const platformSchema = z.object({
  twitter: z.boolean().optional(),
  bluesky: z.boolean().optional(),
  facebook: z.boolean().optional(),
  instagram: z.boolean().optional(),
  discord: z.boolean().optional(),
  slack: z.boolean().optional(),
  teams: z.boolean().optional(),
  gchat: z.boolean().optional(),
  linkedin: z.boolean().optional(),
  tiktok: z.boolean().optional(),
  band: z.boolean().optional(),
});

/**
 * Analytics data for each platform
 * Maps to the `analytics` text column (stored as JSON string in DB)
 */
const analyticsSchema = z.object({
  twitter: z.object({
    impressions: z.number().optional(),
    likes: z.number().optional(),
    retweets: z.number().optional(),
    replies: z.number().optional(),
  }).optional(),
  bluesky: z.object({
    impressions: z.number().optional(),
    likes: z.number().optional(),
    reposts: z.number().optional(),
    replies: z.number().optional(),
  }).optional(),
  facebook: z.object({
    reach: z.number().optional(),
    likes: z.number().optional(),
    comments: z.number().optional(),
    shares: z.number().optional(),
  }).optional(),
  instagram: z.object({
    reach: z.number().optional(),
    likes: z.number().optional(),
    comments: z.number().optional(),
    saves: z.number().optional(),
  }).optional(),
  linkedin: z.object({
    impressions: z.number().optional(),
    likes: z.number().optional(),
    comments: z.number().optional(),
    shares: z.number().optional(),
  }).optional(),
});

// ============================================================================
// SOCIAL QUEUE RESPONSE SCHEMA
// Extends Drizzle schema with JSON field transformations and OpenAPI metadata
// ============================================================================

/**
 * Social Queue Post API Response Schema
 *
 * This extends the base Drizzle schema with:
 * - Transformed JSON fields (platforms, analytics from text strings to objects)
 * - OpenAPI examples for documentation
 * - Status enum validation
 *
 * Drizzle source: `socialQueue` table in src/db/schema.ts
 */
export const socialQueueResponseSchema = createResponseSchema(
  selectSocialQueueSchema,
  {
    title: "Social Queue Post",
    description: "A scheduled social media post across multiple platforms",
    example: {
      id: "550e8400-e29b-41d4-a716-446655440000",
      content: "Join us for our kickoff meeting this Saturday! #FTC #FIRST",
      media_urls: ["https://example.com/image.jpg"],
      scheduled_for: "2026-05-15T10:00:00Z",
      platforms: JSON.stringify({
        twitter: true,
        bluesky: true,
        instagram: true,
      }),
      status: "pending",
      created_at: "2026-05-09T12:00:00Z",
      sent_at: null,
      error_message: null,
      created_by: "user@example.com",
      linked_type: "event",
      linked_id: "event-123",
      analytics: null,
    },
  }
);

/**
 * Full API response schema with JSON fields transformed
 * This is what the API returns to clients
 */
export const socialQueueApiSchema = z.object({
  id: z.string().openapi({
    example: "550e8400-e29b-41d4-a716-446655440000",
    description: "Unique post identifier",
  }),
  content: z.string().min(1).max(5000).openapi({
    example: "Join us for our kickoff meeting this Saturday!",
    description: "Post content (max 5000 chars)",
  }),
  mediaUrls: z.array(z.string().url()).optional().openapi({
    example: ["https://example.com/image.jpg"],
    description: "Attached media URLs",
  }),
  scheduledFor: z.string().openapi({
    example: "2026-05-15T10:00:00Z",
    description: "ISO 8601 timestamp for scheduled posting",
  }),
  platforms: platformSchema.openapi({
    example: {
      twitter: true,
      bluesky: true,
      instagram: false,
    },
    description: "Target platforms for this post",
  }),
  status: z.enum(["pending", "processing", "sent", "failed", "cancelled"]).openapi({
    example: "pending",
    description: "Current post status",
  }),
  createdAt: z.string().openapi({
    example: "2026-05-09T12:00:00Z",
    description: "ISO 8601 creation timestamp",
  }),
  sentAt: z.string().nullable().openapi({
    example: null,
    description: "ISO 8601 send timestamp (null if not sent)",
  }),
  errorMessage: z.string().nullish().openapi({
    example: null,
    description: "Error message if send failed",
  }),
  createdBy: z.string().nullish().openapi({
    example: "user@example.com",
    description: "Email of user who created the post",
  }),
  linkedType: z.enum(["blog", "event", "document", "asset"]).nullish().openapi({
    example: "event",
    description: "Type of linked content",
  }),
  linkedId: z.string().nullish().openapi({
    example: "event-123",
    description: "ID of linked content",
  }),
  analytics: analyticsSchema.nullable().openapi({
    example: null,
    description: "Post analytics data (populated after sending)",
  }),
});

export type SocialQueuePost = z.infer<typeof socialQueueApiSchema>;

// ============================================================================
// ROUTES
// ============================================================================

/**
 * List all scheduled social posts with optional filtering
 */
export const listSocialQueueRoute = createRoute({
  method: "get",
  path: "/",
  request: {
    query: z.object({
      status: z
        .enum(["pending", "processing", "sent", "failed", "cancelled", "all"])
        .optional()
        .openapi({ example: "pending" }),
      limit: z.coerce
        .number()
        .min(1)
        .max(100)
        .default(20)
        .openapi({ example: 20 }),
      offset: z.coerce.number().min(0).default(0).openapi({ example: 0 }),
    }),
  },
  responses: {
    ...openApiStandardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            posts: z.array(socialQueueApiSchema),
            total: z.number().openapi({ example: 42 }),
          }),
        },
      },
      description: "List all scheduled social posts",
    },
  },
});

/**
 * Get posts within a date range for calendar view
 */
export const calendarSocialQueueRoute = createRoute({
  method: "get",
  path: "/calendar",
  request: {
    query: z.object({
      start: z.string().openapi({
        example: "2026-05-01",
        description: "Start date (ISO format)",
      }),
      end: z.string().openapi({
        example: "2026-05-31",
        description: "End date (ISO format)",
      }),
    }),
  },
  responses: {
    ...openApiStandardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            posts: z.array(socialQueueApiSchema),
          }),
        },
      },
      description: "Get posts within a date range for calendar view",
    },
  },
});

/**
 * Create a new scheduled social post
 */
export const createSocialQueueRoute = createRoute({
  method: "post",
  path: "/",
  request: {
    body: {
      content: {
        "application/json": {
          schema: socialQueueApiSchema.omit({
            id: true,
            status: true,
            createdAt: true,
            sentAt: true,
            errorMessage: true,
            analytics: true,
            createdBy: true,
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
            success: z.boolean().openapi({ example: true }),
            post: socialQueueApiSchema,
          }),
        },
      },
      description: "Create a new scheduled social post",
    },
  },
});

/**
 * Update a scheduled social post
 */
export const updateSocialQueueRoute = createRoute({
  method: "patch",
  path: "/{id}",
  request: {
    params: z.object({
      id: z.string().openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
    }),
    body: {
      content: {
        "application/json": {
          schema: socialQueueApiSchema
            .omit({
              id: true,
              createdAt: true,
              createdBy: true,
            })
            .partial(),
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
            success: z.boolean().openapi({ example: true }),
            post: socialQueueApiSchema,
          }),
        },
      },
      description: "Update a scheduled social post",
    },
  },
});

/**
 * Cancel/delete a scheduled social post
 */
export const deleteSocialQueueRoute = createRoute({
  method: "delete",
  path: "/{id}",
  request: {
    params: z.object({
      id: z.string().openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
    }),
  },
  responses: {
    ...openApiStandardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean().openapi({ example: true }),
          }),
        },
      },
      description: "Cancel/delete a scheduled social post",
    },
  },
});

/**
 * Immediately send a scheduled post
 */
export const sendNowSocialQueueRoute = createRoute({
  method: "post",
  path: "/{id}/send-now",
  request: {
    params: z.object({
      id: z.string().openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
    }),
  },
  responses: {
    ...openApiStandardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean().openapi({ example: true }),
          }),
        },
      },
      description: "Immediately send a scheduled post",
    },
  },
});

/**
 * Get analytics for social media posts
 */
export const analyticsSocialQueueRoute = createRoute({
  method: "get",
  path: "/analytics",
  request: {
    query: z.object({
      start: z.string().optional().openapi({
        example: "2026-05-01",
        description: "Start date filter (optional)",
      }),
      end: z.string().optional().openapi({
        example: "2026-05-31",
        description: "End date filter (optional)",
      }),
    }),
  },
  responses: {
    ...openApiStandardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            totalPosts: z.number().openapi({ example: 42 }),
            totalSent: z.number().openapi({ example: 38 }),
            totalPending: z.number().openapi({ example: 4 }),
            totalFailed: z.number().openapi({ example: 0 }),
            byPlatform: z.object({
              twitter: z.number().openapi({ example: 15 }),
              bluesky: z.number().openapi({ example: 12 }),
              facebook: z.number().openapi({ example: 8 }),
              instagram: z.number().openapi({ example: 20 }),
              discord: z.number().openapi({ example: 5 }),
              slack: z.number().openapi({ example: 2 }),
              teams: z.number().openapi({ example: 1 }),
              gchat: z.number().openapi({ example: 3 }),
              linkedin: z.number().openapi({ example: 10 }),
              tiktok: z.number().openapi({ example: 0 }),
              band: z.number().openapi({ example: 0 }),
            }),
            engagement: z.object({
              totalImpressions: z.number().openapi({ example: 12500 }),
              totalLikes: z.number().openapi({ example: 850 }),
              totalShares: z.number().openapi({ example: 120 }),
              totalComments: z.number().openapi({ example: 45 }),
            }),
          }),
        },
      },
      description: "Get analytics for social media posts",
    },
  },
});

export type SocialAnalyticsResponse = z.infer<
  (typeof analyticsSocialQueueRoute.responses)[200]["content"]["application/json"]["schema"]
>;
