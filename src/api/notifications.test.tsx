import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as honoClient from "./honoClient";
import * as notificationsApi from "./notifications";

// Mock the honoClient module
vi.mock("./honoClient", () => ({
  client: {
    notifications: {
      $get: vi.fn(),
      ":id": {
        read: {
          $put: vi.fn(),
        },
        $delete: vi.fn(),
      },
      "read-all": {
        $put: vi.fn(),
      },
      "pending-counts": {
        $get: vi.fn(),
      },
      "action-items": {
        $get: vi.fn(),
      },
    },
  },
  unwrapResponse: vi.fn(),
  withMutationCallbacks: vi.fn((queryClient, options, callbacks) => {
    // Run internal callbacks first
    const originalOnSuccess = options?.onSuccess;
    const originalOnError = options?.onError;
    return {
      ...options,
      onSuccess: async (...args: unknown[]) => {
        await callbacks.onSuccess?.(queryClient, ...(args as [unknown, unknown]));
        await originalOnSuccess?.(...args as [unknown, unknown, unknown]);
      },
      onError: async (...args: unknown[]) => {
        await callbacks.onError?.(queryClient, ...(args as [unknown, unknown]));
        await originalOnError?.(...args as [unknown, unknown, unknown]);
      },
    };
  }),
}));

const mockClient = honoClient.client as unknown as {
  notifications: {
    $get: ReturnType<typeof vi.fn>;
    ":id": {
      read: {
        $put: ReturnType<typeof vi.fn>;
      };
      $delete: ReturnType<typeof vi.fn>;
    };
    "read-all": {
      $put: ReturnType<typeof vi.fn>;
    };
    "pending-counts": {
      $get: ReturnType<typeof vi.fn>;
    };
    "action-items": {
      $get: ReturnType<typeof vi.fn>;
    };
  };
};
const mockUnwrapResponse = honoClient.unwrapResponse as ReturnType<typeof vi.fn>;

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>
);

describe("Notifications API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useGetNotifications", () => {
    it("should fetch user notifications successfully", async () => {
      const mockNotifications = [
        { id: "1", title: "New post", message: "A new post was published", read: false, created_at: "2024-01-01" },
        { id: "2", title: "Event reminder", message: "Robotics meeting tomorrow", read: true, created_at: "2024-01-02" },
      ];
      const mockResponse = { notifications: mockNotifications };
      mockClient.notifications.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => notificationsApi.useGetNotifications(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch notifications");
      mockClient.notifications.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => notificationsApi.useGetNotifications(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useMarkNotificationRead", () => {
    it("should mark notification as read successfully", async () => {
      const mockResponse = { success: true };
      mockClient.notifications[":id"].read.$put.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => notificationsApi.useMarkNotificationRead(), { wrapper });

      result.current.mutate("notif-123");

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.notifications[":id"].read.$put).toHaveBeenCalledWith({
        param: { id: "notif-123" },
      });
    });

    it("should invalidate notifications cache on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true };
      mockClient.notifications[":id"].read.$put.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => notificationsApi.useMarkNotificationRead(), {
        wrapper: customWrapper,
      });

      result.current.mutate("notif-123");

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["notifications"] });
    });

    it("should handle mark read errors", async () => {
      const mockError = new Error("Failed to mark as read");
      mockClient.notifications[":id"].read.$put.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => notificationsApi.useMarkNotificationRead(), { wrapper });

      result.current.mutate("notif-123");

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useMarkAllNotificationsRead", () => {
    it("should mark all notifications as read successfully", async () => {
      const mockResponse = { success: true };
      mockClient.notifications["read-all"].$put.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => notificationsApi.useMarkAllNotificationsRead(), { wrapper });

      result.current.mutate();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.notifications["read-all"].$put).toHaveBeenCalledWith();
    });

    it("should invalidate notifications cache on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true };
      mockClient.notifications["read-all"].$put.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => notificationsApi.useMarkAllNotificationsRead(), {
        wrapper: customWrapper,
      });

      result.current.mutate();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["notifications"] });
    });
  });

  describe("useDeleteNotification", () => {
    it("should delete notification successfully", async () => {
      const mockResponse = { success: true };
      mockClient.notifications[":id"].$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => notificationsApi.useDeleteNotification(), { wrapper });

      result.current.mutate("notif-123");

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.notifications[":id"].$delete).toHaveBeenCalledWith({
        param: { id: "notif-123" },
      });
    });

    it("should invalidate notifications cache on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true };
      mockClient.notifications[":id"].$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => notificationsApi.useDeleteNotification(), {
        wrapper: customWrapper,
      });

      result.current.mutate("notif-123");

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["notifications"] });
    });

    it("should handle delete errors", async () => {
      const mockError = new Error("Failed to delete notification");
      mockClient.notifications[":id"].$delete.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => notificationsApi.useDeleteNotification(), { wrapper });

      result.current.mutate("notif-123");

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useGetPendingCounts", () => {
    it("should fetch pending counts successfully", async () => {
      const mockCounts = {
        inquiries: 5,
        posts: 3,
        events: 2,
        docs: 1,
      };
      mockClient.notifications["pending-counts"].$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockCounts);

      const { result } = renderHook(() => notificationsApi.useGetPendingCounts(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockCounts);
    });

    it("should handle zero counts", async () => {
      const mockCounts = {
        inquiries: 0,
        posts: 0,
        events: 0,
        docs: 0,
      };
      mockClient.notifications["pending-counts"].$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockCounts);

      const { result } = renderHook(() => notificationsApi.useGetPendingCounts(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.inquiries).toBe(0);
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch pending counts");
      mockClient.notifications["pending-counts"].$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => notificationsApi.useGetPendingCounts(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useGetDashboardActionItems", () => {
    it("should fetch dashboard action items successfully", async () => {
      const mockActionItems = {
        inquiries: [{ id: "1", name: "John Doe", status: "pending" }],
        posts: [{ id: "1", title: "Draft Post", status: "pending_approval" }],
        events: [{ id: "1", title: "Upcoming Event", status: "needs_review" }],
        docs: [{ id: "1", title: "New Doc", status: "draft" }],
      };
      mockClient.notifications["action-items"].$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockActionItems);

      const { result } = renderHook(() => notificationsApi.useGetDashboardActionItems(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockActionItems);
    });

    it("should handle empty action items", async () => {
      const mockActionItems = {
        inquiries: [],
        posts: [],
        events: [],
        docs: [],
      };
      mockClient.notifications["action-items"].$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockActionItems);

      const { result } = renderHook(() => notificationsApi.useGetDashboardActionItems(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.inquiries).toEqual([]);
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch action items");
      mockClient.notifications["action-items"].$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => notificationsApi.useGetDashboardActionItems(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });
});
