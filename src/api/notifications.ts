/**
 * Notifications API - User notifications, marking read/unread
 *
 * Types imported from backend route definitions in @shared/routes/notifications.ts
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { z } from "zod";
import { client, unwrapResponse } from "./honoClient";

// Re-export schemas for type inference
import {
  notificationSchema,
} from "@shared/routes/notifications";

// Infer TypeScript types from Zod schemas
export type Notification = z.infer<typeof notificationSchema>;

export interface NotificationsResponse {
  notifications: Notification[];
}

export interface SuccessResponse {
  success: boolean;
}

export interface PendingCountsResponse {
  inquiries: number;
  posts: number;
  events: number;
  docs: number;
}

export interface DashboardActionItemsResponse {
  inquiries: Record<string, unknown>[];
  posts: Record<string, unknown>[];
  events: Record<string, unknown>[];
  docs: Record<string, unknown>[];
}

// ============================================
// Notifications
// ============================================

/**
 * GET /api/notifications - Get user notifications
 */
export function useGetNotifications(
  options?: Omit<UseQueryOptions<NotificationsResponse>, "queryKey" | "queryFn">
) {
  return useQuery<NotificationsResponse>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const response = await client.notifications.$get();
      return unwrapResponse<NotificationsResponse>(response);
    },
    ...options,
  });
}

/**
 * PUT /api/notifications/:id/read - Mark a notification as read
 */
export function useMarkNotificationRead(
  options?: Omit<UseMutationOptions<SuccessResponse, Error, string>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<SuccessResponse, Error, string>({
    mutationFn: async (id) => {
      const response = await client.notifications[":id"].read.$put({ param: { id } });
      return unwrapResponse<SuccessResponse>(response);
    },
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      options?.onSuccess?.(...args);
    },
  });
}

/**
 * PUT /api/notifications/read-all - Mark all notifications as read
 */
export function useMarkAllNotificationsRead(
  options?: Omit<UseMutationOptions<SuccessResponse, Error, void>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<SuccessResponse, Error, void>({
    mutationFn: async () => {
      const response = await client.notifications["read-all"].$put();
      return unwrapResponse<SuccessResponse>(response);
    },
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      options?.onSuccess?.(...args);
    },
  });
}

/**
 * DELETE /api/notifications/:id - Delete a notification
 */
export function useDeleteNotification(
  options?: Omit<UseMutationOptions<SuccessResponse, Error, string>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<SuccessResponse, Error, string>({
    mutationFn: async (id) => {
      const response = await client.notifications[":id"].$delete({ param: { id } });
      return unwrapResponse<SuccessResponse>(response);
    },
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      options?.onSuccess?.(...args);
    },
  });
}

// ============================================
// Admin Dashboard
// ============================================

/**
 * GET /api/notifications/pending-counts - Get counts of pending items for dashboard badges
 */
export function useGetPendingCounts(
  options?: Omit<UseQueryOptions<PendingCountsResponse>, "queryKey" | "queryFn">
) {
  return useQuery<PendingCountsResponse>({
    queryKey: ["notifications", "pending-counts"],
    queryFn: async () => {
      const response = await client.notifications["pending-counts"].$get();
      return unwrapResponse<PendingCountsResponse>(response);
    },
    ...options,
  });
}

/**
 * GET /api/notifications/action-items - Get detailed action items (pending requests)
 */
export function useGetDashboardActionItems(
  options?: Omit<UseQueryOptions<DashboardActionItemsResponse>, "queryKey" | "queryFn">
) {
  return useQuery<DashboardActionItemsResponse>({
    queryKey: ["notifications", "action-items"],
    queryFn: async () => {
      const response = await client.notifications["action-items"].$get();
      return unwrapResponse<DashboardActionItemsResponse>(response);
    },
    ...options,
  });
}
