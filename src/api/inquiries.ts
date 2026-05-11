/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Inquiries API - Contact Form, Student/Mentor Inquiries
 *
 * Types imported from backend route definitions in @shared/routes/inquiries.ts
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { z } from "zod";
import { client, unwrapResponse } from "./honoClient";
import { inquirySchema, inquiryInputSchema } from "@shared/routes/inquiries";

// Infer TypeScript types from Zod schemas
export type Inquiry = z.infer<typeof inquirySchema>;
export type InquiryInput = z.input<typeof inquiryInputSchema>;

export interface InquiriesResponse {
  inquiries: Inquiry[];
}

export interface SubmitInquiryResponse {
  success: boolean;
  id: string;
  warning?: string;
}


// ============================================
// Inquiries
// ============================================

/**
 * GET /api/inquiries/admin/list - List all inquiries (Admin)
 */
export function useGetAdminInquiries(
  query?: { limit?: number; offset?: number },
  options?: Omit<UseQueryOptions<InquiriesResponse>, "queryKey" | "queryFn">
) {
  return useQuery<InquiriesResponse>({
    queryKey: ["admin_inquiries", query],
    queryFn: async () => {
      const response = await client.inquiries.admin.list.$get({ query: query || {} });
      return unwrapResponse<InquiriesResponse>(response);
    },
    ...options,
  });
}

/**
 * POST /api/inquiries/ - Submit a new inquiry
 */
export function useSubmitInquiry(
  options?: UseMutationOptions<SubmitInquiryResponse, Error, InquiryInput>
) {
  const queryClient = useQueryClient();
  return useMutation({
    ...options,
    mutationFn: async (payload) => {
      const response = await client.inquiries.$post({ json: payload });
      return unwrapResponse<SubmitInquiryResponse>(response);
    },
    onSuccess: (...args) => {
      options?.onSuccess?.(...args);
      queryClient.invalidateQueries({ queryKey: ["admin_inquiries"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "action-items"] });
    },
  });
}

/**
 * PATCH /api/inquiries/admin/:id/status - Update inquiry status
 */
export function useUpdateInquiryStatus(
  options?: Omit<UseMutationOptions<{ success: boolean; status?: string }, Error, { id: string; status: string }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; status?: string }, Error, { id: string; status: string }>({
    mutationFn: async ({ id, status }) => {
      const response = await client.inquiries.admin[":id"].status.$patch({
        param: { id },
        json: { status: status as "pending" | "rejected" | "approved" | "resolved" }
      });
      return unwrapResponse<{ success: boolean; status?: string }>(response);
    },
    ...options,
    onSuccess: (...args) => {
      options?.onSuccess?.(...args);
      queryClient.invalidateQueries({ queryKey: ["admin_inquiries"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "action-items"] });
    },
  });
}

/**
 * PATCH /api/inquiries/admin/:id/notes - Update inquiry notes
 */
export function useUpdateInquiryNotes(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, { id: string; notes: string | null }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, { id: string; notes: string | null }>({
    mutationFn: async ({ id, notes }) => {
      const response = await client.inquiries.admin[":id"].notes.$patch({
        param: { id },
        json: { notes }
      });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...options,
    onSuccess: (...args) => {
      options?.onSuccess?.(...args);
      queryClient.invalidateQueries({ queryKey: ["admin_inquiries"] });
    },
  });
}

/**
 * DELETE /api/inquiries/admin/:id - Delete an inquiry
 */
export function useDeleteInquiry(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, string>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (id) => {
      const response = await client.inquiries.admin[":id"].$delete({ param: { id } });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...options,
    onSuccess: (...args) => {
      options?.onSuccess?.(...args);
      queryClient.invalidateQueries({ queryKey: ["admin_inquiries"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "action-items"] });
    },
  });
}
