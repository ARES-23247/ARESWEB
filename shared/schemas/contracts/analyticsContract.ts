import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

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
});

export const leaderboardEntrySchema = z.object({
  user_id: z.string(),
  first_name: z.string(),
  last_name: z.string().nullable(),
  nickname: z.string().nullable(),
  member_type: z.string(),
  badge_count: z.number(),
});

export const analyticsContract = c.router({
  trackPageView: {
    method: "POST",
    path: "/track",
    body: z.object({
      path: z.string().optional(),
      category: z.string().optional(),
      referrer: z.string().optional(),
      "cf-turnstile-response": z.string().optional(),
    }),
    responses: {
      200: z.object({ success: z.boolean() }),
      429: z.object({ success: z.boolean(), error: z.string() }),
      500: z.object({ success: z.boolean() }),
    },
    summary: "Log a page view",
  },
  trackSponsorClick: {
    method: "POST",
    path: "/sponsor-click",
    body: z.object({
      sponsor_id: z.string(),
      "cf-turnstile-response": z.string().optional(),
    }),
    responses: {
      200: z.object({ success: z.boolean() }),
      429: z.object({ success: z.boolean(), error: z.string() }),
      500: z.object({ success: z.boolean() }),
    },
    summary: "Log a sponsor link click",
  },
  getSummary: {
    method: "GET",
    path: "/admin/summary",
    responses: {
      200: z.object({
        topPages: z.array(topPageSchema),
        recentViews: z.array(recentViewSchema),
        totals: z.array(totalSchema),
      }),
      500: z.object({
        topPages: z.array(topPageSchema),
        recentViews: z.array(recentViewSchema),
        totals: z.array(totalSchema),
      }),
    },
    summary: "Get analytics summary for dashboard",
  },
  getRosterStats: {
    method: "GET",
    path: "/admin/roster-stats",
    responses: {
      200: z.object({
        roster: z.array(rosterStatSchema),
      }),
      500: z.object({
        roster: z.array(rosterStatSchema),
      }),
    },
    summary: "Get member impact roster stats",
  },
  getLeaderboard: {
    method: "GET",
    path: "/leaderboard",
    responses: {
      200: z.object({
        leaderboard: z.array(leaderboardEntrySchema),
      }),
      500: z.object({ error: z.string() }),
    },
  },
  getStats: {
    method: "GET",
    path: "/admin/stats",
    responses: {
      200: z.object({
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
      }),
      500: z.object({ error: z.string() }),
    },
  },
  search: {
    method: "GET",
    path: "/search",
    query: z.object({
      q: z.string(),
    }),
    responses: {
      200: z.object({
        results: z.array(
          z.object({
            type: z.string(),
            id: z.string(),
            title: z.string(),
            matched_text: z.string().optional(),
          }),
        ),
      }),
      500: z.object({ error: z.string() }),
    },
  },
});
