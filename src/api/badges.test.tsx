import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as honoClient from "./honoClient";
import * as badgesApi from "./badges";
import type { BadgesResponse, BadgeLeaderboardResponse, BadgeUsersListResponse } from "./badges";

// Mock the honoClient module
vi.mock("./honoClient", () => ({
  client: {
    badges: {
      $get: vi.fn(),
      leaderboard: {
        $get: vi.fn(),
      },
      admin: {
        $post: vi.fn(),
        grant: {
          $post: vi.fn(),
          ":userId": {
            ":badgeId": {
              $delete: vi.fn(),
            },
          },
        },
        ":id": {
          $delete: vi.fn(),
        },
      },
    },
    users: {
      admin: {
        list: {
          $get: vi.fn(),
        },
      },
      $get: vi.fn(),
    },
  },
  unwrapResponse: vi.fn(),
  withMutationCallbacks: vi.fn((queryClient, options, callbacks) => {
    // Run internal callbacks first
    const originalOnSuccess = options?.onSuccess;
    const originalOnError = options?.onError;
    const originalOnSettled = options?.onSettled;
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
      onSettled: async (...args: unknown[]) => {
        await callbacks.onSettled?.(queryClient, ...(args as [unknown, unknown, unknown, unknown]));
        await originalOnSettled?.(...args as [unknown, unknown, unknown, unknown]);
      },
    };
  }),
}));

const mockClient = honoClient.client as unknown as {
  badges: {
    $get: ReturnType<typeof vi.fn>;
    leaderboard: {
      $get: ReturnType<typeof vi.fn>;
    };
    admin: {
      $post: ReturnType<typeof vi.fn>;
      grant: {
        $post: ReturnType<typeof vi.fn>;
        ":userId": {
          ":badgeId": {
            $delete: ReturnType<typeof vi.fn>;
          };
        };
      };
      ":id": {
        $delete: ReturnType<typeof vi.fn>;
      };
    };
  };
  users: {
    admin: {
      list: {
        $get: ReturnType<typeof vi.fn>;
      };
    };
    $get: ReturnType<typeof vi.fn>;
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

describe("Badges API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useGetBadges", () => {
    it("should fetch badges successfully", async () => {
      const mockBadges: badgesApi.Badge[] = [
        { id: "1", name: "Rookie", description: "New member", icon: "star", colorTheme: "blue", createdAt: "2024-01-01" },
        { id: "2", name: "Veteran", description: "2+ years", icon: "medal", colorTheme: "gold", createdAt: "2024-01-02" },
      ];
      const mockResponse: BadgesResponse = { badges: mockBadges };
      mockClient.badges.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => badgesApi.useGetBadges(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch badges");
      mockClient.badges.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => badgesApi.useGetBadges(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });
  });

  describe("useGetBadgeLeaderboard", () => {
    it("should fetch badge leaderboard successfully", async () => {
      const mockLeaderboard: BadgeLeaderboardResponse["leaderboard"] = [
        { userId: "1", nickname: "Top Scorer", memberType: "student", badgeCount: 15 },
        { userId: "2", nickname: "Second", memberType: "mentor", badgeCount: 10 },
      ];
      const mockResponse: BadgeLeaderboardResponse = { leaderboard: mockLeaderboard };
      mockClient.badges.leaderboard.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => badgesApi.useGetBadgeLeaderboard(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });
  });

  describe("useCreateBadge", () => {
    it("should create badge successfully", async () => {
      const mockResponse = { success: true };
      const newBadge: Omit<badgesApi.Badge, "createdAt"> = {
        id: "new-123",
        name: "Achievement Unlocked",
        description: "Special badge",
        icon: "trophy",
        colorTheme: "gold",
      };
      mockClient.badges.admin.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => badgesApi.useCreateBadge(), { wrapper });

      result.current.mutate(newBadge);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.badges.admin.$post).toHaveBeenCalledWith({
        json: newBadge,
      });
    });

    it("should invalidate badges cache on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true };
      mockClient.badges.admin.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => badgesApi.useCreateBadge(), { wrapper: customWrapper });

      result.current.mutate({ name: "Test", description: "Test badge", icon: "star", colorTheme: "blue", id: "test" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["badges"] });
    });

    it("should handle create errors", async () => {
      const mockError = new Error("Failed to create badge");
      mockClient.badges.admin.$post.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => badgesApi.useCreateBadge(), { wrapper });

      result.current.mutate({ name: "Test", description: "Test", icon: "star", colorTheme: "blue", id: "test" });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useGrantBadge", () => {
    it("should grant badge to user successfully", async () => {
      const mockResponse = { success: true };
      mockClient.badges.admin.grant.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => badgesApi.useGrantBadge(), { wrapper });

      result.current.mutate({ userId: "user-123", badgeId: "badge-456" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.badges.admin.grant.$post).toHaveBeenCalledWith({
        json: { userId: "user-123", badgeId: "badge-456" },
      });
    });

    it("should invalidate badges and leaderboard cache on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true };
      mockClient.badges.admin.grant.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => badgesApi.useGrantBadge(), { wrapper: customWrapper });

      result.current.mutate({ userId: "user-123", badgeId: "badge-456" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["badges"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["leaderboard"] });
    });
  });

  describe("useRevokeBadge", () => {
    it("should revoke badge from user successfully", async () => {
      const mockResponse = { success: true };
      mockClient.badges.admin.grant[":userId"][":badgeId"].$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => badgesApi.useRevokeBadge(), { wrapper });

      result.current.mutate({ userId: "user-123", badgeId: "badge-456" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.badges.admin.grant[":userId"][":badgeId"].$delete).toHaveBeenCalledWith({
        param: { userId: "user-123", badgeId: "badge-456" },
      });
    });

    it("should handle revoke errors", async () => {
      const mockError = new Error("Failed to revoke badge");
      mockClient.badges.admin.grant[":userId"][":badgeId"].$delete.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => badgesApi.useRevokeBadge(), { wrapper });

      result.current.mutate({ userId: "user-123", badgeId: "badge-456" });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useDeleteBadge", () => {
    it("should delete badge definition successfully", async () => {
      const mockResponse = { success: true };
      mockClient.badges.admin[":id"].$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => badgesApi.useDeleteBadge(), { wrapper });

      result.current.mutate("badge-123");

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.badges.admin[":id"].$delete).toHaveBeenCalledWith({
        param: { id: "badge-123" },
      });
    });

    it("should invalidate badges cache on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true };
      mockClient.badges.admin[":id"].$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => badgesApi.useDeleteBadge(), { wrapper: customWrapper });

      result.current.mutate("badge-123");

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["badges"] });
    });
  });

  describe("useGetUsersForBadges", () => {
    it("should fetch users list for badge assignment successfully", async () => {
      const mockUsers: BadgeUsersListResponse["users"] = [
        { id: "1", name: "User 1", nickname: "Nick 1", email: "user1@test.com" },
        { id: "2", name: "User 2", nickname: null, email: "user2@test.com" },
      ];
      const mockResponse: BadgeUsersListResponse = { users: mockUsers };
      mockClient.users.admin.list.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => badgesApi.useGetUsersForBadges(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });
  });
});


