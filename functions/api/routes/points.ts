import { Hono, Context } from "hono";
import { initServer, createHonoEndpoints } from "ts-rest-hono";
import { pointsContract } from "../../../shared/schemas/contracts/pointsContract";
import type { AppEnv } from "../middleware/utils";
import { Kysely } from "kysely";
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
  }
};

const pointsTsRestRouter = s.router(pointsContract, pointsHandlers as any);
createHonoEndpoints(pointsContract, pointsTsRestRouter, app);

export default app;
