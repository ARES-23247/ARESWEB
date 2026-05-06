/**
 * Judges API - Login, Portfolio Access
 *
 * Types imported from backend route definitions in @shared/routes/judges.ts
 */

import { useQuery, useMutation, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { client, unwrapResponse } from "./honoClient";

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
  is_executive_summary?: number;
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
  event_name: string;
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
      // @ts-ignore - Pass through to options.onSuccess
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
        headers: { "x-judge-code": code }
      });
      return unwrapResponse<JudgePortfolioResponse>(response);
    },
    enabled: !!code,
    ...options,
  });
}
