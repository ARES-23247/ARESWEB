import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { openApiStandardErrors } from "./common";

// Schemas
export const topPageSchema = z.object({
  path: z.string(),
  category: z.string(),
  views: z.number(),
});

export const recentViewSchema = z.object({
  path: z.string(),
  category: z.string(),
  userAgent: z.string(),
  referrer: z.string(),
  timestamp: z.string(),
});

export const totalSchema = z.object({
  category: z.string(),
  total: z.number(),
});

export const rosterStatSchema = z.object({
  userId: z.string(),
  nickname: z.string().nullable().optional(),
  memberType: z.string().nullable().optional(),
  attendedEvents: z.number(),
  manualPrepHours: z.number(),
  eventVolunteerHours: z.number(),
  avatar: z.string().nullable().optional(),
});

export const leaderboardEntrySchema = z.object({
  userId: z.string(),
  firstName: z.string(),
  lastName: z.string().nullable(),
  nickname: z.string().nullable(),
  memberType: z.string(),
  badgeCount: z.number(),
  avatar: z.string().nullable().optional(),
});

export const integrationsSchema = z.object({
  zulip: z.boolean(),
  github: z.boolean(),
  discord: z.boolean(),
  bluesky: z.boolean(),
  slack: z.boolean(),
  gcal: z.boolean(),
});

export const resourceUsageSchema = z.object({
  totalAssets: z.number(),
  totalStorage: z.number(),
  apiCalls: z.number(),
});

export const userActivitySchema = z.object({
  date: z.string(),
  pageViews: z.number(),
});

export const latencySchema = z.object({
  date: z.string(),
  avgLatency: z.number(),
});

export const searchResultSchema = z.object({
  type: z.string(),
  id: z.string(),
  title: z.string(),
  matched_text: z.string().optional(),
});

// Routes
export const trackPageViewRoute = createRoute({
  method: "post",
  path: "/track",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            path: z.string().optional(),
            category: z.string().optional(),
            referrer: z.string().optional(),
            "cf-turnstile-response": z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Page view tracked successfully",
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

export const trackSponsorClickRoute = createRoute({
  method: "post",
  path: "/sponsor-click",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            sponsorId: z.string(),
            "cf-turnstile-response": z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Sponsor click tracked successfully",
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

export const getRosterStatsRoute = createRoute({
  method: "get",
  path: "/admin/roster-stats",
  responses: {
    200: {
      description: "Get member impact roster stats",
      content: {
        "application/json": {
          schema: z.object({
            roster: z.array(rosterStatSchema),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

export const getLeaderboardRoute = createRoute({
  method: "get",
  path: "/leaderboard",
  responses: {
    200: {
      description: "Get badge leaderboard",
      content: {
        "application/json": {
          schema: z.object({
            leaderboard: z.array(leaderboardEntrySchema),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

export const getStatsRoute = createRoute({
  method: "get",
  path: "/admin/stats",
  responses: {
    200: {
      description: "Get platform stats",
      content: {
        "application/json": {
          schema: z.object({
            posts: z.number(),
            events: z.number(),
            docs: z.number(),
            integrations: integrationsSchema,
            securityBlocks: z.number().optional(),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

export const getPlatformAnalyticsRoute = createRoute({
  method: "get",
  path: "/admin/platform-analytics",
  responses: {
    200: {
      description: "Get comprehensive platform analytics",
      content: {
        "application/json": {
          schema: z.object({
            totalPageViews: z.number(),
            uniqueVisitors: z.number(),
            topPages: z.array(topPageSchema),
            topReferrers: z.array(
              z.object({
                referrer: z.string(),
                visits: z.number(),
              })
            ),
            recentViews: z.array(recentViewSchema),
            totals: z.array(totalSchema),
            userActivity: z.array(userActivitySchema),
            latency: z.array(latencySchema).optional(),
            resourceUsage: resourceUsageSchema,
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

export const searchRoute = createRoute({
  method: "get",
  path: "/search",
  request: {
    query: z.object({
      q: z.string(),
    }),
  },
  responses: {
    200: {
      description: "Search results",
      content: {
        "application/json": {
          schema: z.object({
            results: z.array(searchResultSchema),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});
