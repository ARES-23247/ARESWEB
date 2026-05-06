/* eslint-disable @typescript-eslint/no-explicit-any */
import { typedHandler } from "../utils/handler";
 
import { Kysely, ExpressionBuilder } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { OpenAPIHono } from "@hono/zod-openapi";

import { AppEnv, ensureAdmin, rateLimitMiddleware, logAuditAction, getSessionUser } from "../middleware";
import * as financeRoutes from "../../../shared/routes/finance";



export const financeRouter = new OpenAPIHono<AppEnv>();

// CR-06 FIX: Apply authentication and rate limiting to all finance routes
financeRouter.use("*", ensureAdmin);
financeRouter.use("*", rateLimitMiddleware(30, 60));

// GET /finance/summary - Get financial summary for a season
financeRouter.openapi(financeRoutes.getSummaryRoute, typedHandler<typeof financeRoutes.getSummaryRoute>(async (c) => {
  try {
    const { season_id } = c.req.valid("query");
    const db = c.get("db") as Kysely<DB>;

    let latestSeasonId: number | undefined | null = season_id;
    if (!latestSeasonId) {
      const latest = await db.selectFrom("seasons").selectAll().orderBy("start_year", "desc").executeTakeFirst();
      latestSeasonId = latest?.start_year;
    }

    if (!latestSeasonId) {
      return c.json({
        total_income: 0,
        total_expenses: 0,
        balance: 0,
        season_id: null
      } as any, 200 as any);
    }

    const summary = await db
      .selectFrom("finance_transactions")
      .select([
        "type",
        (eb: ExpressionBuilder<DB, "finance_transactions">) => eb.fn.sum("amount").as("total")
      ])
      .where("season_id", "=", Number(latestSeasonId))
      .groupBy("type")
      .execute();

    const totals = {
      income: Number(summary.find((s) => s.type === "income")?.total || 0),
      expense: Number(summary.find((s) => s.type === "expense")?.total || 0),
    };

    return c.json({
      total_income: totals.income,
      total_expenses: totals.expense,
      balance: totals.income - totals.expense,
      season_id: Number(latestSeasonId),
    } as any, 200 as any);
  } catch (e) {
    console.error("[Finance:Summary] Error", e);
    return c.json({ error: e instanceof Error ? e.message : "Failed to fetch summary" } as any, 500 as any);
  }
}));

// GET /finance/sponsorship - List sponsorship pipeline items
financeRouter.openapi(financeRoutes.listPipelineRoute, typedHandler<typeof financeRoutes.listPipelineRoute>(async (c) => {
  try {
    const { season_id } = c.req.valid("query");
    const db = c.get("db") as Kysely<DB>;
    let queryBuilder = db.selectFrom("sponsorship_pipeline").selectAll();
    if (season_id) {
      queryBuilder = queryBuilder.where("season_id", "=", Number(season_id));
    }
    const pipeline = await queryBuilder.orderBy("created_at", "desc").execute();
    const pipelineIds = pipeline.map(p => p.id).filter(Boolean);

    let assignments: Array<{ sponsorship_id: string; user_id: string }> = [];
    if (pipelineIds.length > 0) {
      assignments = await db.selectFrom("sponsorship_assignments").selectAll().where("sponsorship_id", "in", pipelineIds).execute();
    }

    const result = pipeline.map(p => ({
      ...p,
      season_id: p.season_id ? Number(p.season_id) : null,
      estimated_value: Number(p.estimated_value || 0),
      status: (p.status || "potential").toLowerCase(),
      assignees: assignments.filter(a => a.sponsorship_id === p.id).map(a => a.user_id)
    }));

    return c.json({ pipeline: result } as any, 200 as any);
  } catch (e) {
    console.error("[Finance:ListPipeline] Error", e);
    return c.json({ error: e instanceof Error ? e.message : "Failed to fetch pipeline" } as any, 500 as any);
  }
}));

// POST /finance/sponsorship - Create or update a sponsorship pipeline item
financeRouter.openapi(financeRoutes.savePipelineRoute, typedHandler<typeof financeRoutes.savePipelineRoute>(async (c) => {
  try {
    const body = c.req.valid("json");
    const db = c.get("db") as Kysely<DB>;
    const user = await getSessionUser(c);

    // CR-05 FIX: Require proper authorization for pipeline modifications
    if (!user) return c.json({ error: "Unauthorized" } as any, 401 as any);
    if (user.role !== "admin" && user.member_type !== "mentor" && user.member_type !== "coach") {
      return c.json({ error: "Insufficient permissions" } as any, 403 as any);
    }

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
      zulip_message_id: body.zulip_message_id || null,
    };

    if (isNew) {
      await db.insertInto("sponsorship_pipeline").values(data).execute();
    } else {
      await db.updateTable("sponsorship_pipeline").set(data).where("id", "=", id).execute();
    }

    if (body.assignees) {
      await db.deleteFrom("sponsorship_assignments").where("sponsorship_id", "=", id).execute();
      if (body.assignees.length > 0) {
        const insertData = body.assignees.map((userId: string) => ({
          sponsorship_id: id,
          user_id: userId
        }));
        await db.insertInto("sponsorship_assignments").values(insertData).execute();
      }
    }

    if (body.status === "secured" && currentStatus !== "secured") {
      let existingTxQuery = db
        .selectFrom("finance_transactions")
        .select("id")
        .where("description", "=", `Sponsorship from ${body.company_name}`)
        .where("amount", "=", body.estimated_value || 0);

      if (body.season_id) {
        existingTxQuery = existingTxQuery.where("season_id", "=", Number(body.season_id));
      }

      const existingTx = await existingTxQuery.executeTakeFirst();

      if (!existingTx) {
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
    }

    await logAuditAction(c, isNew ? "create" : "update", "sponsorship_pipeline", id);
    return c.json({ success: true, id } as any, 200 as any);
  } catch (e) {
    console.error("[Finance:SavePipeline] Error", e);
    return c.json({ error: e instanceof Error ? e.message : "Failed to save pipeline" } as any, 500 as any);
  }
}));

