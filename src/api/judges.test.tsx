import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as honoClient from "./honoClient";
import * as judgesApi from "./judges";

// Mock the honoClient module
vi.mock("./honoClient", () => ({
  client: {
    judges: {
      login: {
        $post: vi.fn(),
      },
      portfolio: {
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
interface MockJudgesClient {
  login: {
    $post: ReturnType<typeof vi.fn>;
  };
  portfolio: {
    $get: ReturnType<typeof vi.fn>;
  };
}

interface MockClient {
  judges: MockJudgesClient;
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

describe("Judges API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useJudgeLogin", () => {
    it("should verify judge access code successfully", async () => {
      const mockResponse = { success: true, label: "Judge #1" };
      mockClient.judges.login.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => judgesApi.useJudgeLogin(), { wrapper });

      result.current.mutate({ code: "JUDGE-ABC-123" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.judges.login.$post).toHaveBeenCalledWith({
        json: { code: "JUDGE-ABC-123" },
      });
      expect(result.current.data?.label).toBe("Judge #1");
    });

    it("should pass turnstile token when provided", async () => {
      const mockResponse = { success: true };
      mockClient.judges.login.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => judgesApi.useJudgeLogin(), { wrapper });

      result.current.mutate({ code: "TEST-CODE", turnstileToken: "turnstile-token-xyz" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.judges.login.$post).toHaveBeenCalledWith({
        json: { code: "TEST-CODE", turnstileToken: "turnstile-token-xyz" },
      });
    });

    it("should handle login failure", async () => {
      const mockResponse = { success: false };
      mockClient.judges.login.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => judgesApi.useJudgeLogin(), { wrapper });

      result.current.mutate({ code: "INVALID-CODE" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.success).toBe(false);
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Network error");
      mockClient.judges.login.$post.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => judgesApi.useJudgeLogin(), { wrapper });

      result.current.mutate({ code: "TEST" });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useGetJudgePortfolio", () => {
    it("should fetch judge portfolio successfully", async () => {
      const mockPortfolioDocs = [
        { slug: "doc1", title: "Engineering Portfolio", category: "Technical", description: "Our engineering journey", content: "Content..." },
      ];
      const mockOutreach = [
        { id: "1", title: "Robotics Demo", date: "2024-01-15", description: "Demo at elementary school", location: "Lincoln Elementary", students_count: 50, hours_logged: 4, reach_count: 100 },
      ];
      const mockAwards = [
        { id: 1, title: "Winner", date: "2024-02-01", event_name: "State Championship", image_url: "/trophy.jpg", description: "First place", year: 2024 },
      ];
      const mockSponsors = [
        { id: "1", name: "Acme Corp", tier: "gold", logo_url: "/acme.png", website_url: "https://acme.com" },
      ];
      const mockResponse = {
        portfolioDocs: mockPortfolioDocs,
        outreach: mockOutreach,
        awards: mockAwards,
        sponsors: mockSponsors,
      };
      mockClient.judges.portfolio.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => judgesApi.useGetJudgePortfolio("JUDGE-ABC-123"), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.judges.portfolio.$get).toHaveBeenCalledWith({
        headers: { "x-judge-code": "JUDGE-ABC-123" },
      });
    });

    it("should be disabled when code is empty", async () => {
      const { result } = renderHook(() => judgesApi.useGetJudgePortfolio(""), { wrapper });

      expect(result.current.fetchStatus).toBe("idle");
    });

    it("should be enabled when code is provided", async () => {
      mockClient.judges.portfolio.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue({
        portfolioDocs: [],
        outreach: [],
        awards: [],
        sponsors: [],
      });

      const { result } = renderHook(() => judgesApi.useGetJudgePortfolio("valid-code"), { wrapper });

      expect(result.current.fetchStatus).not.toBe("idle");
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch portfolio");
      mockClient.judges.portfolio.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => judgesApi.useGetJudgePortfolio("invalid-code"), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });
});
