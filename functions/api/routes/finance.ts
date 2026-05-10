import { autoResponseHandler, success, error } from "../utils/handler-v2";
import { ApiError } from "../middleware/errorHandler";

import { eq, desc, inArray, sum, and } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { OpenAPIHono } from "@hono/zod-openapi";

import { AppEnv, ensureAdmin, rateLimitMiddleware, logAuditAction, getSessionUser, getDb } from "../middleware";

import * as financeRoutes from "../../../shared/routes/finance";
import type { z } from "zod";

// ─── Type Inference Helpers ────────────────────────────────────────────────────────────────────────────────────────────────
// Infer success response types from route schemas for proper type safety with handler-v2


type GetSummarySuccess = z.infer<typeof financeRoutes.getSummaryRoute.responses[200]["content"]["application/json"]["schema"]>;


type ListPipelineSuccess = z.infer<typeof financeRoutes.listPipelineRoute.responses[200]["content"]["application/json"]["schema"]>;


type SavePipelineSuccess = z.infer<typeof financeRoutes.savePipelineRoute.responses[200]["content"]["application/json"]["schema"]>;


type DeletePipelineSuccess = z.infer<typeof financeRoutes.deletePipelineRoute.responses[200]["content"]["application/json"]["schema"]>;


type ListTransactionsSuccess = z.infer<typeof financeRoutes.listTransactionsRoute.responses[200]["content"]["application/json"]["schema"]>;


type SaveTransactionSuccess = z.infer<typeof financeRoutes.saveTransactionRoute.responses[200]["content"]["application/json"]["schema"]>;


type DeleteTransactionSuccess = z.infer<typeof financeRoutes.deleteTransactionRoute.responses[200]["content"]["application/json"]["schema"]>;

// Database query result types


interface SponsorshipAssignment {
  sponsorshipId: string;
  userId: string;
}

export const financeRouter = new OpenAPIHono<AppEnv>();

// CR-06 FIX: Apply authentication and rate limiting to all finance routes
financeRouter.use("*", ensureAdmin);
financeRouter.use("*", rateLimitMiddleware(30, 60));

// GET /finance/summary - Get financial summary for a season
financeRouter.openapi(financeRoutes.getSummaryRoute, autoResponseHandler<typeof financeRoutes.getSummaryRoute>(async (c, { query }) => {
    const { seasonId } = query;
    const db = getDb(c);

    let latestSeasonId: number | undefined | null = seasonId;
    if (!latestSeasonId) {
      const latest = await db.select().from(schema.seasons).orderBy(desc(schema.seasons.startYear)).get();
      latestSeasonId = latest?.startYear;
    }

    if (!latestSeasonId) {
      return success({
        totalIncome: 0,
        totalExpenses: 0,
        balance: 0,
        seasonId: null
      } satisfies GetSummarySuccess);
    }

    const summary = await db
      .select({
        type: schema.financeTransactions.type,
        total: sum(schema.financeTransactions.amount).mapWith(Number).as("total")
      })
      .from(schema.financeTransactions)
      .where(eq(schema.financeTransactions.seasonId, Number(latestSeasonId)))
      .groupBy(schema.financeTransactions.type)
      .all();

    const totals = {
      income: summary.find((s) => s.type === "income")?.total ?? 0,
      expense: summary.find((s) => s.type === "expense")?.total ?? 0,
    };

    return success({
      totalIncome: totals.income,
      totalExpenses: totals.expense,
      balance: totals.income - totals.expense,
      seasonId: Number(latestSeasonId),
    } satisfies GetSummarySuccess);
}));

// GET /finance/sponsorship - List sponsorship pipeline items
financeRouter.openapi(financeRoutes.listPipelineRoute, autoResponseHandler<typeof financeRoutes.listPipelineRoute>(async (c, { query }) => {
    const { seasonId } = query;
    const db = getDb(c);
    let queryBuilder = db.select().from(schema.sponsorshipPipeline).$dynamic();
    if (seasonId) {
      queryBuilder = queryBuilder.where(eq(schema.sponsorshipPipeline.seasonId, Number(seasonId)));
    }
    const pipeline = await queryBuilder.orderBy(desc(schema.sponsorshipPipeline.createdAt)).all();
    const pipelineIds = pipeline.map((p) => p.id).filter(Boolean);

    let assignments: SponsorshipAssignment[] = [];
    if (pipelineIds.length > 0) {
      assignments = await db.select().from(schema.sponsorshipAssignments).where(inArray(schema.sponsorshipAssignments.sponsorshipId, pipelineIds)).all();
    }

    const result = pipeline.map((p) => ({
      id: p.id,
      companyName: p.companyName,
      sponsorId: p.id, // Use the primary key as the sponsorship ID
      status: ((p.status ?? "potential").toLowerCase()) as "potential" | "contacted" | "pledged" | "secured" | "lost",
      estimatedValue: Number(p.estimatedValue ?? 0),
      notes: p.notes,
      contactPerson: p.contactPerson,
      seasonId: p.seasonId ? Number(p.seasonId) : null,
      zulipMessageId: p.zulipMessageId,
      assignees: assignments.filter((a) => a.sponsorshipId === p.id).map((a) => a.userId)
    }));

    return success({ pipeline: result } satisfies ListPipelineSuccess);
}));

