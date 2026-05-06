import { createRoute, z } from "@hono/zod-openapi";
import { openApiStandardErrors } from "./common";

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

export type SocialPlatforms = z.infer<typeof platformSchema>;

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

export const socialQueueSchema = z.object({
  id: z.string(),
  content: z.string().min(1).max(5000),
  media_urls: z.array(z.string().url()).optional(),
  scheduled_for: z.string(), // ISO timestamp
  platforms: platformSchema,
  status: z.enum(["pending", "processing", "sent", "failed", "cancelled"]),
  created_at: z.string(),
  sent_at: z.string().nullable(),
  error_message: z.string().nullable(),
  created_by: z.string().nullable(),
  linked_type: z.enum(["blog", "event", "document", "asset"]).nullable(),
  linked_id: z.string().nullable(),
  analytics: analyticsSchema.nullable(),
});

export type SocialQueuePost = z.infer<typeof socialQueueSchema>;

export const listSocialQueueRoute = createRoute({
  method: "get",
  path: "/",
  request: {
    query: z.object({
      status: z.enum(["pending", "processing", "sent", "failed", "cancelled", "all"]).optional(),
      limit: z.coerce.number().min(1).max(100).default(20),
      offset: z.coerce.number().min(0).default(0),
    }),
  },
  responses: {
    200: {
      description: "List all scheduled social posts",
      content: {
        "application/json": {
          schema: z.object({
            posts: z.array(socialQueueSchema),
            total: z.number(),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

export const calendarSocialQueueRoute = createRoute({
  method: "get",
  path: "/calendar",
  request: {
    query: z.object({
      start: z.string(), // ISO start date
      end: z.string(), // ISO end date
    }),
  },
  responses: {
    200: {
      description: "Get posts within a date range for calendar view",
      content: { "application/json": { schema: z.object({ posts: z.array(socialQueueSchema) }) } },
    },
    ...openApiStandardErrors,
  },
});

export const createSocialQueueRoute = createRoute({
  method: "post",
  path: "/",
  request: {
    body: {
      content: {
        "application/json": {
          schema: socialQueueSchema.omit({
            id: true,
            status: true,
            created_at: true,
            sent_at: true,
            error_message: true,
            analytics: true,
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Create a new scheduled social post",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            post: socialQueueSchema,
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

export const updateSocialQueueRoute = createRoute({
  method: "patch",
  path: "/{id}",
  request: {
    params: z.object({
      id: z.string(),
    }),
    body: {
      content: {
        "application/json": {
          schema: socialQueueSchema
            .omit({
              id: true,
              created_at: true,
              created_by: true,
            })
            .partial(),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Update a scheduled social post",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            post: socialQueueSchema,
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

export const deleteSocialQueueRoute = createRoute({
  method: "delete",
  path: "/{id}",
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      description: "Cancel/delete a scheduled social post",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const sendNowSocialQueueRoute = createRoute({
  method: "post",
  path: "/{id}/send-now",
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      description: "Immediately send a scheduled post",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const analyticsSocialQueueRoute = createRoute({
  method: "get",
  path: "/analytics",
  request: {
    query: z.object({
      start: z.string().optional(), // ISO start date
      end: z.string().optional(), // ISO end date
    }),
  },
  responses: {
    200: {
      description: "Get analytics for social media posts",
      content: {
        "application/json": {
          schema: z.object({
            total_posts: z.number(),
            total_sent: z.number(),
            total_pending: z.number(),
            total_failed: z.number(),
            by_platform: z.object({
              twitter: z.number(),
              bluesky: z.number(),
              facebook: z.number(),
              instagram: z.number(),
              discord: z.number(),
              slack: z.number(),
              teams: z.number(),
              gchat: z.number(),
              linkedin: z.number(),
              tiktok: z.number(),
              band: z.number(),
            }),
            engagement: z.object({
              total_impressions: z.number(),
              total_likes: z.number(),
              total_shares: z.number(),
              total_comments: z.number(),
            }),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});
