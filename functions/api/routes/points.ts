import { typedHandler } from "../utils/handler";
import { OpenAPIHono } from "@hono/zod-openapi";

import { AppEnv } from "../middleware";
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

pointsRouter.openapi(getPointsBalanceRoute, typedHandler<typeof getPointsBalanceRoute>(async (c) => {
  const { user_id } = c.req.valid("param");
    const sessionUser = c.get("sessionUser");
    if (!sessionUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    if (sessionUser.role !== "admin" && sessionUser.id !== user_id) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const db = getDb(c);
    const ledger = await db
      .select({ points_delta: schema.pointsLedger.pointsDelta })
      .from(schema.pointsLedger)
      .where(eq(schema.pointsLedger.userId, user_id))
      .all();

    const balance = ledger.reduce((sum, tx) => sum + (tx.points_delta || 0), 0);

    return c.json({ user_id, balance }, 200);
}));

pointsRouter.openapi(getPointsHistoryRoute, typedHandler<typeof getPointsHistoryRoute>(async (c) => {
  const { user_id } = c.req.valid("param");
    const sessionUser = c.get("sessionUser");
    if (!sessionUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    if (sessionUser.role !== "admin" && sessionUser.id !== user_id) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const db = getDb(c);
    const history = await db
      .select()
      .from(schema.pointsLedger)
      .where(eq(schema.pointsLedger.userId, user_id))
      .orderBy(desc(schema.pointsLedger.createdAt))
      .all();

    type PointsLedgerRow = typeof schema.pointsLedger.$inferSelect;
    return c.json(history.map((tx: PointsLedgerRow) => ({
      ...tx,
      points_delta: tx.pointsDelta,
      user_id: tx.userId,
      created_by: tx.createdBy,
      id: tx.id || "",
      created_at: tx.createdAt || null
    })), 200);
}));

pointsRouter.openapi(awardPointsRoute, typedHandler<typeof awardPointsRoute>(async (c) => {
  const { user_id, points_delta, reason } = c.req.valid("json");
    const sessionUser = c.get("sessionUser");
    if (!sessionUser || sessionUser.role !== "admin") {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const db = getDb(c);

    const id = crypto.randomUUID();

    const newTx = {
      id,
      userId: user_id,
      pointsDelta: points_delta,
      reason,
      createdAt: new Date().toISOString(),
      createdBy: sessionUser.id
    };

    await db.insert(schema.pointsLedger).values(newTx).run();

    return c.json({ 
      success: true, 
      transaction_id: id 
    }, 201);
}));

pointsRouter.openapi(getPointsLeaderboardRoute, typedHandler<typeof getPointsLeaderboardRoute>(async (c) => {
    const db = getDb(c);

    const results = await db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        role: schema.user.role,
        points_balance: sum(schema.pointsLedger.pointsDelta).mapWith(Number).as("points_balance")
      })
      .from(schema.user)
      .leftJoin(schema.pointsLedger, eq(schema.user.id, schema.pointsLedger.userId))
      .groupBy(schema.user.id)
      .orderBy(desc(sql`points_balance`))
      .limit(50)
      .all();

    const leaderboard = results.map((r) => {
      return {
        id: String(r.id),
        name: r.name || "Anonymous",
        nickname: null,
        member_type: String(r.role || "student"),
        points_balance: Number(r.points_balance || 0),
        avatar: null
      };
    });

    return c.json({ leaderboard }, 200);
}));

export default pointsRouter;

