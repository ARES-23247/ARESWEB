import { typedHandler } from "../utils/handler";
import { ApiError } from "../middleware/errorHandler";

import { eq, desc, inArray, sum, and } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { OpenAPIHono } from "@hono/zod-openapi";

import { AppEnv, ensureAdmin, rateLimitMiddleware, logAuditAction, getSessionUser, getDb } from "../middleware";
import { errorResponses } from "../../../shared/errors/api";
import * as financeRoutes from "../../../shared/routes/finance";
import type { z } from "zod";

// ─── Type Inference Helpers ─────────────────────────────────────────────────────
// Infer types from route schemas for proper type safety

type GetSummaryQuery = z.infer<typeof financeRoutes.getSummaryRoute.request.query>;
type GetSummaryResponse = z.infer<typeof financeRoutes.FinanceSummarySchema>;

type ListPipelineQuery = z.infer<typeof financeRoutes.listPipelineRoute.request.query>;
type ListPipelineResponse = z.infer<typeof financeRoutes.listPipelineRoute.responses[200]["content"]["application/json"]["schema"]>;

type SavePipelineBody = z.infer<typeof financeRoutes.SavePipelineSchema>;
type SavePipelineResponse = z.infer<typeof financeRoutes.savePipelineRoute.responses[200]["content"]["application/json"]["schema"]>;

type DeletePipelineParams = z.infer<typeof financeRoutes.deletePipelineRoute.request.params>;
type DeletePipelineResponse = z.infer<typeof financeRoutes.deletePipelineRoute.responses[200]["content"]["application/json"]["schema"]>;

type ListTransactionsQuery = z.infer<typeof financeRoutes.listTransactionsRoute.request.query>;
type ListTransactionsResponse = z.infer<typeof financeRoutes.listTransactionsRoute.responses[200]["content"]["application/json"]["schema"]>;

type SaveTransactionBody = z.infer<typeof financeRoutes.SaveTransactionSchema>;
type SaveTransactionResponse = z.infer<typeof financeRoutes.saveTransactionRoute.responses[200]["content"]["application/json"]["schema"]>;

type DeleteTransactionParams = z.infer<typeof financeRoutes.deleteTransactionRoute.request.params>;
type DeleteTransactionResponse = z.infer<typeof financeRoutes.deleteTransactionRoute.responses[200]["content"]["application/json"]["schema"]>;

// Database query result types
interface FinanceSummaryItem {
  type: "income" | "expense";
  total: number;
}

interface SponsorshipAssignment {
  sponsorshipId: string;
  userId: string;
}

export const financeRouter = new OpenAPIHono<AppEnv>();

// CR-06 FIX: Apply authentication and rate limiting to all finance routes
financeRouter.use("*", ensureAdmin);
financeRouter.use("*", rateLimitMiddleware(30, 60));