// POST /finance/sponsorship - Create or update a sponsorship pipeline item
financeRouter.openapi(financeRoutes.savePipelineRoute, autoResponseHandler<typeof financeRoutes.savePipelineRoute>(async (c, { body }) => {
    const db = getDb(c);
    const user = await getSessionUser(c);

    // CR-05 FIX: Require proper authorization for pipeline modifications
    if (!user) {
      return error({ error: "Unauthorized" }, 401);
    }
    if (user.role !== "admin" && user.memberType !== "mentor" && user.memberType !== "coach") {
      return error({ error: "Forbidden" }, 403);
    }

    const id = body.id || crypto.randomUUID();
    const isNew = !body.id;

    let currentStatus: string | null = null;
    if (!isNew) {
      const existing = await db
        .select({ status: schema.sponsorshipPipeline.status })
        .from(schema.sponsorshipPipeline)
        .where(eq(schema.sponsorshipPipeline.id, id))
        .get();
      currentStatus = existing?.status?.toLowerCase() ?? null;
    }

    const data = {
      id,
      companyName: body.companyName,
      contactPerson: body.contactPerson ?? null,
      status: body.status,
      estimatedValue: body.estimatedValue ?? 0,
      seasonId: body.seasonId ? Number(body.seasonId) : null,
      notes: body.notes ?? null,
      zulipMessageId: body.zulipMessageId ?? null,
    };

    if (isNew) {
      await db.insert(schema.sponsorshipPipeline).values(data).run();
    } else {
      await db.update(schema.sponsorshipPipeline).set(data).where(eq(schema.sponsorshipPipeline.id, id)).run();
    }

    if (body.assignees) {
      await db.delete(schema.sponsorshipAssignments).where(eq(schema.sponsorshipAssignments.sponsorshipId, id)).run();
      if (body.assignees.length > 0) {
        const insertData = body.assignees.map((userId) => ({
          sponsorshipId: id,
          userId: userId
        }));
        await db.insert(schema.sponsorshipAssignments).values(insertData).run();
      }
    }

    if (body.status === "secured" && currentStatus !== "secured") {
      let existingTxQuery = db
        .select({ id: schema.financeTransactions.id })
        .from(schema.financeTransactions)
        .where(and(
          eq(schema.financeTransactions.description, `Sponsorship from ${body.companyName}`),
          eq(schema.financeTransactions.amount, body.estimatedValue ?? 0)
        ))
        .$dynamic();

      if (body.seasonId) {
        existingTxQuery = existingTxQuery.where(eq(schema.financeTransactions.seasonId, Number(body.seasonId)));
      }

      const existingTx = await existingTxQuery.get();

      if (!existingTx) {
        await db
          .insert(schema.sponsors)
          .values({
            id: crypto.randomUUID(),
            name: body.companyName,
            tier: "Bronze",
            isActive: 1,
          })
          .run();

        await db
          .insert(schema.financeTransactions)
          .values({
            id: crypto.randomUUID(),
            amount: body.estimatedValue ?? 0,
            type: "income",
            category: "Sponsorship",
            date: new Date().toISOString().split("T")[0],
            description: `Sponsorship from ${body.companyName}`,
            seasonId: body.seasonId ? Number(body.seasonId) : null,
            loggedBy: user?.id ?? "system",
          })
          .run();
      }
    }

    await logAuditAction(c, isNew ? "create" : "update", "sponsorship_pipeline", id);
    return success({ success: true, id } satisfies SavePipelineSuccess);
}));

// DELETE /finance/sponsorship/{id} - Delete a sponsorship pipeline item
financeRouter.openapi(financeRoutes.deletePipelineRoute, autoResponseHandler<typeof financeRoutes.deletePipelineRoute>(async (c, { params }) => {
    const { id } = params;
    const db = getDb(c);
    await db.delete(schema.sponsorshipPipeline).where(eq(schema.sponsorshipPipeline.id, id)).run();
    await logAuditAction(c, "delete", "sponsorship_pipeline", id);
    return success({ success: true } satisfies DeletePipelineSuccess);
}));

