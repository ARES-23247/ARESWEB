import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
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
  mediaUrls: z.array(z.string().url()).optional(),
  scheduledFor: z.string(),
  platforms: platformSchema,
  status: z.enum(["pending", "processing", "sent", "failed", "cancelled"]),
  createdAt: z.string(),
  sentAt: z.string().nullable(),
  errorMessage: z.string().nullish(),
  createdBy: z.string().nullish(),
  linkedType: z.enum(["blog", "event", "document", "asset"]).nullish(),
  linkedId: z.string().nullish(),
  analytics: analyticsSchema.nullable(),
});

export type SocialQueuePost = z.infer<typeof socialQueueSchema>;

// Route: List social queue posts
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
    ...openApiStandardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            posts: z.array(socialQueueSchema),
            total: z.number(),
          }),
        },
      },
      description: "List all scheduled social posts",
    },
  },
});

// Route: Get calendar view posts
export const calendarSocialQueueRoute = createRoute({
  method: "get",
  path: "/calendar",
  request: {
    query: z.object({
      start: z.string(),
      end: z.string(),
    }),
  },
  responses: {
    ...openApiStandardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            posts: z.array(socialQueueSchema),
          }),
        },
      },
      description: "Get posts within a date range for calendar view",
    },
  },
});

// Route: Create social queue post
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
            success: z.boolean(),
            post: socialQueueSchema,
          }),
        },
      },
      description: "Create a new scheduled social post",
    },
  },
});

// Route: Update social queue post
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
            success: z.boolean(),
            post: socialQueueSchema,
          }),
        },
      },
      description: "Update a scheduled social post",
    },
  },
});

// Route: Delete social queue post
export const deleteSocialQueueRoute = createRoute({
  method: "delete",
  path: "/{id}",
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
      description: "Cancel/delete a scheduled social post",
    },
  },
});

// Route: Send post now
export const sendNowSocialQueueRoute = createRoute({
  method: "post",
  path: "/{id}/send-now",
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
      description: "Immediately send a scheduled post",
    },
  },
});

// Route: Get social queue analytics
export const analyticsSocialQueueRoute = createRoute({
  method: "get",
  path: "/analytics",
  request: {
    query: z.object({
      start: z.string().optional(),
      end: z.string().optional(),
    }),
  },
  responses: {
    ...openApiStandardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            totalPosts: z.number(),
            totalSent: z.number(),
            totalPending: z.number(),
            totalFailed: z.number(),
            byPlatform: z.object({
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
              totalImpressions: z.number(),
              totalLikes: z.number(),
              totalShares: z.number(),
              totalComments: z.number(),
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

