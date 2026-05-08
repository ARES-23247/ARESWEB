import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as honoClient from "./honoClient";
import * as socialQueueApi from "./socialQueue";

// Mock the honoClient module
vi.mock("./honoClient", () => ({
  client: {
    "social-queue": {
      $get: vi.fn(),
      $post: vi.fn(),
      calendar: {
        $get: vi.fn(),
      },
      ":id": {
        $patch: vi.fn(),
        $delete: vi.fn(),
        "send-now": {
          $post: vi.fn(),
        },
      },
      analytics: {
        $get: vi.fn(),
      },
    },
  },
  unwrapResponse: vi.fn(),
}));

const mockClient = honoClient.client as any;
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

describe("Social Queue API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useGetSocialQueue", () => {
    it("should fetch social queue successfully", async () => {
      const mockPosts = [
        { id: "1", content: "Post 1", status: "pending", scheduled_for: "2024-01-01T12:00:00Z" },
        { id: "2", content: "Post 2", status: "sent", scheduled_for: "2024-01-02T12:00:00Z" },
      ];
      const mockResponse = { posts: mockPosts, total: 2 };
      mockClient["social-queue"].$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => socialQueueApi.useGetSocialQueue(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });

    it("should accept query parameters", async () => {
      const mockResponse = { posts: [], total: 0 };
      mockClient["social-queue"].$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(
        () => socialQueueApi.useGetSocialQueue({ status: "pending", limit: 10 }),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient["social-queue"].$get).toHaveBeenCalledWith({
        query: { status: "pending", limit: 10 },
      });
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch queue");
      mockClient["social-queue"].$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => socialQueueApi.useGetSocialQueue(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });
  });

  describe("useGetSocialCalendar", () => {
    it("should fetch social calendar successfully", async () => {
      const mockPosts = [
        { id: "1", content: "Post 1", scheduled_for: "2024-01-01T12:00:00Z" },
      ];
      const mockResponse = { posts: mockPosts };
      mockClient["social-queue"].calendar.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(
        () => socialQueueApi.useGetSocialCalendar({ start: "2024-01-01", end: "2024-01-31" }),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient["social-queue"].calendar.$get).toHaveBeenCalledWith({
        query: { start: "2024-01-01", end: "2024-01-31" },
      });
    });

    it("should be disabled when start or end is empty", () => {
      const { result: result1 } = renderHook(
        () => socialQueueApi.useGetSocialCalendar({ start: "", end: "2024-01-31" }),
        { wrapper }
      );
      const { result: result2 } = renderHook(
        () => socialQueueApi.useGetSocialCalendar({ start: "2024-01-01", end: "" }),
        { wrapper }
      );

      expect(result1.current.fetchStatus).toBe("idle");
      expect(result2.current.fetchStatus).toBe("idle");
    });
  });

  describe("useCreateSocialPost", () => {
    it("should create social post successfully", async () => {
      const mockPost = { id: "123", content: "New post", status: "pending" };
      const mockResponse = { success: true, post: mockPost };
      mockClient["social-queue"].$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => socialQueueApi.useCreateSocialPost(), { wrapper });

      const postData = {
        content: "New post",
        scheduled_for: "2024-01-01T12:00:00Z",
        platforms: { twitter: true, instagram: false },
      };

      result.current.mutate(postData as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });

    it("should handle creation errors", async () => {
      const mockError = new Error("Failed to create post");
      mockClient["social-queue"].$post.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => socialQueueApi.useCreateSocialPost(), { wrapper });

      result.current.mutate({
        content: "New post",
        scheduled_for: "2024-01-01T12:00:00Z",
        platforms: {},
      } as any);

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should invalidate social-queue queries on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true, post: { id: "123" } };
      mockClient["social-queue"].$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => socialQueueApi.useCreateSocialPost(), { wrapper: customWrapper });

      result.current.mutate({
        content: "New post",
        scheduled_for: "2024-01-01T12:00:00Z",
        platforms: {},
      } as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["social-queue"] });
    });
  });

  describe("useUpdateSocialPost", () => {
    it("should update social post successfully", async () => {
      const mockPost = { id: "123", content: "Updated post", status: "pending" };
      const mockResponse = { success: true, post: mockPost };
      mockClient["social-queue"][":id"].$patch.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => socialQueueApi.useUpdateSocialPost(), { wrapper });

      result.current.mutate({ id: "123", updates: { content: "Updated post" } } as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient["social-queue"][":id"].$patch).toHaveBeenCalledWith({
        param: { id: "123" },
        json: { content: "Updated post" },
      });
    });

    it("should handle update errors", async () => {
      const mockError = new Error("Failed to update post");
      mockClient["social-queue"][":id"].$patch.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => socialQueueApi.useUpdateSocialPost(), { wrapper });

      result.current.mutate({ id: "123", updates: { status: "cancelled" } } as any);

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });
  });

  describe("useDeleteSocialPost", () => {
    it("should delete social post successfully", async () => {
      const mockResponse = { success: true };
      mockClient["social-queue"][":id"].$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => socialQueueApi.useDeleteSocialPost(), { wrapper });

      result.current.mutate("123" as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient["social-queue"][":id"].$delete).toHaveBeenCalledWith({
        param: { id: "123" },
      });
    });

    it("should handle delete errors", async () => {
      const mockError = new Error("Failed to delete post");
      mockClient["social-queue"][":id"].$delete.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => socialQueueApi.useDeleteSocialPost(), { wrapper });

      result.current.mutate("123" as any);

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });
  });

  describe("useSendSocialPostNow", () => {
    it("should send social post immediately successfully", async () => {
      const mockResponse = { success: true };
      mockClient["social-queue"][":id"]["send-now"].$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => socialQueueApi.useSendSocialPostNow(), { wrapper });

      result.current.mutate("123" as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient["social-queue"][":id"]["send-now"].$post).toHaveBeenCalledWith({
        param: { id: "123" },
      });
    });

    it("should handle send now errors", async () => {
      const mockError = new Error("Failed to send post");
      mockClient["social-queue"][":id"]["send-now"].$post.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => socialQueueApi.useSendSocialPostNow(), { wrapper });

      result.current.mutate("123" as any);

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });
  });

  describe("useGetSocialAnalytics", () => {
    it("should fetch social analytics successfully", async () => {
      const mockResponse = {
        total_posts: 100,
        total_sent: 80,
        total_pending: 15,
        total_failed: 5,
        by_platform: { twitter: 50, instagram: 30 },
        engagement: {
          total_impressions: 10000,
          total_likes: 500,
          total_shares: 100,
          total_comments: 50,
        },
      };
      mockClient["social-queue"].analytics.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => socialQueueApi.useGetSocialAnalytics(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });

    it("should accept date range query parameters", async () => {
      const mockResponse = {
        total_posts: 50,
        total_sent: 40,
        total_pending: 10,
        total_failed: 0,
        by_platform: {},
        engagement: {
          total_impressions: 5000,
          total_likes: 250,
          total_shares: 50,
          total_comments: 25,
        },
      };
      mockClient["social-queue"].analytics.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(
        () => socialQueueApi.useGetSocialAnalytics({ start: "2024-01-01", end: "2024-01-31" }),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient["social-queue"].analytics.$get).toHaveBeenCalledWith({
        query: { start: "2024-01-01", end: "2024-01-31" },
      });
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch analytics");
      mockClient["social-queue"].analytics.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => socialQueueApi.useGetSocialAnalytics(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });
  });
});
