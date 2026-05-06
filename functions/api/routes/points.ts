import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../../../shared/types/api";
import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { 
  getPointsBalanceRoute, 
  getPointsHistoryRoute, 
  awardPointsRoute, 
  getPointsLeaderboardRoute 
} from "../../../shared/routes/points";

export const pointsRouter = new OpenAPIHono<AppEnv>();

pointsRouter.openapi(getPointsBalanceRoute, async (c) => {
  const { user_id } = c.req.valid("param");
  try {
    const sessionUser = c.get("sessionUser");
    if (!sessionUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    if (sessionUser.role !== "admin" && sessionUser.id !== user_id) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const db = c.get("db") as Kysely<DB>;
    const ledger = await db
      .selectFrom("points_ledger")
      .select(["points_delta"])
      .where("user_id", "=", user_id)
      .execute();

    const balance = ledger.reduce((sum, tx) => sum + tx.points_delta, 0);

    return c.json({ user_id, balance }, 200);
  } catch (err) {
    console.error("[Points] Get balance failed:", err);
    return c.json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

pointsRouter.openapi(getPointsHistoryRoute, async (c) => {
  const { user_id } = c.req.valid("param");
  try {
    const sessionUser = c.get("sessionUser");
    if (!sessionUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    if (sessionUser.role !== "admin" && sessionUser.id !== user_id) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const db = c.get("db") as Kysely<DB>;
    const history = await db
      .selectFrom("points_ledger")
      .selectAll()
      .where("user_id", "=", user_id)
      .orderBy("created_at", "desc")
      .execute();

    return c.json(history.map((tx) => ({
      ...tx,
      id: tx.id || "",
      created_at: tx.created_at || null
    })), 200);
  } catch (err) {
    console.error("[Points] Get history failed:", err);
    return c.json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

pointsRouter.openapi(awardPointsRoute, async (c) => {
  const { user_id, points_delta, reason } = c.req.valid("json");
  try {
    const sessionUser = c.get("sessionUser");
    if (!sessionUser || sessionUser.role !== "admin") {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const db = c.get("db") as Kysely<DB>;

    const id = crypto.randomUUID();

    const newTx = {
      id,
      user_id,
      points_delta,
      reason,
      created_at: new Date().toISOString(),
      created_by: sessionUser.id
    };

    await db.insertInto("points_ledger").values(newTx).execute();

    return c.json({ 
      success: true, 
      transaction_id: id 
    }, 201);
  } catch (err) {
    console.error("[Points] Award points failed:", err);
    return c.json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

pointsRouter.openapi(getPointsLeaderboardRoute, async (c) => {
  try {
    const db = c.get("db") as Kysely<DB>;

    const results = await db
      .selectFrom("user")
      .leftJoin("points_ledger", "user.id", "points_ledger.user_id")
      .select([
        "user.id",
        "user.name",
        "user.role",
        (eb) => eb.fn.sum<number>("points_ledger.points_delta").as("points_balance")
      ])
      .groupBy("user.id")
      .orderBy("points_balance", "desc")
      .limit(50)
      .execute();

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
  } catch (err) {
    console.error("[Points] Get leaderboard failed:", err);
    return c.json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

export default pointsRouter;

