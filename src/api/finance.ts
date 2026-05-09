/**
 * Finance API - Financial Management, Sponsorship Pipeline, Transactions
 *
 * Types imported from backend route definitions in @shared/routes/finance.ts
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { z } from "zod";
import { client, unwrapResponse, withMutationCallbacks } from "./honoClient";
import {
  FinanceSummarySchema,
  SponsorshipPipelineSchema,
  FinanceTransactionSchema,
  SponsorshipStatusSchema,
  TransactionTypeSchema,
  SavePipelineSchema,
  SaveTransactionSchema,
} from "@shared/routes/finance";

// Infer TypeScript types from Zod schemas
export type FinanceSummary = z.infer<typeof FinanceSummarySchema>;
export type SponsorshipPipeline = z.infer<typeof SponsorshipPipelineSchema>;
export type FinanceTransaction = z.infer<typeof FinanceTransactionSchema>;
export type SponsorshipStatus = z.infer<typeof SponsorshipStatusSchema>;
export type TransactionType = z.infer<typeof TransactionTypeSchema>;
export type SaveSponsorshipPipeline = z.input<typeof SavePipelineSchema>;
export type SaveFinanceTransaction = z.input<typeof SaveTransactionSchema>;

export interface SponsorshipPipelineResponse {
  pipeline: SponsorshipPipeline[];
}

export interface TransactionsResponse {
  transactions: FinanceTransaction[];
}


// ============================================
// Finance
// ============================================

/**
 * GET /api/finance/summary - Get financial summary for a season
 */
export function useGetFinanceSummary(
  season_id?: number | null,
  options?: Omit<UseQueryOptions<FinanceSummary>, "queryKey" | "queryFn">
) {
  return useQuery<FinanceSummary>({
    queryKey: ["finance", "summary", season_id],
    queryFn: async () => {
      const response = await client.finance.summary.$get({
        query: { season_id: season_id ?? undefined }
      });
      return unwrapResponse<FinanceSummary>(response);
    },
    ...options,
  });
}

/**
 * GET /api/finance/sponsorship - List sponsorship pipeline items
 */
export function useListSponsorshipPipeline(
  season_id?: number | null,
  options?: Omit<UseQueryOptions<SponsorshipPipelineResponse>, "queryKey" | "queryFn">
) {
  return useQuery<SponsorshipPipelineResponse>({
    queryKey: ["finance", "sponsorship", season_id],
    queryFn: async () => {
      const response = await client.finance.sponsorship.$get({
        query: { season_id: season_id ?? undefined }
      });
      return unwrapResponse<SponsorshipPipelineResponse>(response);
    },
    ...options,
  });
}

/**
 * POST /api/finance/sponsorship - Create or update a sponsorship pipeline item
 */
export function useSaveSponsorshipPipeline(
  options?: Omit<UseMutationOptions<{ success: boolean; id: string }, Error, SaveSponsorshipPipeline>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; id: string }, Error, SaveSponsorshipPipeline>({
    mutationFn: async (payload) => {
      const response = await client.finance.sponsorship.$post({ json: payload });
      return unwrapResponse<{ success: boolean; id: string }>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["finance", "sponsorship"] });
        qc.invalidateQueries({ queryKey: ["finance", "summary"] });
      }
    })
  });
}

/**
 * DELETE /api/finance/sponsorship/:id - Delete a sponsorship pipeline item
 */
export function useDeleteSponsorshipPipeline(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, string>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (id) => {
      const response = await client.finance.sponsorship[":id"].$delete({ param: { id } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["finance", "sponsorship"] });
        qc.invalidateQueries({ queryKey: ["finance", "summary"] });
      }
    })
  });
}

/**
 * GET /api/finance/transactions - List financial transactions
 */
export function useListFinanceTransactions(
  season_id?: number | null,
  type?: "income" | "expense",
  options?: Omit<UseQueryOptions<TransactionsResponse>, "queryKey" | "queryFn">
) {
  return useQuery<TransactionsResponse>({
    queryKey: ["finance", "transactions", season_id, type],
    queryFn: async () => {
      const response = await client.finance.transactions.$get({
        query: {
          season_id: season_id ?? undefined,
          type: type ?? undefined
        }
      });
      return unwrapResponse<TransactionsResponse>(response);
    },
    ...options,
  });
}

/**
 * POST /api/finance/transactions - Create or update a financial transaction
 */
export function useSaveFinanceTransaction(
  options?: Omit<UseMutationOptions<{ success: boolean; id: string }, Error, SaveFinanceTransaction>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; id: string }, Error, SaveFinanceTransaction>({
    mutationFn: async (payload) => {
      const response = await client.finance.transactions.$post({ json: payload });
      return unwrapResponse<{ success: boolean; id: string }>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["finance", "transactions"] });
        qc.invalidateQueries({ queryKey: ["finance", "summary"] });
      }
    })
  });
}

/**
 * DELETE /api/finance/transactions/:id - Delete a financial transaction
 */
export function useDeleteFinanceTransaction(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, string>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (id) => {
      const response = await client.finance.transactions[":id"].$delete({ param: { id } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["finance", "transactions"] });
        qc.invalidateQueries({ queryKey: ["finance", "summary"] });
      }
    })
  });
}
