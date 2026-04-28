import { Hono } from "hono";
import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { createHonoEndpoints, initServer } from "ts-rest-hono";
import { financeContract } from "../../../shared/schemas/contracts/financeContract";
import { ensureAdmin, rateLimitMiddleware, logAuditAction, getSessionUser } from "../middleware";
import { AppEnv } from "../middleware";

const financeRouter = new Hono<AppEnv>();
const s = initServer<AppEnv>();

const financeTsRestRouterObj: any = {
  getSummary: async (input: any, c: any) => {
    try {
      const { query } = input;
      const db = c.get("db") as Kysely<DB>;
      const seasonId = query.season_id;

      let latestSeasonId = seasonId;
      if (!latestSeasonId) {
        const latest = await db.selectFrom("seasons").selectAll().orderBy("start_year", "desc").executeTakeFirst();
        latestSeasonId = latest?.start_year;
      }

      if (!latestSeasonId) {
        return {
          status: 200 as const,
          body: { total_income: 0, total_expenses: 0, balance: 0, season_id: null },
        };
      }

      const summary = await db
        .selectFrom("finance_transactions")
        .select([
          "type",
          (eb: any) => eb.fn.sum("amount").as("total")
        ])
        .where("season_id", "=", latestSeasonId.toString())
        .groupBy("type")
        .execute();

      const totals = {
        income: Number(summary.find((s) => s.type === "income")?.total || 0),
        expense: Number(summary.find((s) => s.type === "expense")?.total || 0),
      };

      return {
        status: 200 as const,
        body: {
          total_income: totals.income,
          total_expenses: totals.expense,
          balance: totals.income - totals.expense,
          season_id: Number(latestSeasonId),
        },
      };
    } catch (e: any) {
      return { status: 500 as const, body: { error: e.stack || e.message } };
    }
  },

  listPipeline: async (input: any, c: any) => {
    try {
      const { query } = input;
      const db = c.get("db") as Kysely<DB>;
      let queryBuilder = db.selectFrom("sponsorship_pipeline").selectAll();
      if (query.season_id) {
        queryBuilder = queryBuilder.where("season_id", "=", query.season_id.toString());
      }
      const pipeline = await queryBuilder.orderBy("created_at", "desc").execute();
      return { 
        status: 200 as const, 
        body: { 
          pipeline: pipeline.map(p => ({
            ...p,
            season_id: p.season_id ? Number(p.season_id) : null,
            estimated_value: Number(p.estimated_value || 0),
            status: (p.status || "potential").toLowerCase() as any
          })) 
        } as any 
      };
    } catch (e: any) {
      return { status: 500 as const, body: { error: e.stack || e.message } };
    }
  },

  savePipeline: async (input: any, c: any) => {
    try {
      const { body } = input;
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      const id = body.id || crypto.randomUUID();
      const isNew = !body.id;

      let currentStatus = null;
      if (!isNew) {
        const existing = await db
          .selectFrom("sponsorship_pipeline")
          .select("status")
          .where("id", "=", id)
          .executeTakeFirst();
        currentStatus = existing?.status?.toLowerCase();
      }

      const data = {
        id,
        company_name: body.company_name,
        contact_person: body.contact_person || null,
        status: body.status,
        estimated_value: body.estimated_value ?? 0,
        season_id: body.season_id ? Number(body.season_id) : null,
        notes: body.notes || null,
      };

      if (isNew) {
        await db.insertInto("sponsorship_pipeline").values(data).execute();
      } else {
        await db.updateTable("sponsorship_pipeline").set(data).where("id", "=", id).execute();
      }


      if (body.status === "secured" && currentStatus !== "secured") {
        await db
          .insertInto("sponsors")
          .values({
            id: crypto.randomUUID(),
            name: body.company_name,
            tier: "Bronze",
            is_active: 1,
          })
          .execute();

        await db
          .insertInto("finance_transactions")
          .values({
            id: crypto.randomUUID(),
            amount: body.estimated_value || 0,
            type: "income",
            category: "Sponsorship",
            date: new Date().toISOString().split("T")[0],
            description: `Sponsorship from ${body.company_name}`,
            season_id: body.season_id ? Number(body.season_id) : null,
            logged_by: user?.id || "system",
          })
          .execute();
      }
      
      const result = { id };

      await logAuditAction(c, isNew ? "create" : "update", "sponsorship_pipeline", result.id);
      return { status: 200 as const, body: { success: true, id: result.id } };
    } catch (e: any) {
      return { status: 500 as const, body: { error: e.stack || e.message } };
    }
  },

  deletePipeline: async (input: any, c: any) => {
    try {
      const { params } = input || {};
      const id = params?.id || c.req?.param("id") || new URL(c.req.raw.url).pathname.split("/").pop();
      const db = c.get("db") as Kysely<DB>;
      await db.deleteFrom("sponsorship_pipeline").where("id", "=", id).execute();
      await logAuditAction(c, "delete", "sponsorship_pipeline", id);
      return { status: 200 as const, body: { success: true } };
    } catch (e: any) {
      return { status: 500 as const, body: { error: e.stack || e.message } };
    }
  },

  listTransactions: async (input: any, c: any) => {
    try {
      const { query } = input;
      const db = c.get("db") as Kysely<DB>;
      let queryBuilder = db.selectFrom("finance_transactions").selectAll();
      if (query.season_id) {
        queryBuilder = queryBuilder.where("season_id", "=", query.season_id.toString());
      }
      if (query.type) {
        queryBuilder = queryBuilder.where("type", "=", query.type);
      }
      const transactions = await queryBuilder.orderBy("date", "desc").execute();
      return { 
        status: 200 as const, 
        body: { 
          transactions: transactions.map(t => ({
            ...t,
            season_id: t.season_id ? Number(t.season_id) : null,
            amount: Number(t.amount)
          }))
        } as any 
      };
    } catch (e: any) {
      return { status: 500 as const, body: { error: e.stack || e.message } };
    }
  },

  saveTransaction: async (input: any, c: any) => {
    try {
      const { body } = input;
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      const id = body.id || crypto.randomUUID();
      const isNew = !body.id;

      const data = {
        id,
        amount: body.amount,
        type: body.type,
        category: body.category,
        date: body.date,
        description: body.description || null,
        receipt_url: body.receipt_url || null,
        season_id: body.season_id ? Number(body.season_id) : null,
        logged_by: user?.id || "system",
      };

      if (isNew) {
        await db.insertInto("finance_transactions").values(data).execute();
      } else {
        await db.updateTable("finance_transactions").set(data).where("id", "=", id).execute();
      }

      await logAuditAction(c, isNew ? "create" : "update", "finance_transactions", id);
      return { status: 200 as const, body: { success: true, id } };
    } catch (e: any) {
      return { status: 500 as const, body: { error: e.stack || e.message } };
    }
  },

  deleteTransaction: async (input: any, c: any) => {
    try {
      const { params } = input || {};
      const id = params?.id || c.req?.param("id") || new URL(c.req.raw.url).pathname.split("/").pop();
      const db = c.get("db") as Kysely<DB>;
      const tx = await db
        .selectFrom("finance_transactions")
        .select("receipt_url")
        .where("id", "=", id)
        .executeTakeFirst();

      if (!tx) return { status: 404 as const, body: { error: "Transaction not found" } };

      await db.deleteFrom("finance_transactions").where("id", "=", id).execute();

      if (tx.receipt_url && tx.receipt_url.includes("receipts/")) {
        const key = tx.receipt_url.split("receipts/")[1];
        c.executionCtx.waitUntil(c.env.ARES_STORAGE.delete(`receipts/${key}`));
      }

      await logAuditAction(c, "delete", "finance_transactions", id);
      return { status: 200 as const, body: { success: true } };
    } catch (e: any) {
      console.error("[Finance] Delete error:", e);
      return { status: 500 as const, body: { error: e.message } };
    }
  },
};

const financeTsRestRouter = s.router(financeContract, financeTsRestRouterObj as any);

financeRouter.use("*", ensureAdmin);
financeRouter.use("*", rateLimitMiddleware(30, 60));

createHonoEndpoints(financeContract, financeTsRestRouter, financeRouter);

export default financeRouter;
