import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as honoClient from "./honoClient";
import * as sponsorsApi from "./sponsors";
import type { SponsorsResponse, SponsorRoiResponse, SponsorTokensResponse } from "./sponsors";

// Mock the honoClient module
vi.mock("./honoClient", () => ({
  client: {
    sponsors: {
      $get: vi.fn(),
      roi: {
        ":token": {
          $get: vi.fn(),
        },
      },
      admin: {
        list: {
          $get: vi.fn(),
        },
        save: {
          $post: vi.fn(),
        },
        ":id": {
          $delete: vi.fn(),
        },
        tokens: {
          $get: vi.fn(),
          generate: {
            $post: vi.fn(),
          },
        },
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
  sponsors: {
    $get: ReturnType<typeof vi.fn>;
    roi: {
      ":token": {
        $get: ReturnType<typeof vi.fn>;
      };
    };
    admin: {
      list: {
        $get: ReturnType<typeof vi.fn>;
      };
      save: {
        $post: ReturnType<typeof vi.fn>;
      };
      ":id": {
        $delete: ReturnType<typeof vi.fn>;
      };
      tokens: {
        $get: ReturnType<typeof vi.fn>;
        generate: {
          $post: ReturnType<typeof vi.fn>;
        };
      };
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

describe("Sponsors API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useGetSponsors", () => {
    it("should fetch public sponsors successfully", async () => {
      const mockSponsors: sponsorsApi.Sponsor[] = [
        { id: "1", name: "Acme Corp", logo_url: "/acme.png", tier: "Gold", website_url: null, is_active: 1 },
        { id: "2", name: "Beta Inc", logo_url: "/beta.png", tier: "Silver", website_url: null, is_active: 1 },
      ];
      const mockResponse: SponsorsResponse = { sponsors: mockSponsors };
      mockClient.sponsors.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => sponsorsApi.useGetSponsors(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch sponsors");
      mockClient.sponsors.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => sponsorsApi.useGetSponsors(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useGetSponsorRoi", () => {
    it("should fetch sponsor ROI dashboard successfully", async () => {
      const mockSponsor: sponsorsApi.Sponsor = { id: "1", name: "Acme Corp", logo_url: "/acme.png", tier: "Gold", website_url: null, is_active: 1 };
      const mockMetrics: sponsorsApi.SponsorRoiMetric[] = [
        { id: "1", sponsor_id: "1", clicks: 5000, impressions: 50000, year_month: "2024-01" },
        { id: "2", sponsor_id: "1", clicks: 2500, impressions: 25000, year_month: "2024-02" },
      ];
      const mockResponse: SponsorRoiResponse = { sponsor: mockSponsor, metrics: mockMetrics };
      mockClient.sponsors.roi[":token"].$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => sponsorsApi.useGetSponsorRoi("token-abc123"), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });

    it("should pass token parameter", async () => {
      const mockResponse: SponsorRoiResponse = { sponsor: undefined, metrics: [] };
      mockClient.sponsors.roi[":token"].$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => sponsorsApi.useGetSponsorRoi("my-custom-token"), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.sponsors.roi[":token"].$get).toHaveBeenCalledWith({
        param: { token: "my-custom-token" },
      });
    });

    it("should be disabled when token is empty", async () => {
      const { result } = renderHook(() => sponsorsApi.useGetSponsorRoi(""), { wrapper });

      expect(result.current.fetchStatus).toBe("idle");
    });

    it("should be enabled when token is provided", async () => {
      mockClient.sponsors.roi[":token"].$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue({ sponsor: undefined, metrics: [] } as SponsorRoiResponse);

      const { result } = renderHook(() => sponsorsApi.useGetSponsorRoi("valid-token"), { wrapper });

      expect(result.current.fetchStatus).not.toBe("idle");
    });
  });

  describe("useGetAdminSponsors", () => {
    it("should fetch admin sponsors list successfully", async () => {
      const mockSponsors = [
        { id: "1", name: "Acme Corp", tier: "Gold", contact_email: "acme@example.com" },
        { id: "2", name: "Beta Inc", tier: "Silver", contact_email: "beta@example.com" },
      ];
      const mockResponse = { sponsors: mockSponsors };
      mockClient.sponsors.admin.list.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => sponsorsApi.useGetAdminSponsors(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch admin sponsors");
      mockClient.sponsors.admin.list.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => sponsorsApi.useGetAdminSponsors(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useSaveSponsor", () => {
    it("should create new sponsor successfully", async () => {
      const mockResponse = { success: true, id: "new-sponsor-123" };
      const newSponsor = {
        name: "New Sponsor",
        tier: "Bronze",
        contact_email: "contact@newsponsor.com",
        logo_url: "/logo.png",
      };
      mockClient.sponsors.admin.save.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => sponsorsApi.useSaveSponsor(), { wrapper });

      result.current.mutate(newSponsor as sponsorsApi.SponsorPayload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.sponsors.admin.save.$post).toHaveBeenCalledWith({
        json: newSponsor,
      });
      expect(result.current.data?.id).toBe("new-sponsor-123");
    });

    it("should update existing sponsor successfully", async () => {
      const mockResponse = { success: true, id: "existing-123" };
      const updatedSponsor = {
        id: "existing-123",
        name: "Updated Name",
        tier: "Gold",
        contact_email: "updated@example.com",
      };
      mockClient.sponsors.admin.save.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => sponsorsApi.useSaveSponsor(), { wrapper });

      result.current.mutate(updatedSponsor as sponsorsApi.SponsorPayload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.sponsors.admin.save.$post).toHaveBeenCalledWith({
        json: updatedSponsor,
      });
    });

    it("should invalidate sponsors caches on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true, id: "123" };
      mockClient.sponsors.admin.save.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => sponsorsApi.useSaveSponsor(), { wrapper: customWrapper });

      result.current.mutate({ name: "Test", tier: "Bronze" } as sponsorsApi.SponsorPayload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["sponsors"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin_sponsors"] });
    });

    it("should handle save errors", async () => {
      const mockError = new Error("Failed to save sponsor");
      mockClient.sponsors.admin.save.$post.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => sponsorsApi.useSaveSponsor(), { wrapper });

      result.current.mutate({ name: "Test", tier: "Bronze" } as sponsorsApi.SponsorPayload);

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useDeleteSponsor", () => {
    it("should delete sponsor successfully", async () => {
      const mockResponse = { success: true };
      mockClient.sponsors.admin[":id"].$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => sponsorsApi.useDeleteSponsor(), { wrapper });

      result.current.mutate("sponsor-123");

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.sponsors.admin[":id"].$delete).toHaveBeenCalledWith({
        param: { id: "sponsor-123" },
      });
    });

    it("should invalidate sponsors caches on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true };
      mockClient.sponsors.admin[":id"].$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => sponsorsApi.useDeleteSponsor(), { wrapper: customWrapper });

      result.current.mutate("sponsor-123");

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["sponsors"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin_sponsors"] });
    });

    it("should handle delete errors", async () => {
      const mockError = new Error("Failed to delete sponsor");
      mockClient.sponsors.admin[":id"].$delete.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => sponsorsApi.useDeleteSponsor(), { wrapper });

      result.current.mutate("sponsor-123");

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useGetAdminTokens", () => {
    it("should fetch admin tokens successfully", async () => {
      const mockTokens: sponsorsApi.SponsorToken[] = [
        { sponsor_id: "sponsor-1", token: "token-abc", created_at: "2024-01-01", last_used: null },
        { sponsor_id: "sponsor-2", token: "token-xyz", created_at: "2024-01-02", last_used: null },
      ];
      const mockResponse: SponsorTokensResponse = { tokens: mockTokens };
      mockClient.sponsors.admin.tokens.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => sponsorsApi.useGetAdminTokens(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch tokens");
      mockClient.sponsors.admin.tokens.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => sponsorsApi.useGetAdminTokens(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useGenerateSponsorToken", () => {
    it("should generate sponsor token successfully", async () => {
      const mockResponse = { success: true, token: "new-generated-token-xyz" };
      mockClient.sponsors.admin.tokens.generate.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => sponsorsApi.useGenerateSponsorToken(), { wrapper });

      result.current.mutate({ sponsor_id: "sponsor-123" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.sponsors.admin.tokens.generate.$post).toHaveBeenCalledWith({
        json: { sponsor_id: "sponsor-123" },
      });
      expect(result.current.data?.token).toBe("new-generated-token-xyz");
    });

    it("should invalidate tokens cache on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true };
      mockClient.sponsors.admin.tokens.generate.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => sponsorsApi.useGenerateSponsorToken(), {
        wrapper: customWrapper,
      });

      result.current.mutate({ sponsor_id: "sponsor-123" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["sponsor_tokens"] });
    });

    it("should handle generate errors", async () => {
      const mockError = new Error("Failed to generate token");
      mockClient.sponsors.admin.tokens.generate.$post.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => sponsorsApi.useGenerateSponsorToken(), { wrapper });

      result.current.mutate({ sponsor_id: "sponsor-123" });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });
});
