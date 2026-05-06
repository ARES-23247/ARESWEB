import { createRoute, z } from "@hono/zod-openapi";
import { openApiStandardErrors } from "./common";

export const PointsTransactionSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  points_delta: z.number(),
  reason: z.string(),
  created_by: z.string(),
  created_at: z.string().nullable(),
});

export const PointsBalanceSchema = z.object({
  user_id: z.string(),
  balance: z.number(),
});

export const PointsLeaderboardEntrySchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  nickname: z.string().nullable(),
  member_type: z.string().nullable(),
  points_balance: z.number(),
  avatar: z.string().nullable(),
});

export const getPointsBalanceRoute = createRoute({
  method: "get",
  path: "/balance/{user_id}",
  request: {
    params: z.object({ user_id: z.string() }),
  },
  responses: {
    200: {
      description: "Get user point balance",
      content: { "application/json": { schema: PointsBalanceSchema } },
    },
    ...openApiStandardErrors,
  },
});

export const getPointsHistoryRoute = createRoute({
  method: "get",
  path: "/history/{user_id}",
  request: {
    params: z.object({ user_id: z.string() }),
  },
  responses: {
    200: {
      description: "Get user point history",
      content: { "application/json": { schema: z.array(PointsTransactionSchema) } },
    },
    ...openApiStandardErrors,
  },
});

export const awardPointsRoute = createRoute({
  method: "post",
  path: "/transaction",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            user_id: z.string(),
            points_delta: z.number(),
            reason: z.string().min(1),
          })
        }
      }
    }
  },
  responses: {
    201: {
      description: "Award or deduct points (Admin)",
      content: { "application/json": { schema: z.object({ success: z.boolean(), transaction_id: z.string() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const getPointsLeaderboardRoute = createRoute({
  method: "get",
  path: "/leaderboard",
  responses: {
    200: {
      description: "Get global points leaderboard",
      content: { "application/json": { schema: z.object({ leaderboard: z.array(PointsLeaderboardEntrySchema) }) } },
    },
    ...openApiStandardErrors,
  },
});
