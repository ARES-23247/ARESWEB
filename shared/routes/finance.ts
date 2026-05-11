import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import {
  selectFinanceTransactionSchema,
  selectSponsorshipPipelineSchema,
} from "@shared/db/schema-zod";
import { responseWrappers } from "@shared/db/schema-openapi";
import { openApiStandardErrors } from "./common";

// ============================================================================
// DERIVED RESPONSE SCHEMAS (from Drizzle)
// ============================================================================

/**
 * Finance summary response schema
 * This is a computed value, not directly from Drizzle
 */
export const FinanceSummarySchema = z.object({
  totalIncome: z.number(),
  totalExpenses: z.number(),
  balance: z.number(),
  seasonId: z.number().nullable().optional(),
});

/**
 * Sponsorship status enum
 */
export const SponsorshipStatusSchema = z.enum(["potential", "contacted", "pledged", "secured", "lost"]);

/**
 * Transaction type enum
 */
export const TransactionTypeSchema = z.enum(["income", "expense"]);

/**
 * Sponsorship pipeline response schema - derived from Drizzle
 */
export const SponsorshipPipelineSchema = selectSponsorshipPipelineSchema.extend({
  status: SponsorshipStatusSchema,
  createdAt: z.string().nullable().optional(),
  assignees: z.array(z.string()).optional().default([]),
});

/**
 * Finance transaction response schema - derived from Drizzle
 */
export const FinanceTransactionSchema = selectFinanceTransactionSchema;

/**
 * Save pipeline request schema (create/update)
 * Derived from Drizzle schema with id optional for updates
 */
export const SavePipelineSchema = z.object({
  id: z.string().optional(),
  companyName: z.string().min(1),
  sponsorId: z.string().nullable().optional(),
  status: SponsorshipStatusSchema,
  estimatedValue: z.number(),
  notes: z.string().nullable().optional(),
  contactPerson: z.string().nullable().optional(),
  seasonId: z.number().nullable().optional(),
  zulipMessageId: z.string().nullable().optional(),
  assignees: z.array(z.string()).optional().default([]),
});

/**
 * Save transaction request schema (create/update)
 * Derived from Drizzle schema with id optional for updates
 */
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

// ============================================================================
// ROUTES
// ============================================================================

export const getSummaryRoute = createRoute({
  method: "get",
  path: "/summary",
  request: {
    query: z.object({
      seasonId: z.coerce.number().optional(),
    }),
  },
  responses: {
    ...openApiStandardErrors,
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
    ...openApiStandardErrors,
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
    ...openApiStandardErrors,
    200: {
      content: {
        "application/json": {
          schema: responseWrappers.created(),
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
    ...openApiStandardErrors,
    200: {
      content: {
        "application/json": {
          schema: responseWrappers.success(),
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
    ...openApiStandardErrors,
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
    ...openApiStandardErrors,
    200: {
      content: {
        "application/json": {
          schema: responseWrappers.created(),
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
    ...openApiStandardErrors,
    200: {
      content: {
        "application/json": {
          schema: responseWrappers.success(),
        },
      },
      description: "Delete a financial transaction",
    },
  },
});