// DELETE /finance/sponsorship/{id} - Delete a sponsorship pipeline item
financeRouter.openapi(financeRoutes.deletePipelineRoute, typedHandler<typeof financeRoutes.deletePipelineRoute>(async (c) => {
  try {
    const { id } = c.req.valid("param");
    const db = c.get("db") as Kysely<DB>;
    await db.deleteFrom("sponsorship_pipeline").where("id", "=", id).execute();
    await logAuditAction(c, "delete", "sponsorship_pipeline", id);
    return c.json({ success: true } as any, 200 as any);
  } catch (e) {
    console.error("[Finance:DeletePipeline] Error", e);
    return c.json({ error: e instanceof Error ? e.message : "Failed to delete pipeline" } as any, 500 as any);
  }
}));

// GET /finance/transactions - List financial transactions
financeRouter.openapi(financeRoutes.listTransactionsRoute, typedHandler<typeof financeRoutes.listTransactionsRoute>(async (c) => {
  try {
    const { season_id, type } = c.req.valid("query");
    const db = c.get("db") as Kysely<DB>;
    let queryBuilder = db.selectFrom("finance_transactions").selectAll();
    if (season_id) {
      queryBuilder = queryBuilder.where("season_id", "=", season_id);
    }
    if (type) {
      queryBuilder = queryBuilder.where("type", "=", type);
    }
    const transactions = await queryBuilder.orderBy("date", "desc").execute();

    return c.json({
      transactions: transactions.map(t => ({
        ...t,
        season_id: t.season_id ? Number(t.season_id) : null,
        amount: Number(t.amount)
      }))
    } as any, 200 as any);
  } catch (e) {
    console.error("[Finance:ListTransactions] Error", e);
    return c.json({ error: e instanceof Error ? e.message : "Failed to fetch transactions" } as any, 500 as any);
  }
}));

// POST /finance/transactions - Create or update a financial transaction
financeRouter.openapi(financeRoutes.saveTransactionRoute, typedHandler<typeof financeRoutes.saveTransactionRoute>(async (c) => {
  try {
    const body = c.req.valid("json");
    const db = c.get("db") as Kysely<DB>;
    const user = await getSessionUser(c);

    // CR-05 FIX: Require proper authorization for transaction modifications
    if (!user) return c.json({ error: "Unauthorized" } as any, 401 as any);
    if (user.role !== "admin" && user.member_type !== "mentor" && user.member_type !== "coach") {
      return c.json({ error: "Insufficient permissions" } as any, 403 as any);
    }

    const id = body.id || crypto.randomUUID();
    const isNew = !body.id;

    // WR-15: Validate transaction amount and type
    const amount = Number(body.amount);
    if (isNaN(amount) || amount < 0 || amount > 1000000) {
      return c.json({ error: "Invalid amount: must be between 0 and 1,000,000" } as any, 400 as any);
    }

    const validTypes = ['income', 'expense'];
    if (!body.type || !validTypes.includes(body.type)) {
      return c.json({ error: "Invalid transaction type: must be 'income' or 'expense'" } as any, 400 as any);
    }

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
    return c.json({ success: true, id } as any, 200 as any);
  } catch (e) {
    console.error("[Finance:SaveTransaction] Error", e);
    return c.json({ error: e instanceof Error ? e.message : "Failed to save transaction" } as any, 500 as any);
  }
}));

// DELETE /finance/transactions/{id} - Delete a financial transaction
financeRouter.openapi(financeRoutes.deleteTransactionRoute, typedHandler<typeof financeRoutes.deleteTransactionRoute>(async (c) => {
  try {
    const { id } = c.req.valid("param");
    const db = c.get("db") as Kysely<DB>;
    const tx = await db
      .selectFrom("finance_transactions")
      .select("receipt_url")
      .where("id", "=", id)
      .executeTakeFirst();

    if (!tx) return c.json({ error: "Transaction not found" } as any, 404 as any);

    await db.deleteFrom("finance_transactions").where("id", "=", id).execute();

    if (tx.receipt_url && tx.receipt_url.includes("receipts/")) {
      const key = tx.receipt_url.split("receipts/")[1];
      try {
        if (c.executionCtx?.waitUntil && c.env?.ARES_STORAGE) {
          c.executionCtx.waitUntil(c.env.ARES_STORAGE.delete(`receipts/${key}`));
        }
      } catch (err) {
        console.warn("[Finance] No execution context available for bucket deletion", err);
      }
    }

    await logAuditAction(c, "delete", "finance_transactions", id);
    return c.json({ success: true } as any, 200 as any);
  } catch (e) {
    console.error("[Finance:DeleteTransaction] Error", e);
    return c.json({ error: e instanceof Error ? e.message : "Failed to delete transaction" } as any, 500 as any);
  }
}));

export default financeRouter;
