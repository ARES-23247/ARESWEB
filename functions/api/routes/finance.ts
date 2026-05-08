import { typedHandler } from "../utils/handler";

import { eq, desc, inArray, sum, and } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { OpenAPIHono } from "@hono/zod-openapi";

import { AppEnv, ensureAdmin, rateLimitMiddleware, logAuditAction, getSessionUser, getDb } from "../middleware";
import * as financeRoutes from "../../../shared/routes/finance";

// Type definitions for finance data structures
type FinanceTransactionType = "income" | "expense";

interface FinanceSummaryResponse {
  total_income: number;
  total_expenses: number;
  balance: number;
  season_id: number | null;
}

interface FinanceSummaryItem {
  type: FinanceTransactionType;
  total: number;
}

interface SponsorshipPipelineItem {
  id: string;
  companyName: string;
  contactPerson: string | null;
  status: string;
  estimatedValue: number | null;
  seasonId: number | null;
  notes: string | null;
  zulipMessageId: string | null;
  createdAt: string;
  // Computed fields
  season_id: number | null;
  estimated_value: number;
  assignees: string[];
}

interface SponsorshipAssignment {
  sponsorshipId: string;
  userId: string;
}

interface TransactionListItem {
  id: string;
  amount: number;
  type: FinanceTransactionType;
  category: string;
  date: string;
  description: string | null;
  receiptUrl: string | null;
  seasonId: number | null;
  loggedBy: string | null;
  // Computed fields
  season_id: number | null;
}

interface ApiErrorResponse {
  error: string;
}

interface ApiSuccessResponse {
  success: true;
  id?: string;
}

interface PipelineListResponse {
  pipeline: SponsorshipPipelineItem[];
}

interface TransactionListResponse {
  transactions: TransactionListItem[];
}



export const financeRouter = new OpenAPIHono<AppEnv>();

// CR-06 FIX: Apply authentication and rate limiting to all finance routes
financeRouter.use("*", ensureAdmin);
financeRouter.use("*", rateLimitMiddleware(30, 60));

// GET /finance/summary - Get financial summary for a season
financeRouter.openapi(financeRoutes.getSummaryRoute, typedHandler<typeof financeRoutes.getSummaryRoute>(async (c) => {
  try {
    const { season_id } = c.req.valid("query");
    const db = getDb(c);

    let latestSeasonId: number | undefined | null = season_id;
    if (!latestSeasonId) {
      const latest = await db.select().from(schema.seasons).orderBy(desc(schema.seasons.startYear)).get();
      latestSeasonId = latest?.startYear;
    }

    if (!latestSeasonId) {
      const response: FinanceSummaryResponse = {
        total_income: 0,
        total_expenses: 0,
        balance: 0,
        season_id: null
      };
      return c.json(response, 200);
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
      income: summary.find((s: FinanceSummaryItem) => s.type === "income")?.total || 0,
      expense: summary.find((s: FinanceSummaryItem) => s.type === "expense")?.total || 0,
    };

    const response: FinanceSummaryResponse = {
      total_income: totals.income,
      total_expenses: totals.expense,
      balance: totals.income - totals.expense,
      season_id: Number(latestSeasonId),
    };
    return c.json(response, 200);
  } catch (e) {
    console.error("[Finance:Summary] Error", e);
    const errorResponse: ApiErrorResponse = { error: e instanceof Error ? e.message : "Failed to fetch summary" };
    return c.json(errorResponse, 500);
  }
}));

// GET /finance/sponsorship - List sponsorship pipeline items
financeRouter.openapi(financeRoutes.listPipelineRoute, typedHandler<typeof financeRoutes.listPipelineRoute>(async (c) => {
  try {
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

    const result: SponsorshipPipelineItem[] = pipeline.map((p) => ({
      ...p,
      season_id: p.seasonId ? Number(p.seasonId) : null,
      estimated_value: Number(p.estimatedValue || 0),
      status: (p.status || "potential").toLowerCase(),
      assignees: assignments.filter((a: SponsorshipAssignment) => a.sponsorshipId === p.id).map((a: SponsorshipAssignment) => a.userId)
    }));

    const response: PipelineListResponse = { pipeline: result };
    return c.json(response, 200);
  } catch (e) {
    console.error("[Finance:ListPipeline] Error", e);
    const errorResponse: ApiErrorResponse = { error: e instanceof Error ? e.message : "Failed to fetch pipeline" };
    return c.json(errorResponse, 500);
  }
}));

