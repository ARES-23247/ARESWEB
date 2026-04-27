import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { financeTransactionSchema, sponsorshipPipelineSchema } from "../financeSchema";

const c = initContract();

export const financeSummarySchema = z.object({
  total_income: z.number(),
  total_expenses: z.number(),
  balance: z.number(),
  season_id: z.number().nullable(),
});

export const financeContract = c.router({
  getSummary: {
    method: "GET",
    path: "/summary",
    query: z.object({
      season_id: z.coerce.number().optional(),
    }),
    responses: {
      200: financeSummarySchema,
      500: z.object({ error: z.string() }),
    },
    summary: "Get financial summary for a season",
  },
  
  // Sponsorship Pipeline
  listPipeline: {
    method: "GET",
    path: "/sponsorship",
    query: z.object({
      season_id: z.coerce.number().optional(),
    }),
    responses: {
      200: z.object({
        pipeline: z.array(sponsorshipPipelineSchema.extend({ id: z.string() })),
      }),
      500: z.object({ error: z.string() }),
    },
    summary: "List sponsorship pipeline items",
  },
  savePipeline: {
    method: "POST",
    path: "/sponsorship",
    body: sponsorshipPipelineSchema,
    responses: {
      200: z.object({ success: z.boolean(), id: z.string() }),
      500: z.object({ error: z.string() }),
    },
    summary: "Create or update a sponsorship pipeline item",
  },
  deletePipeline: {
    method: "DELETE",
    path: "/sponsorship/:id",
    pathParams: z.object({ id: z.string() }),
    body: c.noBody(),
    responses: {
      200: z.object({ success: z.boolean() }),
      500: z.object({ error: z.string() }),
    },
    summary: "Delete a sponsorship pipeline item",
  },

  // Ledger Transactions
  listTransactions: {
    method: "GET",
    path: "/transactions",
    query: z.object({
      season_id: z.coerce.number().optional(),
      type: z.enum(["income", "expense"]).optional(),
    }),
    responses: {
      200: z.object({
        transactions: z.array(financeTransactionSchema.extend({ id: z.string() })),
      }),
      500: z.object({ error: z.string() }),
    },
    summary: "List financial transactions",
  },
  saveTransaction: {
    method: "POST",
    path: "/transactions",
    body: financeTransactionSchema,
    responses: {
      200: z.object({ success: z.boolean(), id: z.string() }),
      500: z.object({ error: z.string() }),
    },
    summary: "Create or update a financial transaction",
  },
  deleteTransaction: {
    method: "DELETE",
    path: "/transactions/:id",
    pathParams: z.object({ id: z.string() }),
    body: c.noBody(),
    responses: {
      200: z.object({ success: z.boolean() }),
      500: z.object({ error: z.string() }),
    },
    summary: "Delete a financial transaction",
  },
});
