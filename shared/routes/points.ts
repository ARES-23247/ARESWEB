import { createRoute, z } from "@hono/zod-openapi";
import { standardErrors } from "./common";

export const PointsTransactionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  pointsDelta: z.number(),
  reason: z.string(),
  createdBy: z.string(),
  createdAt: z.string().nullable(),
});

export const PointsBalanceSchema = z.object({
  userId: z.string(),
  balance: z.number(),
});

export const PointsLeaderboardEntrySchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  nickname: z.string().nullable(),
  memberType: z.string().nullable(),
  pointsBalance: z.number(),
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
    ...standardErrors,
  },
  tags: ["points"],
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
    ...standardErrors,
  },
  tags: ["points"],
});

export const awardPointsRoute = createRoute({
  method: "post",
  path: "/transaction",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            userId: z.string(),
            pointsDelta: z.number(),
            reason: z.string().min(1),
          })
        }
      }
    }
  },
  responses: {
    201: {
      description: "Award or deduct points (Admin)",
      content: { "application/json": { schema: z.object({ success: z.boolean(), transactionId: z.string() }) } },
    },
    ...standardErrors,
  },
  tags: ["points", "admin"],
});

export const getPointsLeaderboardRoute = createRoute({
  method: "get",
  path: "/leaderboard",
  responses: {
    200: {
      description: "Get global points leaderboard",
      content: { "application/json": { schema: z.object({ leaderboard: z.array(PointsLeaderboardEntrySchema) }) } },
    },
    ...standardErrors,
  },
  tags: ["points"],
});