// GET /finance/transactions - List financial transactions
financeRouter.openapi(financeRoutes.listTransactionsRoute, autoResponseHandler<typeof financeRoutes.listTransactionsRoute>(async (c, { query }) => {
    const { seasonId, type } = query;
    const db = getDb(c);
    let queryBuilder = db.select().from(schema.financeTransactions).$dynamic();
    if (seasonId) {
      queryBuilder = queryBuilder.where(eq(schema.financeTransactions.seasonId, seasonId));
    }
    if (type) {
      queryBuilder = queryBuilder.where(eq(schema.financeTransactions.type, type));
    }
    const transactions = await queryBuilder.orderBy(desc(schema.financeTransactions.date)).all();

    const result = transactions.map((t) => ({
      id: t.id,
      type: t.type as "income" | "expense",
      amount: Number(t.amount),
      category: t.category,
      date: t.date,
      description: t.description,
      receiptUrl: t.receiptUrl,
      seasonId: t.seasonId ? Number(t.seasonId) : null,
      loggedBy: t.loggedBy,
    }));

    return success({ transactions: result } satisfies ListTransactionsSuccess);
}));

// POST /finance/transactions - Create or update a financial transaction
financeRouter.openapi(financeRoutes.saveTransactionRoute, autoResponseHandler<typeof financeRoutes.saveTransactionRoute>(async (c, { body }) => {
    const db = getDb(c);
    const user = await getSessionUser(c);

    // CR-05 FIX: Require proper authorization for transaction modifications
    if (!user) {
      return error({ error: "Unauthorized" }, 401);
    }
    if (user.role !== "admin" && user.memberType !== "mentor" && user.memberType !== "coach") {
      return error({ error: "Forbidden" }, 403);
    }

    const id = body.id ?? crypto.randomUUID();
    const isNew = !body.id;

    // WR-15: Validate transaction amount and type
    const amount = Number(body.amount);
    if (Number.isNaN(amount) || amount < 0 || amount > 1000000) {
      return error({ error: "Invalid amount: must be between 0 and 1,000,000" }, 400);
    }

    const validTypes: readonly ["income", "expense"] = ["income", "expense"] as const;
    if (!body.type || !validTypes.includes(body.type)) {
      return error({ error: "Invalid transaction type: must be 'income' or 'expense'" }, 400);
    }

    const data = {
      id,
      amount: body.amount,
      type: body.type,
      category: body.category,
      date: body.date,
      description: body.description ?? null,
      receiptUrl: body.receiptUrl ?? null,
      seasonId: body.seasonId ? Number(body.seasonId) : null,
      loggedBy: user?.id ?? "system",
    };

    if (isNew) {
      await db.insert(schema.financeTransactions).values(data).run();
    } else {
      await db.update(schema.financeTransactions).set(data).where(eq(schema.financeTransactions.id, id)).run();
    }

    await logAuditAction(c, isNew ? "create" : "update", "finance_transactions", id);
    return success({ success: true, id } satisfies SaveTransactionSuccess);
}));

// DELETE /finance/transactions/{id} - Delete a financial transaction
financeRouter.openapi(financeRoutes.deleteTransactionRoute, autoResponseHandler<typeof financeRoutes.deleteTransactionRoute>(async (c, { params }) => {
    const { id } = params;
    const db = getDb(c);
    const tx = await db
      .select({ receiptUrl: schema.financeTransactions.receiptUrl })
      .from(schema.financeTransactions)
      .where(eq(schema.financeTransactions.id, id))
      .get();

    if (!tx) {
      return error({ error: "Transaction not found" }, 404);
    }

    await db.delete(schema.financeTransactions).where(eq(schema.financeTransactions.id, id)).run();

    if (tx.receiptUrl && tx.receiptUrl.includes("receipts/")) {
      const key = tx.receiptUrl.split("receipts/")[1];
      try {
        if (c.executionCtx?.waitUntil && c.env?.ARES_STORAGE) {
          c.executionCtx.waitUntil(c.env.ARES_STORAGE.delete(`receipts/${key}`));
        }
      } catch (err) {
        console.warn("[Finance] No execution context available for bucket deletion", err);
      }
    }

    await logAuditAction(c, "delete", "finance_transactions", id);
    return success({ success: true } satisfies DeleteTransactionSuccess);
}));

export default financeRouter;
