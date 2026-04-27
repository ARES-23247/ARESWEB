import { Hono, Context } from "hono";
import { Kysely, sql } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { createHonoEndpoints, initServer } from "ts-rest-hono";
import { financeContract } from "../../../shared/schemas/contracts/financeContract";
import { AppEnv, ensureAdmin, logAuditAction, rateLimitMiddleware, getSessionUser } from "../middleware";
import { retryTransaction } from "../middleware/dbUtils";

const s = initServer<AppEnv>();
export const financeRouter = new Hono<AppEnv>();

const financeTsRestRouter = s.router(financeContract, {
  getSummary: async ({ query }, c) => {
    try {
      const db = c.get("db");
      const seasonId = query.season_id;
      
      const latest = await db.selectFrom("seasons").selectAll().orderBy("start_year", "desc").executeTakeFirst();
      const targetSeasonId = seasonId ?? (latest?.start_year ? Number(latest.start_year) : undefined);

      if (!targetSeasonId) {
        return {
          status: 200 as const,
          body: {
            total_income: 0,
            total_expenses: 0,
            balance: 0,
            season_id: null
          }
        };
      }

      const results = await db.selectFrom("finance_transactions")
        .select(["type", (eb) => eb.fn.sum<number>("amount").as("total")])
        .where("season_id", "=", targetSeasonId)
        .groupBy("type")
        .execute();

      const summary = {
        total_income: Number(results.find(r => r.type === "income")?.total || 0),
        total_expenses: Number(results.find(r => r.type === "expense")?.total || 0),
      };

      return {
        status: 200 as const,
        body: {
          ...summary,
          balance: summary.total_income - summary.total_expenses,
          season_id: targetSeasonId
        }
      };
    } catch (err) {
      console.error("[Finance] Summary failed:", err);
      return { status: 500 as const, body: { error: "Failed to calculate summary" } };
    }
  },

  listPipeline: async ({ query }, c) => {
    try {
      const db = c.get("db");
      const seasonId = query.season_id;

      let q = db.selectFrom("sponsorship_pipeline").selectAll();
      if (seasonId) q = q.where("season_id", "=", seasonId);
      
      const results = await q.orderBy("updated_at", "desc").execute();
      return { status: 200 as const, body: { pipeline: results as any } };
    } catch {
      return { status: 500 as const, body: { error: "Failed to fetch pipeline" } };
    }
  },

  savePipeline: async ({ body }, c) => {
    try {
      const db = c.get("db");
      const user = await getSessionUser(c);
      const id = body.id || crypto.randomUUID();

      await retryTransaction(db, async (trx) => {
        if (body.id) {
          const existing = await trx.selectFrom("sponsorship_pipeline")
            .select("status")
            .where("id", "=", body.id)
            .executeTakeFirst();
          
          if (!existing) throw new Error("Not found");

          // Atomic side-effect: If moving to Secured, create sponsor and transaction
          if (existing.status !== "Secured" && body.status === "Secured" && body.amount) {
            const sponsorId = crypto.randomUUID();
            const batch = [
              trx.insertInto("sponsors").values({
                id: sponsorId,
                name: body.company_name,
                tier: body.tier || "Bronze",
                season_id: body.season_id,
                amount: body.amount,
                status: "active"
              }),
              trx.insertInto("finance_transactions").values({
                id: crypto.randomUUID(),
                type: "income",
                amount: body.amount,
                category: "Sponsorship",
                description: `Sponsorship from ${body.company_name}`,
                date: new Date().toISOString().split("T")[0],
                season_id: body.season_id,
                created_by: user?.id || "system"
              })
            ];
            for (const b of batch) await b.execute();
          }

          await trx.updateTable("sponsorship_pipeline")
            .set({
              ...body,
              updated_at: sql`datetime('now')`
            })
            .where("id", "=", body.id)
            .execute();
        } else {
          await trx.insertInto("sponsorship_pipeline")
            .values({
              ...body,
              id,
              created_at: sql`datetime('now')`,
              updated_at: sql`datetime('now')`
            })
            .execute();
        }
      });

      c.executionCtx.waitUntil(logAuditAction(c, body.id ? "update_sponsorship" : "create_sponsorship", "sponsorship_pipeline", id, `Saved pipeline item for ${body.company_name}`));
      return { status: 200 as const, body: { success: true, id } };
    } catch (err: any) {
      if (err.message === "Not found") return { status: 404 as const, body: { error: "Not found" } } as any;
      return { status: 500 as const, body: { error: "Save failed" } };
    }
  },

  deletePipeline: async ({ params }, c) => {
    try {
      const db = c.get("db");
      await db.deleteFrom("sponsorship_pipeline").where("id", "=", params.id).execute();
      c.executionCtx.waitUntil(logAuditAction(c, "delete_sponsorship", "sponsorship_pipeline", params.id, "Deleted pipeline item"));
      return { status: 200 as const, body: { success: true } };
    } catch {
      return { status: 500 as const, body: { error: "Delete failed" } };
    }
  },

  listTransactions: async ({ query }, c) => {
    try {
      const db = c.get("db");
      let q = db.selectFrom("finance_transactions").selectAll();
      if (query.season_id) q = q.where("season_id", "=", query.season_id);
      if (query.type) q = q.where("type", "=", query.type);
      
      const results = await q.orderBy("date", "desc").execute();
      return { status: 200 as const, body: { transactions: results as any } };
    } catch {
      return { status: 500 as const, body: { error: "Failed to fetch transactions" } };
    }
  },

  saveTransaction: async ({ body }, c) => {
    try {
      const db = c.get("db");
      const user = await getSessionUser(c);
      const id = body.id || crypto.randomUUID();

      await retryTransaction(db, async (trx) => {
        if (body.id) {
          await trx.updateTable("finance_transactions")
            .set({
              ...body,
              updated_at: sql`datetime('now')`
            })
            .where("id", "=", body.id)
            .execute();
        } else {
          await trx.insertInto("finance_transactions")
            .values({
              ...body,
              id,
              created_by: user?.id || "system",
              created_at: sql`datetime('now')`,
              updated_at: sql`datetime('now')`
            })
            .execute();
        }
      });

      if (!body.id) {
        c.executionCtx.waitUntil(logAuditAction(c, "create_finance_transaction", "finance_transactions", id, `Created transaction: ${body.description || body.category}`));
      }
      return { status: 200 as const, body: { success: true, id } };
    } catch (err) {
      console.error("[Finance] Save failed:", err);
      return { status: 500 as const, body: { error: "Save failed" } };
    }
  },

  deleteTransaction: async ({ params }, c) => {
    try {
      const db = c.get("db");
      const existing = await db.selectFrom("finance_transactions")
        .select("receipt_url")
        .where("id", "=", params.id)
        .executeTakeFirst();
      
      if (!existing) return { status: 404 as const, body: { error: "Not found" } } as any;

      // EFF-01: Auto-cleanup R2 assets when transaction is deleted
      if (existing.receipt_url && c.env.ARES_STORAGE) {
        try {
          const url = new URL(existing.receipt_url);
          const key = url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname;
          c.executionCtx.waitUntil(c.env.ARES_STORAGE.delete(key));
        } catch (e) {
          console.error("[Finance] Failed to parse/delete R2 receipt:", e);
        }
      }

      await retryTransaction(db, async (trx) => {
        await trx.deleteFrom("finance_transactions").where("id", "=", params.id).execute();
      });

      c.executionCtx.waitUntil(logAuditAction(c, "delete_finance_transaction", "finance_transactions", params.id, "Deleted transaction"));
      return { status: 200 as const, body: { success: true } };
    } catch {
      return { status: 500 as const, body: { error: "Delete failed" } };
    }
  },
});

// Middlewares
financeRouter.use("*", ensureAdmin);
financeRouter.use("*", rateLimitMiddleware(30, 60));

createHonoEndpoints(financeContract, financeTsRestRouter, financeRouter);

export default financeRouter;
