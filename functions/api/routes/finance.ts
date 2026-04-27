import { Hono, Context } from "hono";
import { Kysely, sql } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { createHonoEndpoints, initServer } from "ts-rest-hono";
import { financeContract } from "../../../shared/schemas/contracts/financeContract";
import { AppEnv, ensureAdmin, logAuditAction, rateLimitMiddleware, getSessionUser } from "../middleware";

const s = initServer<AppEnv>();
export const financeRouter = new Hono<AppEnv>();

const financeTsRestRouter: any = s.router(financeContract as any, {
  getSummary: async ({ query }: any, c: Context<AppEnv>) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      let seasonId = query.season_id;
      
      if (!seasonId) {
        const latest = await db.selectFrom("seasons").select("start_year").orderBy("start_year", "desc").executeTakeFirst();
        seasonId = latest?.start_year ? Number(latest.start_year) : undefined;
      }

      if (!seasonId) {
        return { status: 200 as const, body: { total_income: 0, total_expenses: 0, balance: 0, season_id: null } };
      }

      const rows = await db.selectFrom("finance_transactions")
        .select(["type", sql<number>`SUM(amount)`.as("total")])
        .where("season_id", "=", seasonId as any)
        .groupBy("type")
        .execute();

      const summary = rows.reduce((acc, row) => {
        if (row.type === "income") acc.total_income = Number(row.total || 0);
        else acc.total_expenses = Number(row.total || 0);
        return acc;
      }, { total_income: 0, total_expenses: 0 });

      return {
        status: 200 as const,
        body: {
          ...summary,
          balance: summary.total_income - summary.total_expenses,
          season_id: seasonId
        }
      };
    } catch {
      return { status: 500 as const, body: { error: "Failed to calculate summary" } };
    }
  },

  listPipeline: async ({ query }: any, c: Context<AppEnv>) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      let seasonId = query.season_id;
      
      if (!seasonId) {
        const latest = await db.selectFrom("seasons").select("start_year").orderBy("start_year", "desc").executeTakeFirst();
        seasonId = latest?.start_year ? Number(latest.start_year) : undefined;
      }

      let q = db.selectFrom("sponsorship_pipeline").selectAll();
      if (seasonId) {
        q = q.where("season_id", "=", seasonId as any);
      }

      const results = await q.orderBy("created_at", "desc").execute();
      
      return {
        status: 200 as const,
        body: {
          pipeline: results.map(r => ({
            ...r,
            id: String(r.id),
            estimated_value: Number(r.estimated_value || 0),
            season_id: r.season_id ? Number(r.season_id) : null
          })) as any[]
        }
      };
    } catch {
      return { status: 500 as const, body: { error: "Failed to list pipeline" } };
    }
  },

  savePipeline: async ({ body }: any, c: Context<AppEnv>) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const id = body.id || crypto.randomUUID();
      const user = await getSessionUser(c);
      
      if (body.id) {
        // Fetch current status once before batching logic
        const existing = await db.selectFrom("sponsorship_pipeline")
          .select("status")
          .where("id", "=", body.id)
          .executeTakeFirst();
        
        if (!existing) return { status: 404 as const, body: { error: "Item not found" } };

        const batch: any[] = [];

        // Check for 'Secured' transition logic
        if (body.status === "secured" && existing.status !== "secured") {
          if (!body.sponsor_id) {
            const slug = body.company_name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
            batch.push(
              db.insertInto("sponsors")
                .values({
                  id: slug,
                  name: body.company_name,
                  tier: body.estimated_value >= 1000 ? "platinum" : body.estimated_value >= 500 ? "gold" : "silver",
                  is_active: 1
                })
                .onConflict(oc => oc.column("id").doNothing())
            );
            body.sponsor_id = slug;
          }

          batch.push(
            db.insertInto("finance_transactions")
              .values({
                id: crypto.randomUUID(),
                type: "income",
                amount: body.estimated_value || 0,
                category: "sponsorship",
                date: new Date().toISOString().split("T")[0],
                description: `Secured sponsorship: ${body.company_name}`,
                season_id: body.season_id,
                logged_by: user?.id || null,
              })
          );
        }

        // Final update to the pipeline item
        batch.push(
          db.updateTable("sponsorship_pipeline")
            .set({
              company_name: body.company_name,
              sponsor_id: body.sponsor_id,
              status: body.status,
              estimated_value: body.estimated_value,
              notes: body.notes,
              contact_person: body.contact_person,
              season_id: body.season_id,
              updated_at: sql`datetime('now')`
            })
            .where("id", "=", body.id)
        );

        // Execute as a single D1 Batch (1 Round-trip)
        if (batch.length > 0) {
          await db.transaction().execute(async (_trx) => {
            for (const b of batch) await b.execute();
          });
        }

        c.executionCtx.waitUntil(logAuditAction(c, "update_sponsorship_pipeline", "sponsorship_pipeline", body.id, `Updated pipeline item: ${body.company_name}`));
      } else {
        await db.insertInto("sponsorship_pipeline")
          .values({
            id,
            company_name: body.company_name,
            sponsor_id: body.sponsor_id || null,
            status: body.status || "potential",
            estimated_value: body.estimated_value || 0,
            notes: body.notes || null,
            contact_person: body.contact_person || null,
            season_id: body.season_id || null,
          })
          .execute();
        c.executionCtx.waitUntil(logAuditAction(c, "create_sponsorship_pipeline", "sponsorship_pipeline", id, `Created pipeline item: ${body.company_name}`));
      }
      return { status: 200 as const, body: { success: true, id } };
    } catch {
      return { status: 500 as const, body: { error: "Save failed" } };
    }
  },

  deletePipeline: async ({ params }: any, c: Context<AppEnv>) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      await db.deleteFrom("sponsorship_pipeline").where("id", "=", params.id).execute();
      c.executionCtx.waitUntil(logAuditAction(c, "delete_sponsorship_pipeline", "sponsorship_pipeline", params.id, "Pipeline item deleted"));
      return { status: 200 as const, body: { success: true } };
    } catch {
      return { status: 500 as const, body: { error: "Delete failed" } };
    }
  },

  listTransactions: async ({ query }: any, c: Context<AppEnv>) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      let seasonId = query.season_id;
      
      if (!seasonId) {
        const latest = await db.selectFrom("seasons").select("start_year").orderBy("start_year", "desc").executeTakeFirst();
        seasonId = latest?.start_year ? Number(latest.start_year) : undefined;
      }

      let q = db.selectFrom("finance_transactions").selectAll();
      if (seasonId) q = q.where("season_id", "=", seasonId as any);
      if (query.type) q = q.where("type", "=", query.type);

      const results = await q.orderBy("date", "desc").execute();
      
      return {
        status: 200 as const,
        body: {
          transactions: results.map(r => ({
            ...r,
            id: String(r.id),
            amount: Number(r.amount),
            season_id: r.season_id ? Number(r.season_id) : null
          })) as any[]
        }
      };
    } catch {
      return { status: 500 as const, body: { error: "Failed to list transactions" } };
    }
  },

  saveTransaction: async ({ body }: any, c: Context<AppEnv>) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      const id = body.id || crypto.randomUUID();
      
      if (body.id) {
        await db.updateTable("finance_transactions")
          .set({
            type: body.type,
            amount: body.amount,
            category: body.category,
            date: body.date,
            description: body.description,
            receipt_url: body.receipt_url,
            season_id: body.season_id,
          })
          .where("id", "=", body.id)
          .execute();
        c.executionCtx.waitUntil(logAuditAction(c, "update_finance_transaction", "finance_transactions", body.id, `Updated transaction: ${body.description || body.category}`));
      } else {
        await db.insertInto("finance_transactions")
          .values({
            id,
            type: body.type,
            amount: body.amount,
            category: body.category,
            date: body.date,
            description: body.description || null,
            receipt_url: body.receipt_url || null,
            season_id: body.season_id || null,
            logged_by: user?.id || null,
          })
          .execute();
        c.executionCtx.waitUntil(logAuditAction(c, "create_finance_transaction", "finance_transactions", id, `Created transaction: ${body.description || body.category}`));
      }
      return { status: 200 as const, body: { success: true, id } };
    } catch {
      return { status: 500 as const, body: { error: "Save failed" } };
    }
  },

  deleteTransaction: async ({ params }: any, c: Context<AppEnv>) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      
      // 1. Check for physical assets in R2
      const existing = await db.selectFrom("finance_transactions")
        .select("receipt_url")
        .where("id", "=", params.id)
        .executeTakeFirst();
      
      if (existing?.receipt_url && c.env.ARES_STORAGE) {
        try {
          const url = new URL(existing.receipt_url);
          const key = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
          c.executionCtx.waitUntil(c.env.ARES_STORAGE.delete(key));
        } catch (e) {
          console.error("[Finance] Failed to parse/delete R2 receipt:", e);
        }
      }

      await db.deleteFrom("finance_transactions").where("id", "=", params.id).execute();
      c.executionCtx.waitUntil(logAuditAction(c, "delete_finance_transaction", "finance_transactions", params.id, "Transaction deleted"));
      return { status: 200 as const, body: { success: true } };
    } catch {
      return { status: 500 as const, body: { error: "Delete failed" } };
    }
  },
} as any);

// Middlewares
financeRouter.use("*", ensureAdmin);
financeRouter.use("*", rateLimitMiddleware(30, 60));

createHonoEndpoints(financeContract, financeTsRestRouter, financeRouter);

export default financeRouter;
