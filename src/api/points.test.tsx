import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as honoClient from "./honoClient";
import * as pointsApi from "./points";

// Mock the honoClient module
vi.mock("./honoClient", () => ({
  client: {
    points: {
      balance: {
        ":userId": {
          $get: vi.fn(),
        },
      },
      history: {
        ":userId": {
          $get: vi.fn(),
        },
      },
      transaction: {
        $post: vi.fn(),
      },
      leaderboard: {
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

// Mock types for the Hono client
interface MockPointsClient {
  balance: {
    ":userId": {
      $get: ReturnType<typeof vi.fn>;
    };
  };
  history: {
    ":userId": {
      $get: ReturnType<typeof vi.fn>;
    };
  };
  transaction: {
    $post: ReturnType<typeof vi.fn>;
  };
  leaderboard: {
    $get: ReturnType<typeof vi.fn>;
  };
}

interface MockClient {
  points: MockPointsClient;
}

const mockClient = honoClient.client as MockClient;
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

describe("Points API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useGetPointsBalance", () => {
    it("should fetch user points balance successfully", async () => {
      const mockBalance = {
        userId: "user123",
        balance: 500,
        total_earned: 1000,
        total_spent: 500,
      };
      mockClient.points.balance[":userId"].$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockBalance);

      const { result } = renderHook(() => pointsApi.useGetPointsBalance("user123"), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockBalance);
      expect(mockClient.points.balance[":userId"].$get).toHaveBeenCalledWith({
        param: { userId: "user123" },
      });
    });

    it("should be disabled when userId is empty", () => {
      const { result } = renderHook(() => pointsApi.useGetPointsBalance(""), { wrapper });

      expect(result.current.fetchStatus).toBe("idle");
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch balance");
      mockClient.points.balance[":userId"].$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => pointsApi.useGetPointsBalance("user123"), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });
  });

  describe("useGetPointsHistory", () => {
    it("should fetch user points history successfully", async () => {
      const mockHistory = [
        {
          id: "1",
          userId: "user123",
          pointsDelta: 50,
          reason: "Attended meeting",
          createdAt: "2024-01-15T10:00:00Z",
        },
        {
          id: "2",
          userId: "user123",
          pointsDelta: -25,
          reason: "Redeemed reward",
          createdAt: "2024-01-16T14:00:00Z",
        },
      ];
      mockClient.points.history[":userId"].$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockHistory);

      const { result } = renderHook(() => pointsApi.useGetPointsHistory("user123"), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockHistory);
      expect(mockClient.points.history[":userId"].$get).toHaveBeenCalledWith({
        param: { userId: "user123" },
      });
    });

    it("should be disabled when userId is empty", () => {
      const { result } = renderHook(() => pointsApi.useGetPointsHistory(""), { wrapper });

      expect(result.current.fetchStatus).toBe("idle");
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch history");
      mockClient.points.history[":userId"].$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => pointsApi.useGetPointsHistory("user123"), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should handle empty history", async () => {
      mockClient.points.history[":userId"].$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue([]);

      const { result } = renderHook(() => pointsApi.useGetPointsHistory("user123"), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([]);
    });
  });

  describe("useAwardPoints", () => {
    it("should award points successfully", async () => {
      const mockResponse = { success: true, transactionId: "txn123" };
      mockClient.points.transaction.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => pointsApi.useAwardPoints(), { wrapper });

      const awardData = {
        userId: "user123",
        pointsDelta: 100,
        reason: "Excellent work at competition",
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result.current.mutate(awardData as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.points.transaction.$post).toHaveBeenCalledWith({
        json: awardData,
      });
    });

    it("should deduct points successfully", async () => {
      const mockResponse = { success: true, transactionId: "txn124" };
      mockClient.points.transaction.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => pointsApi.useAwardPoints(), { wrapper });

      const deductData = {
        userId: "user123",
        pointsDelta: -50,
        reason: "Redeemed team hoodie",
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result.current.mutate(deductData as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });

    it("should handle award errors", async () => {
      const mockError = new Error("Failed to award points");
      mockClient.points.transaction.$post.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => pointsApi.useAwardPoints(), { wrapper });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result.current.mutate as any)(
        {
          userId: "user123",
          pointsDelta: 50,
          reason: "Good job",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {} as any
      );

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should invalidate relevant queries on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true, transactionId: "txn125" };
      mockClient.points.transaction.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => pointsApi.useAwardPoints(), { wrapper: customWrapper });

      const awardData = {
        userId: "user123",
        pointsDelta: 75,
        reason: "Mentoring new students",
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result.current.mutate(awardData as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["points", "balance", "user123"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["points", "history", "user123"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["leaderboard"] });
    });
  });

  describe("useGetPointsLeaderboard", () => {
    it("should fetch points leaderboard successfully", async () => {
      const mockLeaderboard = [
        {
          userId: "user1",
          name: "Alice Johnson",
          balance: 1250,
          rank: 1,
        },
        {
          userId: "user2",
          name: "Bob Smith",
          balance: 980,
          rank: 2,
        },
        {
          userId: "user3",
          name: "Carol Williams",
          balance: 850,
          rank: 3,
        },
      ];
      const mockResponse = { leaderboard: mockLeaderboard };
      mockClient.points.leaderboard.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => pointsApi.useGetPointsLeaderboard(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.points.leaderboard.$get).toHaveBeenCalled();
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch leaderboard");
      mockClient.points.leaderboard.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => pointsApi.useGetPointsLeaderboard(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should handle empty leaderboard", async () => {
      const mockResponse = { leaderboard: [] };
      mockClient.points.leaderboard.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => pointsApi.useGetPointsLeaderboard(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.leaderboard).toEqual([]);
    });

    it("should properly order leaderboard by balance", async () => {
      const mockLeaderboard = [
        { id: "1", userId: "user1", name: "First", pointsBalance: 1000, rank: 1, avatar: null, nickname: "First", memberType: "student" },
        { id: "2", userId: "user2", name: "Second", pointsBalance: 500, rank: 2, avatar: null, nickname: "Second", memberType: "student" },
        { id: "3", userId: "user3", name: "Third", pointsBalance: 250, rank: 3, avatar: null, nickname: "Third", memberType: "student" },
      ];
      const mockResponse = { leaderboard: mockLeaderboard };
      mockClient.points.leaderboard.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => pointsApi.useGetPointsLeaderboard(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.leaderboard[0].pointsBalance || 0).toBeGreaterThanOrEqual(
        result.current.data?.leaderboard[1].pointsBalance || 0
      );
    });
  });
});


