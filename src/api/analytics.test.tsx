import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as honoClient from "./honoClient";
import * as analyticsApi from "./analytics";

// Mock the honoClient module
vi.mock("./honoClient", () => ({
  client: {
    analytics: {
      track: {
        $post: vi.fn(),
      },
      "sponsor-click": {
        $post: vi.fn(),
      },
      leaderboard: {
        $get: vi.fn(),
      },
      admin: {
        stats: {
          $get: vi.fn(),
        },
        "platform-analytics": {
          $get: vi.fn(),
        },
        "roster-stats": {
          $get: vi.fn(),
        },
      },
      search: {
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
interface MockAnalyticsClient {
  track: {
    $post: ReturnType<typeof vi.fn>;
  };
  "sponsor-click": {
    $post: ReturnType<typeof vi.fn>;
  };
  leaderboard: {
    $get: ReturnType<typeof vi.fn>;
  };
  admin: {
    stats: {
      $get: ReturnType<typeof vi.fn>;
    };
    "platform-analytics": {
      $get: ReturnType<typeof vi.fn>;
    };
    "roster-stats": {
      $get: ReturnType<typeof vi.fn>;
    };
  };
  search: {
    $get: ReturnType<typeof vi.fn>;
  };
}

interface MockClient {
  analytics: MockAnalyticsClient;
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

describe("Analytics API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useTrackPageView", () => {
    it("should track page view successfully", async () => {
      const mockResponse = { success: true };
      mockClient.analytics.track.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => analyticsApi.useTrackPageView(), { wrapper });

      result.current.mutate({
        path: "/about",
        category: "page",
        referrer: "https://google.com",
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.analytics.track.$post).toHaveBeenCalledWith({
        json: {
          path: "/about",
          category: "page",
          referrer: "https://google.com",
        },
      });
    });

    it("should handle tracking errors", async () => {
      const mockError = new Error("Tracking failed");
      mockClient.analytics.track.$post.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => analyticsApi.useTrackPageView(), { wrapper });

      result.current.mutate({ path: "/test" });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useTrackSponsorClick", () => {
    it("should track sponsor click successfully", async () => {
      const mockResponse = { success: true };
      mockClient.analytics["sponsor-click"].$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => analyticsApi.useTrackSponsorClick(), { wrapper });

      result.current.mutate({ sponsor_id: "sponsor-123" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.analytics["sponsor-click"].$post).toHaveBeenCalledWith({
        json: { sponsor_id: "sponsor-123" },
      });
    });
  });

  describe("useGetLeaderboard", () => {
    it("should fetch leaderboard successfully", async () => {
      const mockLeaderboard = [
        { user_id: "1", nickname: "User 1", badge_count: 10 },
        { user_id: "2", nickname: "User 2", badge_count: 8 },
      ];
      const mockResponse = { leaderboard: mockLeaderboard };
      mockClient.analytics.leaderboard.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => analyticsApi.useGetLeaderboard(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });
  });

  describe("useGetStats", () => {
    it("should fetch platform stats successfully", async () => {
      const mockStats = {
        posts: 100,
        events: 50,
        docs: 25,
        integrations: {
          zulip: true,
          github: true,
          tba: false,
        },
        securityBlocks: 5,
      };
      mockClient.analytics.admin.stats.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockStats);

      const { result } = renderHook(() => analyticsApi.useGetStats(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockStats);
    });
  });

  describe("useGetPlatformAnalytics", () => {
    it("should fetch comprehensive platform analytics successfully", async () => {
      const mockAnalytics = {
        totalPageViews: 10000,
        uniqueVisitors: 5000,
        topPages: [
          { path: "/about", views: 1000 },
          { path: "/sponsors", views: 800 },
        ],
        topReferrers: [
          { referrer: "google.com", visits: 500 },
          { referrer: "twitter.com", visits: 300 },
        ],
        recentViews: [
          { path: "/about", timestamp: "2024-01-01T00:00:00Z" },
        ],
        totals: [
          { category: "page", total: 5000 },
          { category: "api", total: 3000 },
        ],
        userActivity: [
          { user_id: "1", activity_count: 100 },
        ],
        resourceUsage: {
          cpu: 50,
          memory: 60,
          storage: 40,
        },
      };
      mockClient.analytics.admin["platform-analytics"].$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockAnalytics);

      const { result } = renderHook(() => analyticsApi.useGetPlatformAnalytics(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockAnalytics);
    });
  });

  describe("useGetRosterStats", () => {
    it("should fetch roster stats successfully", async () => {
      const mockRosterStats = {
        roster: [
          {
            user_id: "1",
            nickname: "Student 1",
            member_type: "student",
            impact_hours: 50,
            events_attended: 10,
          },
        ],
      };
      mockClient.analytics.admin["roster-stats"].$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockRosterStats);

      const { result } = renderHook(() => analyticsApi.useGetRosterStats(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockRosterStats);
    });
  });

  describe("useSearch", () => {
    it("should fetch search results successfully", async () => {
      const mockResults = [
        { type: "post", title: "Test Post", url: "/posts/test" },
        { type: "event", title: "Test Event", url: "/events/test" },
      ];
      const mockResponse = { results: mockResults };
      mockClient.analytics.search.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => analyticsApi.useSearch("test query"), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.analytics.search.$get).toHaveBeenCalledWith({
        query: { q: "test query" },
      });
    });

    it("should be disabled for short queries", () => {
      const { result } = renderHook(() => analyticsApi.useSearch("t"), { wrapper });
      expect(result.current.fetchStatus).toBe("idle");
    });

    it("should be disabled for empty query", () => {
      const { result } = renderHook(() => analyticsApi.useSearch(""), { wrapper });
      expect(result.current.fetchStatus).toBe("idle");
    });

    it("should handle search errors", async () => {
      const mockError = new Error("Search failed");
      mockClient.analytics.search.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => analyticsApi.useSearch("test"), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });
});
