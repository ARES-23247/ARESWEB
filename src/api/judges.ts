import { useQuery, useMutation, type UseQueryOptions, type UseMutationOptions, useQueryClient } from "@tanstack/react-query";
import { client, unwrapResponse, withMutationCallbacks } from "./honoClient";

export interface JudgeLoginResponse {
  success: boolean;
  label?: string;
}

export interface PortfolioDoc {
  slug: string;
  title: string;
  category: string;
  description: string;
  content: string;
  isExecutiveSummary?: number;
}

export interface OutreachItem {
  id: string;
  title: string;
  date: string;
  description: string;
  location: string;
  students_count: number;
  hours_logged: number;
  reach_count: number;
}

export interface AwardItem {
  id: number;
  title: string;
  date: string;
  eventName: string;
  image_url: string;
  description: string;
  year: number;
}

export interface SponsorItem {
  id: string;
  name: string;
  tier: string;
  logo_url: string | null;
  website_url: string | null;
}

export interface JudgePortfolioResponse {
  portfolioDocs: PortfolioDoc[];
  outreach: OutreachItem[];
  awards: AwardItem[];
  sponsors: SponsorItem[];
}

export interface JudgeCode {
  id: string;
  code: string;
  label: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export interface ListJudgeCodesResponse {
  codes: JudgeCode[];
}

/**
 * POST /api/judges/login - Verify judge access code
 */
export function useJudgeLogin(
  options?: UseMutationOptions<JudgeLoginResponse, Error, { code: string; turnstileToken?: string }>
) {
  return useMutation({
    ...options,
    mutationFn: async (data) => {
      const response = await client.judges.login.$post({ json: data });
      return unwrapResponse<JudgeLoginResponse>(response);
    },
    onSuccess: (...args) => {

        options?.onSuccess?.(...args);
    },
  });
}

/**
 * GET /api/judges/portfolio - Get judge portfolio data
 */
export function useGetJudgePortfolio(
  code: string,
  options?: Omit<UseQueryOptions<JudgePortfolioResponse>, "queryKey" | "queryFn" | "enabled">
) {
  return useQuery<JudgePortfolioResponse>({
    queryKey: ["judges", "portfolio", code],
    queryFn: async () => {
      const response = await client.judges.portfolio.$get({
        header: { "x-judge-code": code }
      });
      return unwrapResponse<JudgePortfolioResponse>(response);
    },
    enabled: !!code,
    ...options,
  });
}

// ============================================
// Admin Judges
// ============================================

/**
 * GET /api/judges/admin/codes - List all judge access codes
 */
export function useGetJudgeCodes(
  options?: Omit<UseQueryOptions<ListJudgeCodesResponse>, "queryKey" | "queryFn">
) {
  return useQuery<ListJudgeCodesResponse>({
    queryKey: ["judge_codes"],
    queryFn: async () => {
      const response = await client.judges.admin.codes.$get();
      return unwrapResponse<ListJudgeCodesResponse>(response);
    },
    ...options,
  });
}

/**
 * POST /api/judges/admin/codes - Create judge access code
 */
export function useCreateJudgeCode(
  options?: Omit<UseMutationOptions<{ success: boolean; code: string; id: string }, Error, { label?: string; expiresAt?: string }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; code: string; id: string }, Error, { label?: string; expiresAt?: string }>({
    mutationFn: async (data) => {
      const response = await client.judges.admin.codes.$post({ json: data });
      return unwrapResponse<{ success: boolean; code: string; id: string }>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["judge_codes"] });
      }
    })
  });
}

/**
 * DELETE /api/judges/admin/codes/:id - Delete judge access code
 */
export function useDeleteJudgeCode(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, string, { previous: ListJudgeCodesResponse | undefined }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, string, { previous: ListJudgeCodesResponse | undefined }>({
    mutationFn: async (id) => {
      const response = await client.judges.admin.codes[":id"].$delete({ param: { id } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onMutate: async (id) => {
        // Cancel outgoing refetches
        await queryClient.cancelQueries({ queryKey: ["judge_codes"] });

        // Snapshot the previous value
        const previous = queryClient.getQueryData(["judge_codes"]) as ListJudgeCodesResponse | undefined;

        // Optimistically update to the new value
        queryClient.setQueryData(["judge_codes"], (old: any) => ({
          ...old,
          codes: old?.codes?.filter((c: any) => c.id !== id)
        }));

        return { previous };
      },
      onError: (qc, err, id, context) => {
        // Rollback on failure
        if (context?.previous) {
          qc.setQueryData(["judge_codes"], context.previous);
        }
      },
      onSettled: (qc) => {
        qc.invalidateQueries({ queryKey: ["judge_codes"] });
      }
    })
  });
}