// GET /finance/summary - Get financial summary for a season
financeRouter.openapi(financeRoutes.getSummaryRoute, typedHandler<typeof financeRoutes.getSummaryRoute>(async (c) => {
    const { season_id } = c.req.valid("query");
    const db = getDb(c);

    let latestSeasonId: number | undefined | null = season_id;
    if (!latestSeasonId) {
      const latest = await db.select().from(schema.seasons).orderBy(desc(schema.seasons.startYear)).get();
      latestSeasonId = latest?.startYear;
    }

    if (!latestSeasonId) {
      const response: GetSummaryResponse = {
        total_income: 0,
        total_expenses: 0,
        balance: 0,
        season_id: null
      };
      return c.json(response satisfies GetSummaryResponse, 200);
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

    const response: GetSummaryResponse = {
      total_income: totals.income,
      total_expenses: totals.expense,
      balance: totals.income - totals.expense,
      season_id: Number(latestSeasonId),
    };
    return c.json(response satisfies GetSummaryResponse, 200);
}));

// GET /finance/sponsorship - List sponsorship pipeline items
financeRouter.openapi(financeRoutes.listPipelineRoute, typedHandler<typeof financeRoutes.listPipelineRoute>(async (c) => {
    const { season_id } = c.req.valid("query");
    const db = getDb(c);
    let queryBuilder = db.select().from(schema.sponsorshipPipeline).$dynamic();
    if (season_id) {
      queryBuilder = queryBuilder.where(eq(schema.sponsorshipPipeline.seasonId, Number(season_id)));
    }
    const pipeline = await queryBuilder.orderBy(desc(schema.sponsorshipPipeline.createdAt)).all();
    const pipelineIds = pipeline.map((p) => p.id).filter(Boolean);

    let assignments: SponsorshipAssignment[] = [];
    if (pipelineIds.length > 0) {
      assignments = await db.select().from(schema.sponsorshipAssignments).where(inArray(schema.sponsorshipAssignments.sponsorshipId, pipelineIds)).all();
    }

    const result = pipeline.map((p) => ({
      id: p.id,
      company_name: p.companyName,
      sponsor_id: (p as any).sponsorId ?? null,
      status: ((p.status ?? "potential").toLowerCase()) as "potential" | "contacted" | "pledged" | "secured" | "lost",
      estimated_value: Number(p.estimatedValue ?? 0),
      notes: p.notes,
      contact_person: p.contactPerson,
      season_id: p.seasonId ? Number(p.seasonId) : null,
      zulip_message_id: p.zulipMessageId,
      assignees: assignments.filter((a) => a.sponsorshipId === p.id).map((a) => a.userId)
    }));

    const response = { pipeline: result } as ListPipelineResponse;
    return c.json(response satisfies ListPipelineResponse, 200);
}));

// POST /finance/sponsorship - Create or update a sponsorship pipeline item
financeRouter.openapi(financeRoutes.savePipelineRoute, typedHandler<typeof financeRoutes.savePipelineRoute>(async (c) => {
    const body = c.req.valid("json");
    const db = getDb(c);
    const user = await getSessionUser(c);

    // CR-05 FIX: Require proper authorization for pipeline modifications
    if (!user) {
      throw new ApiError("Unauthorized", 401);
    }
    if (user.role !== "admin" && user.member_type !== "mentor" && user.member_type !== "coach") {
      throw new ApiError("Forbidden", 403);
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
      companyName: body.company_name,
      contactPerson: body.contact_person ?? null,
      status: body.status,
      estimatedValue: body.estimated_value ?? 0,
      seasonId: body.season_id ? Number(body.season_id) : null,
      notes: body.notes ?? null,
      zulipMessageId: body.zulip_message_id ?? null,
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
          eq(schema.financeTransactions.description, `Sponsorship from ${body.company_name}`),
          eq(schema.financeTransactions.amount, body.estimated_value ?? 0)
        ))
        .$dynamic();

      if (body.season_id) {
        existingTxQuery = existingTxQuery.where(eq(schema.financeTransactions.seasonId, Number(body.season_id)));
      }

      const existingTx = await existingTxQuery.get();

      if (!existingTx) {
        await db
          .insert(schema.sponsors)
          .values({
            id: crypto.randomUUID(),
            name: body.company_name,
            tier: "Bronze",
            isActive: 1,
          })
          .run();

        await db
          .insert(schema.financeTransactions)
          .values({
            id: crypto.randomUUID(),
            amount: body.estimated_value ?? 0,
            type: "income",
            category: "Sponsorship",
            date: new Date().toISOString().split("T")[0],
            description: `Sponsorship from ${body.company_name}`,
            seasonId: body.season_id ? Number(body.season_id) : null,
            loggedBy: user?.id ?? "system",
          })
          .run();
      }
    }

    await logAuditAction(c, isNew ? "create" : "update", "sponsorship_pipeline", id);
    const response: SavePipelineResponse = { success: true, id };
    return c.json(response satisfies SavePipelineResponse, 200);
}));

