import { Hono, Context } from "hono";
import { initServer, createHonoEndpoints } from "ts-rest-hono";
import { pointsContract } from "../../../shared/schemas/contracts/pointsContract";
import type { AppEnv } from "../middleware/utils";
import { Kysely, sql } from "kysely";
import { DB } from "../../../shared/schemas/database";

const app = new Hono<AppEnv>();
const s = initServer<AppEnv>();

const pointsHandlers = {
  getBalance: async ({ params }: any, c: Context<AppEnv>) => {
    try {
      const sessionUser = c.get("sessionUser");
      if (!sessionUser) {
        return { status: 401 as const, body: { error: "Unauthorized" } };
      }

      if (sessionUser.role !== "admin" && sessionUser.id !== params.user_id) {
        return { status: 403 as const, body: { error: "Forbidden" } };
      }

      const db = c.get("db") as Kysely<DB>;
      const ledger = await db
        .selectFrom("points_ledger")
        .select(["points_delta"])
        .where("user_id", "=", params.user_id)
        .execute();

      const balance = ledger.reduce((sum, tx) => sum + tx.points_delta, 0);

      return {
        status: 200 as const,
        body: { user_id: params.user_id, balance }
      };
    } catch (err: any) {
      console.error("[Points] Get balance failed:", err);
      return { status: 500 as const, body: { error: err.message } };
    }
  },
  getHistory: async ({ params }: any, c: Context<AppEnv>) => {
    try {
      const sessionUser = c.get("sessionUser");
      if (!sessionUser) {
        return { status: 401 as const, body: { error: "Unauthorized" } };
      }

      if (sessionUser.role !== "admin" && sessionUser.id !== params.user_id) {
        return { status: 403 as const, body: { error: "Forbidden" } };
      }

      const db = c.get("db") as Kysely<DB>;
      const history = await db
        .selectFrom("points_ledger")
        .selectAll()
        .where("user_id", "=", params.user_id)
        .orderBy("created_at", "desc")
        .execute();

      return {
        status: 200 as const,
        body: history.map((tx) => ({
          ...tx,
          id: tx.id || "",
          created_at: tx.created_at || null
        }))
      };
    } catch (err: any) {
      console.error("[Points] Get history failed:", err);
      return { status: 500 as const, body: { error: err.message } };
    }
  },
  awardPoints: async ({ body }: any, c: Context<AppEnv>) => {
    try {
      const sessionUser = c.get("sessionUser");
      if (!sessionUser || sessionUser.role !== "admin") {
        return { status: 401 as const, body: { error: "Unauthorized" } };
      }

      const { user_id, points_delta, reason } = body;
      const db = c.get("db") as Kysely<DB>;

      const id =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `pt-${Date.now()}`;

      const newTx = {
        id,
        user_id,
        points_delta,
        reason,
        created_by: sessionUser.id,
      };

      await db
        .insertInto("points_ledger")
        .values(newTx)
        .execute();

      return {
        status: 200 as const,
        body: {
          ...newTx,
          created_at: new Date().toISOString()
        }
      };
    } catch (err: any) {
      console.error("[Points] Award points failed:", err);
      return { status: 500 as const, body: { error: err.message } };
    }
  },
  getLeaderboard: async (_: any, c: Context<AppEnv>) => {
    const db = c.get("db") as Kysely<DB>;
    try {
      const results = await db.selectFrom("user as u")
        .innerJoin("user_profiles as p", "u.id", "p.user_id")
        .leftJoin("points_ledger as pl", "u.id", "pl.user_id")
        .select([
          "u.id as user_id",
          "u.name as first_name",
          "p.last_name",
          "p.nickname",
          "p.member_type",
          (eb) => eb.fn.coalesce(eb.fn.sum("pl.points_delta"), sql<number>`0`).as("points_balance")
        ])
        .where("p.show_on_about", "=", 1)
        .groupBy(["u.id", "u.name", "p.last_name", "p.nickname", "p.member_type"])
        .having((eb) => eb.fn.coalesce(eb.fn.sum("pl.points_delta"), sql<number>`0`), ">", 0)
        .orderBy("points_balance", "desc")
        .limit(50)
        .execute();

      const leaderboard = results.map(r => {
        const isMinor = r.member_type === "student";
        return {
          user_id: String(r.user_id),
          first_name: isMinor ? "ARES Member" : String(r.first_name || "ARES"),
          last_name: isMinor ? null : (r.last_name || null),
          nickname: r.nickname || null,
          member_type: String(r.member_type || "student"),
          points_balance: Number(r.points_balance)
        };
      });

      return { status: 200 as const, body: { leaderboard } };
    } catch (err: any) {
      console.error("[Points] Get leaderboard failed:", err);
      return { status: 500 as const, body: { error: err.message } };
    }
  }
};

const pointsTsRestRouter = s.router(pointsContract, pointsHandlers as any);
createHonoEndpoints(pointsContract, pointsTsRestRouter, app);

export default app;