// POST /finance/sponsorship - Create or update a sponsorship pipeline item
financeRouter.openapi(financeRoutes.savePipelineRoute, typedHandler<typeof financeRoutes.savePipelineRoute>(async (c) => {
  try {
    const body = c.req.valid("json");
    const db = getDb(c);
    const user = await getSessionUser(c);

    // CR-05 FIX: Require proper authorization for pipeline modifications
    if (!user) {
      const errorResponse: ApiErrorResponse = { error: "Unauthorized" };
      return c.json(errorResponse, 401);
    }
    if (user.role !== "admin" && user.member_type !== "mentor" && user.member_type !== "coach") {
      const errorResponse: ApiErrorResponse = { error: "Insufficient permissions" };
      return c.json(errorResponse, 403);
    }

    const id = body.id || crypto.randomUUID();
    const isNew = !body.id;

    let currentStatus = null;
    if (!isNew) {
      const existing = await db
        .select({ status: schema.sponsorshipPipeline.status })
        .from(schema.sponsorshipPipeline)
        .where(eq(schema.sponsorshipPipeline.id, id))
        .get();
      currentStatus = existing?.status?.toLowerCase();
    }

    const data = {
      id,
      companyName: body.company_name,
      contactPerson: body.contact_person || null,
      status: body.status,
      estimatedValue: body.estimated_value ?? 0,
      seasonId: body.season_id ? Number(body.season_id) : null,
      notes: body.notes || null,
      zulipMessageId: body.zulip_message_id || null,
    };

    if (isNew) {
      await db.insert(schema.sponsorshipPipeline).values(data).run();
    } else {
      await db.update(schema.sponsorshipPipeline).set(data).where(eq(schema.sponsorshipPipeline.id, id)).run();
    }

    if (body.assignees) {
      await db.delete(schema.sponsorshipAssignments).where(eq(schema.sponsorshipAssignments.sponsorshipId, id)).run();
      if (body.assignees.length > 0) {
        const insertData = body.assignees.map((userId: string) => ({
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
          eq(schema.financeTransactions.amount, body.estimated_value || 0)
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
            amount: body.estimated_value || 0,
            type: "income",
            category: "Sponsorship",
            date: new Date().toISOString().split("T")[0],
            description: `Sponsorship from ${body.company_name}`,
            seasonId: body.season_id ? Number(body.season_id) : null,
            loggedBy: user?.id || "system",
          })
          .run();
      }
    }

    await logAuditAction(c, isNew ? "create" : "update", "sponsorship_pipeline", id);
    const successResponse: ApiSuccessResponse = { success: true, id };
    return c.json(successResponse, 200);
  } catch (e) {
    console.error("[Finance:SavePipeline] Error", e);
    const errorResponse: ApiErrorResponse = { error: e instanceof Error ? e.message : "Failed to save pipeline" };
    return c.json(errorResponse, 500);
  }
}));

// DELETE /finance/sponsorship/{id} - Delete a sponsorship pipeline item
financeRouter.openapi(financeRoutes.deletePipelineRoute, typedHandler<typeof financeRoutes.deletePipelineRoute>(async (c) => {
  try {
    const { id } = c.req.valid("param");
    const db = getDb(c);
    await db.delete(schema.sponsorshipPipeline).where(eq(schema.sponsorshipPipeline.id, id)).run();
    await logAuditAction(c, "delete", "sponsorship_pipeline", id);
    const successResponse: ApiSuccessResponse = { success: true };
    return c.json(successResponse, 200);
  } catch (e) {
    console.error("[Finance:DeletePipeline] Error", e);
    const errorResponse: ApiErrorResponse = { error: e instanceof Error ? e.message : "Failed to delete pipeline" };
    return c.json(errorResponse, 500);
  }
}));

// GET /finance/transactions - List financial transactions
financeRouter.openapi(financeRoutes.listTransactionsRoute, typedHandler<typeof financeRoutes.listTransactionsRoute>(async (c) => {
  try {
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

    const result: TransactionListItem[] = transactions.map((t) => ({
      ...t,
      season_id: t.seasonId ? Number(t.seasonId) : null,
      amount: Number(t.amount)
    }));

    const response: TransactionListResponse = { transactions: result };
    return c.json(response, 200);
  } catch (e) {
    console.error("[Finance:ListTransactions] Error", e);
    const errorResponse: ApiErrorResponse = { error: e instanceof Error ? e.message : "Failed to fetch transactions" };
    return c.json(errorResponse, 500);
  }
}));

// POST /finance/transactions - Create or update a financial transaction
financeRouter.openapi(financeRoutes.saveTransactionRoute, typedHandler<typeof financeRoutes.saveTransactionRoute>(async (c) => {
  try {
    const body = c.req.valid("json");
    const db = getDb(c);
    const user = await getSessionUser(c);

    // CR-05 FIX: Require proper authorization for transaction modifications
    if (!user) {
      const errorResponse: ApiErrorResponse = { error: "Unauthorized" };
      return c.json(errorResponse, 401);
    }
    if (user.role !== "admin" && user.member_type !== "mentor" && user.member_type !== "coach") {
      const errorResponse: ApiErrorResponse = { error: "Insufficient permissions" };
      return c.json(errorResponse, 403);
    }

    const id = body.id || crypto.randomUUID();
    const isNew = !body.id;

    // WR-15: Validate transaction amount and type
    const amount = Number(body.amount);
    if (isNaN(amount) || amount < 0 || amount > 1000000) {
      const errorResponse: ApiErrorResponse = { error: "Invalid amount: must be between 0 and 1,000,000" };
      return c.json(errorResponse, 400);
    }

    const validTypes = ['income', 'expense'];
    if (!body.type || !validTypes.includes(body.type)) {
      const errorResponse: ApiErrorResponse = { error: "Invalid transaction type: must be 'income' or 'expense'" };
      return c.json(errorResponse, 400);
    }

    const data = {
      id,
      amount: body.amount,
      type: body.type,
      category: body.category,
      date: body.date,
      description: body.description || null,
      receiptUrl: body.receipt_url || null,
      seasonId: body.season_id ? Number(body.season_id) : null,
      loggedBy: user?.id || "system",
    };

    if (isNew) {
      await db.insert(schema.financeTransactions).values(data).run();
    } else {
      await db.update(schema.financeTransactions).set(data).where(eq(schema.financeTransactions.id, id)).run();
    }

    await logAuditAction(c, isNew ? "create" : "update", "finance_transactions", id);
    const successResponse: ApiSuccessResponse = { success: true, id };
    return c.json(successResponse, 200);
  } catch (e) {
    console.error("[Finance:SaveTransaction] Error", e);
    const errorResponse: ApiErrorResponse = { error: e instanceof Error ? e.message : "Failed to save transaction" };
    return c.json(errorResponse, 500);
  }
}));

// DELETE /finance/transactions/{id} - Delete a financial transaction
financeRouter.openapi(financeRoutes.deleteTransactionRoute, typedHandler<typeof financeRoutes.deleteTransactionRoute>(async (c) => {
  try {
    const { id } = c.req.valid("param");
    const db = getDb(c);
    const tx = await db
      .select({ receiptUrl: schema.financeTransactions.receiptUrl })
      .from(schema.financeTransactions)
      .where(eq(schema.financeTransactions.id, id))
      .get();

    if (!tx) {
      const errorResponse: ApiErrorResponse = { error: "Transaction not found" };
      return c.json(errorResponse, 404);
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
    const successResponse: ApiSuccessResponse = { success: true };
    return c.json(successResponse, 200);
  } catch (e) {
    console.error("[Finance:DeleteTransaction] Error", e);
    const errorResponse: ApiErrorResponse = { error: e instanceof Error ? e.message : "Failed to delete transaction" };
    return c.json(errorResponse, 500);
  }
}));

export default financeRouter;