// DELETE /finance/sponsorship/{id} - Delete a sponsorship pipeline item
financeRouter.openapi(financeRoutes.deletePipelineRoute, typedHandler<typeof financeRoutes.deletePipelineRoute>(async (c) => {
    const { id } = c.req.valid("param");
    const db = getDb(c);
    await db.delete(schema.sponsorshipPipeline).where(eq(schema.sponsorshipPipeline.id, id)).run();
    await logAuditAction(c, "delete", "sponsorship_pipeline", id);
    const response: DeletePipelineResponse = { success: true };
    return c.json(response satisfies DeletePipelineResponse, 200);
}));

// GET /finance/transactions - List financial transactions
financeRouter.openapi(financeRoutes.listTransactionsRoute, typedHandler<typeof financeRoutes.listTransactionsRoute>(async (c) => {
    const { season_id, type } = c.req.valid("query");
    const db = getDb(c);
    let queryBuilder = db.select().from(schema.financeTransactions).$dynamic();
    if (season_id) {
      queryBuilder = queryBuilder.where(eq(schema.financeTransactions.seasonId, season_id));
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
      receipt_url: t.receiptUrl,
      season_id: t.seasonId ? Number(t.seasonId) : null,
      logged_by: t.loggedBy,
    }));

    const response = { transactions: result } as ListTransactionsResponse;
    return c.json(response satisfies ListTransactionsResponse, 200);
}));

// POST /finance/transactions - Create or update a financial transaction
financeRouter.openapi(financeRoutes.saveTransactionRoute, typedHandler<typeof financeRoutes.saveTransactionRoute>(async (c) => {
    const body = c.req.valid("json");
    const db = getDb(c);
    const user = await getSessionUser(c);

    // CR-05 FIX: Require proper authorization for transaction modifications
    if (!user) {
      throw new ApiError("Unauthorized", 401);
    }
    if (user.role !== "admin" && user.member_type !== "mentor" && user.member_type !== "coach") {
      throw new ApiError("Forbidden", 403);
    }

    const id = body.id ?? crypto.randomUUID();
    const isNew = !body.id;

    // WR-15: Validate transaction amount and type
    const amount = Number(body.amount);
    if (Number.isNaN(amount) || amount < 0 || amount > 1000000) {
      throw new ApiError("Invalid amount: must be between 0 and 1,000,000", 400, "VALIDATION_ERROR");
    }

    const validTypes: readonly ["income", "expense"] = ["income", "expense"] as const;
    if (!body.type || !validTypes.includes(body.type)) {
      throw new ApiError("Invalid transaction type: must be 'income' or 'expense'", 400, "VALIDATION_ERROR");
    }

    const data = {
      id,
      amount: body.amount,
      type: body.type,
      category: body.category,
      date: body.date,
      description: body.description ?? null,
      receiptUrl: body.receipt_url ?? null,
      seasonId: body.season_id ? Number(body.season_id) : null,
      loggedBy: user?.id ?? "system",
    };

    if (isNew) {
      await db.insert(schema.financeTransactions).values(data).run();
    } else {
      await db.update(schema.financeTransactions).set(data).where(eq(schema.financeTransactions.id, id)).run();
    }

    await logAuditAction(c, isNew ? "create" : "update", "finance_transactions", id);
    const response: SaveTransactionResponse = { success: true, id };
    return c.json(response satisfies SaveTransactionResponse, 200);
}));

// DELETE /finance/transactions/{id} - Delete a financial transaction
financeRouter.openapi(financeRoutes.deleteTransactionRoute, typedHandler<typeof financeRoutes.deleteTransactionRoute>(async (c) => {
    const { id } = c.req.valid("param");
    const db = getDb(c);
    const tx = await db
      .select({ receiptUrl: schema.financeTransactions.receiptUrl })
      .from(schema.financeTransactions)
      .where(eq(schema.financeTransactions.id, id))
      .get();

    if (!tx) {
      throw new ApiError("Transaction", 404, "NOT_FOUND");
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
    const response: DeleteTransactionResponse = { success: true };
    return c.json(response satisfies DeleteTransactionResponse, 200);
}));

export default financeRouter;
