import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as honoClient from "./honoClient";
import * as awardsApi from "./awards";

// Mock the honoClient module
vi.mock("./honoClient", () => ({
  client: {
    awards: {
      $get: vi.fn(),
      admin: {
        save: {
          $post: vi.fn(),
        },
        ":id": {
          $delete: vi.fn(),
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
  awards: {
    $get: ReturnType<typeof vi.fn>;
    admin: {
      save: {
        $post: ReturnType<typeof vi.fn>;
      };
      ":id": {
        $delete: ReturnType<typeof vi.fn>;
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

describe("Awards API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useGetAwards", () => {
    it("should fetch awards successfully", async () => {
      const mockAwards = [
        { id: "1", title: "Winner Award", year: 2024, eventName: "Championship" },
        { id: "2", title: "Finalist", year: 2024, eventName: "Qualifier" },
      ];
      const mockResponse = { awards: mockAwards };
      mockClient.awards.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => awardsApi.useGetAwards(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });

    it("should pass query parameters", async () => {
      const mockResponse = { awards: [] };
      mockClient.awards.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => awardsApi.useGetAwards({ limit: 10, offset: 20 }), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.awards.$get).toHaveBeenCalledWith({ query: { limit: 10, offset: 20 } });
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch awards");
      mockClient.awards.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => awardsApi.useGetAwards(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });
  });

  describe("useSaveAward", () => {
    it("should create new award successfully", async () => {
      const mockResponse = { success: true, id: "new-award-123" };
      const newAward = {
        title: "Champion Award",
        year: 2024,
        eventName: "State Championship",
        description: "First place finish",
      };
      mockClient.awards.admin.save.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => awardsApi.useSaveAward(), { wrapper });

      result.current.mutate(newAward as awardsApi.AwardPayload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.awards.admin.save.$post).toHaveBeenCalledWith({
        json: newAward,
      });
      expect(result.current.data?.id).toBe("new-award-123");
    });

    it("should update existing award successfully", async () => {
      const mockResponse = { success: true, id: "existing-award-456" };
      const updatedAward = {
        id: "existing-award-456",
        title: "Updated Title",
        year: 2024,
        description: "Updated description",
      };
      mockClient.awards.admin.save.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => awardsApi.useSaveAward(), { wrapper });

      result.current.mutate(updatedAward as awardsApi.AwardPayload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.awards.admin.save.$post).toHaveBeenCalledWith({
        json: updatedAward,
      });
    });

    it("should invalidate awards cache on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true };
      mockClient.awards.admin.save.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => awardsApi.useSaveAward(), { wrapper: customWrapper });

      result.current.mutate({ title: "Test Award", year: 2024 } as awardsApi.AwardPayload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["awards"] });
    });

    it("should handle save errors", async () => {
      const mockError = new Error("Failed to save award");
      mockClient.awards.admin.save.$post.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => awardsApi.useSaveAward(), { wrapper });

      result.current.mutate({ title: "Test", year: 2024 } as awardsApi.AwardPayload);

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useDeleteAward", () => {
    it("should soft-delete award successfully", async () => {
      const mockResponse = { success: true };
      mockClient.awards.admin[":id"].$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => awardsApi.useDeleteAward(), { wrapper });

      result.current.mutate("award-123");

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.awards.admin[":id"].$delete).toHaveBeenCalledWith({
        param: { id: "award-123" },
      });
    });

    it("should invalidate awards cache on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true };
      mockClient.awards.admin[":id"].$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => awardsApi.useDeleteAward(), { wrapper: customWrapper });

      result.current.mutate("award-123");

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["awards"] });
    });

    it("should handle delete errors", async () => {
      const mockError = new Error("Failed to delete award");
      mockClient.awards.admin[":id"].$delete.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => awardsApi.useDeleteAward(), { wrapper });

      result.current.mutate("award-123");

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });
  });
});

