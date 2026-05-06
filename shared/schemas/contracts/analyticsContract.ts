import { createRoute, z } from "@hono/zod-openapi";
import { openApiStandardErrors } from "./common";

export const topPageSchema = z.object({
  path: z.string(),
  category: z.string(),
  views: z.number(),
});

export const recentViewSchema = z.object({
  path: z.string(),
  category: z.string(),
  user_agent: z.string(),
  referrer: z.string(),
  timestamp: z.string(),
});

export const totalSchema = z.object({
  category: z.string(),
  total: z.number(),
});

export const rosterStatSchema = z.object({
  user_id: z.string(),
  nickname: z.string().nullable().optional(),
  member_type: z.string().nullable().optional(),
  attended_events: z.number(),
  manual_prep_hours: z.number(),
  event_volunteer_hours: z.number(),
  avatar: z.string().nullable().optional(),
});

export const leaderboardEntrySchema = z.object({
  user_id: z.string(),
  first_name: z.string(),
  last_name: z.string().nullable(),
  nickname: z.string().nullable(),
  member_type: z.string(),
  badge_count: z.number(),
  avatar: z.string().nullable().optional(),
});

export const trackPageViewRequestBodySchema = z.object({
  path: z.string().optional(),
  category: z.string().optional(),
  referrer: z.string().optional(),
  "cf-turnstile-response": z.string().optional(),
});

export const trackSponsorClickRequestBodySchema = z.object({
  sponsor_id: z.string(),
  "cf-turnstile-response": z.string().optional(),
});

export const trackPageViewRoute = createRoute({
  method: "post",
  path: "/track",
  request: {
    body: {
      content: { "application/json": { schema: trackPageViewRequestBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Log a page view",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const trackSponsorClickRoute = createRoute({
  method: "post",
  path: "/sponsor-click",
  request: {
    body: {
      content: { "application/json": { schema: trackSponsorClickRequestBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Log a sponsor link click",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
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
      content: { "application/json": { schema: z.object({ roster: z.array(rosterStatSchema) }) } },
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
      content: { "application/json": { schema: z.object({ leaderboard: z.array(leaderboardEntrySchema) }) } },
    },
    ...openApiStandardErrors,
  },
});

export const getStatsRoute = createRoute({
  method: "get",
  path: "/admin/stats",
  responses: {
    200: {
      description: "Get platform statistics",
      content: {
        "application/json": {
          schema: z.object({
            posts: z.number(),
            events: z.number(),
            docs: z.number(),
            integrations: z.object({
              zulip: z.boolean(),
              github: z.boolean(),
              discord: z.boolean(),
              bluesky: z.boolean(),
              slack: z.boolean(),
              gcal: z.boolean(),
            }),
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
            topPages: z.array(
              z.object({
                path: z.string(),
                category: z.string(),
                views: z.number(),
              })
            ),
            topReferrers: z.array(
              z.object({
                referrer: z.string(),
                visits: z.number(),
              })
            ),
            recentViews: z.array(
              z.object({
                path: z.string(),
                category: z.string(),
                user_agent: z.string(),
                referrer: z.string(),
                timestamp: z.string(),
              })
            ),
            totals: z.array(
              z.object({
                category: z.string(),
                total: z.number(),
              })
            ),
            userActivity: z.array(
              z.object({
                date: z.string(),
                pageViews: z.number(),
              })
            ),
            latency: z.array(
              z.object({
                date: z.string(),
                avg_latency: z.number(),
              })
            ).optional(),
            resourceUsage: z.object({
              totalAssets: z.number(),
              totalStorage: z.number(),
              apiCalls: z.number(),
            }),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

export const searchAnalyticsQuerySchema = z.object({
  q: z.string(),
});

export const searchAnalyticsRoute = createRoute({
  method: "get",
  path: "/search",
  request: {
    query: searchAnalyticsQuerySchema,
  },
  responses: {
    200: {
      description: "Search analytics data",
      content: {
        "application/json": {
          schema: z.object({
            results: z.array(
              z.object({
                type: z.string(),
                id: z.string(),
                title: z.string(),
                matched_text: z.string().optional(),
              })
            ),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});
