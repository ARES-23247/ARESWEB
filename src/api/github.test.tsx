import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as honoClient from "./honoClient";
import * as githubApi from "./github";

// Mock the honoClient module
vi.mock("./honoClient", () => ({
  client: {
    github: {
      projects: {
        $get: vi.fn(),
        items: {
          $post: vi.fn(),
        },
      },
      activity: {
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
interface MockGitHubClient {
  projects: {
    $get: ReturnType<typeof vi.fn>;
    items: {
      $post: ReturnType<typeof vi.fn>;
    };
  };
  activity: {
    $get: ReturnType<typeof vi.fn>;
  };
}

interface MockClient {
  github: MockGitHubClient;
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

describe("GitHub API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useGetGitHubBoard", () => {
    it("should fetch GitHub board successfully", async () => {
      const mockBoard = [
        { id: "1", title: "Issue 1", status: "Todo" },
        { id: "2", title: "Issue 2", status: "In Progress" },
      ];
      const mockResponse = { success: true, board: mockBoard };
      mockClient.github.projects.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => githubApi.useGetGitHubBoard(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.github.projects.$get).toHaveBeenCalled();
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch board");
      mockClient.github.projects.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => githubApi.useGetGitHubBoard(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should handle empty board", async () => {
      const mockResponse = { success: true, board: [] };
      mockClient.github.projects.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => githubApi.useGetGitHubBoard(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.board).toEqual([]);
    });
  });

  describe("useCreateGitHubItem", () => {
    it("should create GitHub item successfully", async () => {
      const mockResponse = { success: true };
      mockClient.github.projects.items.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => githubApi.useCreateGitHubItem(), { wrapper });

      result.current.mutate({ title: "New Issue" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.github.projects.items.$post).toHaveBeenCalledWith({
        json: { title: "New Issue" },
      });
    });

    it("should handle creation errors", async () => {
      const mockError = new Error("Failed to create item");
      mockClient.github.projects.items.$post.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => githubApi.useCreateGitHubItem(), { wrapper });

      result.current.mutate({ title: "New Issue" });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should be in loading state during mutation", async () => {
      const mockResponse = { success: true };
      mockClient.github.projects.items.$post.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 100))
      );
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => githubApi.useCreateGitHubItem(), { wrapper });

      result.current.mutate({ title: "New Issue" });

      // Wait a tick for the mutation to start
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(result.current.isPending).toBe(true);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe("useGetGitHubActivity", () => {
    it("should fetch GitHub activity successfully", async () => {
      const mockGrid = [
        [{ date: "2024-01-01", count: 5 }],
        [{ date: "2024-01-02", count: 3 }],
      ];
      const mockResponse = {
        grid: mockGrid,
        totalCommits: 100,
        repoCount: 5,
      };
      mockClient.github.activity.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => githubApi.useGetGitHubActivity(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.github.activity.$get).toHaveBeenCalled();
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch activity");
      mockClient.github.activity.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => githubApi.useGetGitHubActivity(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should handle zero activity", async () => {
      const mockResponse = {
        grid: [],
        totalCommits: 0,
        repoCount: 0,
      };
      mockClient.github.activity.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => githubApi.useGetGitHubActivity(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.totalCommits).toBe(0);
    });
  });
});
