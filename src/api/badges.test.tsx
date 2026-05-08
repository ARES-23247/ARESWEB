import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as honoClient from "./honoClient";
import * as badgesApi from "./badges";

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
      $get: vi.fn(),
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

describe("Badges API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useGetBadges", () => {
    it("should fetch badges successfully", async () => {
      const mockBadges = [
        { id: "1", name: "Rookie", description: "New member", icon: "star" },
        { id: "2", name: "Veteran", description: "2+ years", icon: "medal" },
      ];
      const mockResponse = { badges: mockBadges };
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
      const mockLeaderboard = [
        { user_id: "1", nickname: "Top Scorer", member_type: "student", badge_count: 15 },
        { user_id: "2", nickname: "Second", member_type: "mentor", badge_count: 10 },
      ];
      const mockResponse = { leaderboard: mockLeaderboard };
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
      const newBadge = {
        id: "new-123",
        name: "Achievement Unlocked",
        description: "Special badge",
        icon: "trophy",
      };
      mockClient.badges.admin.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => badgesApi.useCreateBadge(), { wrapper });

      result.current.mutate(newBadge as any);

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

      result.current.mutate({ name: "Test", description: "Test badge" } as unknown as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["badges"] });
    });

    it("should handle create errors", async () => {
      const mockError = new Error("Failed to create badge");
      mockClient.badges.admin.$post.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => badgesApi.useCreateBadge(), { wrapper });

      result.current.mutate({ name: "Test" } as unknown as any);

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useGrantBadge", () => {
    it("should grant badge to user successfully", async () => {
      const mockResponse = { success: true };
      mockClient.badges.admin.grant.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => badgesApi.useGrantBadge(), { wrapper });

      result.current.mutate({ userId: "user-123", badgeId: "badge-456" } as any);

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

      result.current.mutate({ userId: "user-123", badgeId: "badge-456" } as any);

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

      result.current.mutate({ userId: "user-123", badgeId: "badge-456" } as any);

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

      result.current.mutate({ userId: "user-123", badgeId: "badge-456" } as any);

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useDeleteBadge", () => {
    it("should delete badge definition successfully", async () => {
      const mockResponse = { success: true };
      mockClient.badges.admin[":id"].$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => badgesApi.useDeleteBadge(), { wrapper });

      result.current.mutate("badge-123" as any);

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

      result.current.mutate("badge-123" as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["badges"] });
    });
  });

  describe("useGetUsersForBadges", () => {
    it("should fetch users list for badge assignment successfully", async () => {
      const mockUsers = [
        { id: "1", name: "User 1", nickname: "Nick 1", email: "user1@test.com" },
        { id: "2", name: "User 2", nickname: null, email: "user2@test.com" },
      ];
      const mockResponse = { users: mockUsers };
      mockClient.users.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => badgesApi.useGetUsersForBadges(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });
  });
});
