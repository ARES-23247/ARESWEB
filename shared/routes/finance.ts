import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "../routes/common";

// Convert standardErrors to OpenAPI responses format
const openApiErrorResponses = {
  400: { content: { "application/json": { schema: standardErrors[400] } }, description: "Bad Request" },
  401: { content: { "application/json": { schema: standardErrors[401] } }, description: "Unauthorized" },
  403: { content: { "application/json": { schema: standardErrors[403] } }, description: "Forbidden" },
  404: { content: { "application/json": { schema: standardErrors[404] } }, description: "Not Found" },
  500: { content: { "application/json": { schema: standardErrors[500] } }, description: "Internal Server Error" },
};

// Schemas
export const FinanceSummarySchema = z.object({
  totalIncome: z.number(),
  totalExpenses: z.number(),
  balance: z.number(),
  seasonId: z.number().nullable(),
});

export const SponsorshipStatusSchema = z.enum(["potential", "contacted", "pledged", "secured", "lost"]);

export const SponsorshipPipelineSchema = z.object({
  id: z.string(),
  companyName: z.string(),
  sponsorId: z.string().nullable().optional(),
  status: SponsorshipStatusSchema,
  estimatedValue: z.number(),
  notes: z.string().nullable().optional(),
  contactPerson: z.string().nullable().optional(),
  seasonId: z.number().nullable().optional(),
  zulipMessageId: z.string().nullable().optional(),
  assignees: z.array(z.string()).default([]),
});

export const TransactionTypeSchema = z.enum(["income", "expense"]);

export const FinanceTransactionSchema = z.object({
  id: z.string(),
  type: TransactionTypeSchema,
  amount: z.number(),
  category: z.string(),
  date: z.string(),
  description: z.string().nullable().optional(),
  receiptUrl: z.string().nullable().optional(),
  seasonId: z.number().nullable().optional(),
  loggedBy: z.string().nullable().optional(),
});

export const SavePipelineSchema = z.object({
  id: z.string().optional(),
  companyName: z.string().min(1),
  sponsorId: z.string().nullable().optional(),
  status: SponsorshipStatusSchema.default("potential"),
  estimatedValue: z.number(),
  notes: z.string().nullable().optional(),
  contactPerson: z.string().nullable().optional(),
  seasonId: z.number().nullable().optional(),
  zulipMessageId: z.string().nullable().optional(),
  assignees: z.array(z.string()).default([]),
});

export const SaveTransactionSchema = z.object({
  id: z.string().optional(),
  type: TransactionTypeSchema,
  amount: z.number(),
  category: z.string().min(1),
  date: z.string().min(1),
  description: z.string().nullable().optional(),
  receiptUrl: z.string().nullable().optional(),
  seasonId: z.number().nullable().optional(),
});

// Routes
export const getSummaryRoute = createRoute({
  method: "get",
  path: "/summary",
  request: {
    query: z.object({
      seasonId: z.coerce.number().optional(),
    }),
  },
  responses: {
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: FinanceSummarySchema,
        },
      },
      description: "Get financial summary for a season",
    },
  },
});

export const listPipelineRoute = createRoute({
  method: "get",
  path: "/sponsorship",
  request: {
    query: z.object({
      seasonId: z.coerce.number().optional(),
    }),
  },
  responses: {
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            pipeline: z.array(SponsorshipPipelineSchema),
          }),
        },
      },
      description: "List sponsorship pipeline items",
    },
  },
});

export const savePipelineRoute = createRoute({
  method: "post",
  path: "/sponsorship",
  request: {
    body: {
      content: {
        "application/json": {
          schema: SavePipelineSchema,
        },
      },
    },
  },
  responses: {
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean(), id: z.string() }),
        },
      },
      description: "Create or update a sponsorship pipeline item",
    },
  },
});

export const deletePipelineRoute = createRoute({
  method: "delete",
  path: "/sponsorship/{id}",
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Delete a sponsorship pipeline item",
    },
  },
});

export const listTransactionsRoute = createRoute({
  method: "get",
  path: "/transactions",
  request: {
    query: z.object({
      seasonId: z.coerce.number().optional(),
      type: z.enum(["income", "expense"]).optional(),
    }),
  },
  responses: {
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            transactions: z.array(FinanceTransactionSchema),
          }),
        },
      },
      description: "List financial transactions",
    },
  },
});

export const saveTransactionRoute = createRoute({
  method: "post",
  path: "/transactions",
  request: {
    body: {
      content: {
        "application/json": {
          schema: SaveTransactionSchema,
        },
      },
    },
  },
  responses: {
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean(), id: z.string() }),
        },
      },
      description: "Create or update a financial transaction",
    },
  },
});

export const deleteTransactionRoute = createRoute({
  method: "delete",
  path: "/transactions/{id}",
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Delete a financial transaction",
    },
  },
});
