import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

export const ErrorSchema = z.object({ error: z.string() });

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
  user_id: z.string(),
  first_name: z.string(),
  last_name: z.string().nullable(),
  nickname: z.string().nullable(),
  member_type: z.string(),
  points_balance: z.number(),
});

export type PointsTransaction = z.infer<typeof PointsTransactionSchema>;

export const pointsContract = c.router({
  getBalance: {
    method: "GET",
    path: "/balance/:user_id",
    pathParams: z.object({ user_id: z.string() }),
    responses: {
      200: PointsBalanceSchema,
      401: ErrorSchema,
      403: ErrorSchema,
      500: ErrorSchema,
    },
    summary: "Get user point balance",
  },
  getHistory: {
    method: "GET",
    path: "/history/:user_id",
    pathParams: z.object({ user_id: z.string() }),
    responses: {
      200: z.array(PointsTransactionSchema),
      401: ErrorSchema,
      403: ErrorSchema,
      500: ErrorSchema,
    },
    summary: "Get user point history",
  },
  awardPoints: {
    method: "POST",
    path: "/transaction",
    body: z.object({
      user_id: z.string(),
      points_delta: z.number(),
      reason: z.string().min(1),
    }),
    responses: {
      200: PointsTransactionSchema,
      400: ErrorSchema,
      401: ErrorSchema,
      403: ErrorSchema,
      500: ErrorSchema,
    },
    summary: "Award or deduct points (Admin)",
  },
  getLeaderboard: {
    method: "GET",
    path: "/leaderboard",
    responses: {
      200: z.object({
        leaderboard: z.array(PointsLeaderboardEntrySchema),
      }),
      500: ErrorSchema,
    },
    summary: "Get global points leaderboard",
  },
});
