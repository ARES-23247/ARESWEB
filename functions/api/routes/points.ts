import { createTypedHandler } from "../utils/handler-native";
import { ApiError } from "../middleware/errorHandler";
import { OpenAPIHono } from "@hono/zod-openapi";

import { AppEnv, getSessionUser } from "../middleware";
import { eq, desc, sum, sql } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { getDb } from "../middleware";
import {
  getPointsBalanceRoute,
  getPointsHistoryRoute,
  awardPointsRoute,
  getPointsLeaderboardRoute
} from "../../../shared/routes/points";

export const pointsRouter = new OpenAPIHono<AppEnv>();

pointsRouter.openapi(getPointsBalanceRoute, createTypedHandler(getPointsBalanceRoute, async (c, { params }) => {
  const { user_id: userId } = params;
  const sessionUser = await getSessionUser(c);
  if (!sessionUser) {
    throw new ApiError("Unauthorized", 401);
  }

  if (sessionUser.role !== "admin" && sessionUser.id !== userId) {
    throw new ApiError("Forbidden", 403);
  }

  const db = getDb(c);
  const ledger = await db
    .select({ points_delta: schema.pointsLedger.pointsDelta })
    .from(schema.pointsLedger)
    .where(eq(schema.pointsLedger.userId, userId))
    .all();

  const balance = ledger.reduce((sum, tx) => sum + (tx.points_delta || 0), 0);

  return c.json({ userId, balance }, 200);
}));

pointsRouter.openapi(getPointsHistoryRoute, createTypedHandler(getPointsHistoryRoute, async (c, { params }) => {
  const { user_id: userId } = params;
  const sessionUser = await getSessionUser(c);
  if (!sessionUser) {
    throw new ApiError("Unauthorized", 401);
  }

  if (sessionUser.role !== "admin" && sessionUser.id !== userId) {
    throw new ApiError("Forbidden", 403);
  }

  const db = getDb(c);
  const history = await db
    .select()
    .from(schema.pointsLedger)
    .where(eq(schema.pointsLedger.userId, userId))
    .orderBy(desc(schema.pointsLedger.createdAt))
    .all();

  type PointsLedgerRow = typeof schema.pointsLedger.$inferSelect;
  const mappedHistory = history.map((tx: PointsLedgerRow) => ({
    ...tx,
    pointsDelta: tx.pointsDelta,
    userId: tx.userId,
    createdBy: tx.createdBy,
    id: tx.id || "",
    createdAt: tx.createdAt || null
  }));

  return c.json(mappedHistory, 200);
}));

pointsRouter.openapi(awardPointsRoute, createTypedHandler(awardPointsRoute, async (c, { body }) => {
  const sessionUser = await getSessionUser(c);
  if (!sessionUser || sessionUser.role !== "admin") {
    throw new ApiError("Unauthorized", 401);
  }

  const db = getDb(c);
  const id = crypto.randomUUID();

  const newTx = {
    id,
    userId: body.userId,
    pointsDelta: body.pointsDelta,
    reason: body.reason,
    createdAt: new Date().toISOString(),
    createdBy: sessionUser.id
  };

  await db.insert(schema.pointsLedger).values(newTx).run();

  return c.json({ success: true, transactionId: id }, 201);
}));

pointsRouter.openapi(getPointsLeaderboardRoute, createTypedHandler(getPointsLeaderboardRoute, async (c) => {
  const db = getDb(c);

  const results = await db
    .select({
      id: schema.user.id,
      name: schema.user.name,
      role: schema.user.role,
      pointsBalance: sum(schema.pointsLedger.pointsDelta).mapWith(Number).as("pointsBalance")
    })
    .from(schema.user)
    .leftJoin(schema.pointsLedger, eq(schema.user.id, schema.pointsLedger.userId))
    .groupBy(schema.user.id)
    .orderBy(desc(sql`pointsBalance`))
    .limit(50)
    .all();

  const leaderboard = results.map((r) => {
    return {
      id: String(r.id),
      name: r.name || "Anonymous",
      nickname: null,
      memberType: String(r.role || "student"),
      pointsBalance: Number(r.pointsBalance || 0),
      avatar: null
    };
  });

  return c.json({ leaderboard }, 200);
}));

export default pointsRouter;
