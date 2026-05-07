import { createRoute, z } from "@hono/zod-openapi";
import { openApiStandardErrors } from "./common";
import { financeTransactionSchema, sponsorshipPipelineSchema } from "../financeSchema";

export const financeSummarySchema = z.object({
  total_income: z.number(),
  total_expenses: z.number(),
  balance: z.number(),
  season_id: z.number().nullable(),
});

// Summary
export const getSummaryRoute = createRoute({
  method: "get",
  path: "/summary",
  request: {
    query: z.object({
      season_id: z.coerce.number().optional(),
    }),
  },
  responses: {
    200: {
      description: "Get financial summary for a season",
      content: { "application/json": { schema: financeSummarySchema } },
    },
    ...openApiStandardErrors,
  },
});

// Sponsorship Pipeline
export const listPipelineRoute = createRoute({
  method: "get",
  path: "/sponsorship",
  request: {
    query: z.object({
      season_id: z.coerce.number().optional(),
    }),
  },
  responses: {
    200: {
      description: "List sponsorship pipeline items",
      content: {
        "application/json": {
          schema: z.object({
            pipeline: z.array(sponsorshipPipelineSchema.extend({ id: z.string() })),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

export const savePipelineRoute = createRoute({
  method: "post",
  path: "/sponsorship",
  request: {
    body: {
      content: { "application/json": { schema: sponsorshipPipelineSchema } },
    },
  },
  responses: {
    200: {
      description: "Create or update a sponsorship pipeline item",
      content: { "application/json": { schema: z.object({ success: z.boolean(), id: z.string() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const deletePipelineRoute = createRoute({
  method: "delete",
  path: "/sponsorship/{id}",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: "Delete a sponsorship pipeline item",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

// Ledger Transactions
export const listTransactionsRoute = createRoute({
  method: "get",
  path: "/transactions",
  request: {
    query: z.object({
      season_id: z.coerce.number().optional(),
      type: z.enum(["income", "expense"]).optional(),
    }),
  },
  responses: {
    200: {
      description: "List financial transactions",
      content: {
        "application/json": {
          schema: z.object({
            transactions: z.array(financeTransactionSchema.extend({ id: z.string() })),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

export const saveTransactionRoute = createRoute({
  method: "post",
  path: "/transactions",
  request: {
    body: {
      content: { "application/json": { schema: financeTransactionSchema } },
    },
  },
  responses: {
    200: {
      description: "Create or update a financial transaction",
      content: { "application/json": { schema: z.object({ success: z.boolean(), id: z.string() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const deleteTransactionRoute = createRoute({
  method: "delete",
  path: "/transactions/{id}",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: "Delete a financial transaction",
      content: { "application/json": { schema: z.object({ success: z.literal(true) }) } },
    },
    ...openApiStandardErrors,
  },
});
