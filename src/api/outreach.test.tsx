import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as honoClient from "./honoClient";
import * as outreachApi from "./outreach";

// Mock the honoClient module
vi.mock("./honoClient", () => ({
  client: {
    outreach: {
      $get: vi.fn(),
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
  outreach: {
    $get: ReturnType<typeof vi.fn>;
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

describe("Outreach API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useGetPublicOutreach", () => {
    it("should fetch public outreach logs successfully", async () => {
      const mockLogs = [
        {
          id: "1",
          title: "Demo Day",
          description: "Robot demo at local school",
          date: "2024-01-15",
          hours: 5,
          attendees: 50,
        },
        {
          id: "2",
          title: "Community Fair",
          description: "STEM fair booth",
          date: "2024-02-20",
          hours: 8,
          attendees: 100,
        },
      ];
      const mockResponse = { logs: mockLogs };
      mockClient.outreach.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => outreachApi.useGetPublicOutreach(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.outreach.$get).toHaveBeenCalled();
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch outreach logs");
      mockClient.outreach.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => outreachApi.useGetPublicOutreach(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should handle empty outreach logs", async () => {
      const mockResponse = { logs: [] };
      mockClient.outreach.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => outreachApi.useGetPublicOutreach(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.logs).toEqual([]);
    });
  });

  describe("useGetAdminOutreach", () => {
    it("should fetch admin outreach logs successfully", async () => {
      const mockLogs = [
        {
          id: "1",
          title: "Demo Day",
          description: "Robot demo at local school",
          date: "2024-01-15",
          hours: 5,
          attendees: 50,
          deleted: false,
        },
      ];
      const mockResponse = { logs: mockLogs };
      mockClient.outreach.admin.list.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => outreachApi.useGetAdminOutreach(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.outreach.admin.list.$get).toHaveBeenCalled();
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch admin outreach logs");
      mockClient.outreach.admin.list.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => outreachApi.useGetAdminOutreach(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });
  });

  describe("useSaveOutreach", () => {
    it("should save new outreach log successfully", async () => {
      const mockResponse = { success: true, id: "123" };
      mockClient.outreach.admin.save.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => outreachApi.useSaveOutreach(), { wrapper });

      const outreachData = {
        title: "New Outreach Event",
        description: "Description",
        date: "2024-01-15",
        hours: 5,
        attendees: 50,
      };

      result.current.mutate(outreachData as outreachApi.OutreachPayload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.outreach.admin.save.$post).toHaveBeenCalledWith({
        json: outreachData,
      });
    });

    it("should update existing outreach log successfully", async () => {
      const mockResponse = { success: true, id: "123" };
      mockClient.outreach.admin.save.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => outreachApi.useSaveOutreach(), { wrapper });

      const outreachData = {
        id: "123",
        title: "Updated Outreach Event",
        description: "Updated description",
        date: "2024-01-15",
        hours: 6,
        attendees: 60,
      };

      result.current.mutate(outreachData as outreachApi.OutreachPayload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.outreach.admin.save.$post).toHaveBeenCalledWith({
        json: outreachData,
      });
    });

    it("should handle save errors", async () => {
      const mockError = new Error("Failed to save outreach log");
      mockClient.outreach.admin.save.$post.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => outreachApi.useSaveOutreach(), { wrapper });

      result.current.mutate({ title: "New Event" } as outreachApi.OutreachPayload);

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should invalidate outreach queries on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true, id: "123" };
      mockClient.outreach.admin.save.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => outreachApi.useSaveOutreach(), { wrapper: customWrapper });

      result.current.mutate({ title: "New Event" } as outreachApi.OutreachPayload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin-outreach"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["public-outreach"] });
    });
  });

  describe("useDeleteOutreach", () => {
    it("should delete outreach log successfully", async () => {
      const mockResponse = { success: true };
      mockClient.outreach.admin[":id"].$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => outreachApi.useDeleteOutreach(), { wrapper });

      result.current.mutate("123");

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.outreach.admin[":id"].$delete).toHaveBeenCalledWith({
        param: { id: "123" },
      });
    });

    it("should handle delete errors", async () => {
      const mockError = new Error("Failed to delete outreach log");
      mockClient.outreach.admin[":id"].$delete.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => outreachApi.useDeleteOutreach(), { wrapper });

      result.current.mutate("123");

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should invalidate outreach queries on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true };
      mockClient.outreach.admin[":id"].$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => outreachApi.useDeleteOutreach(), { wrapper: customWrapper });

      result.current.mutate("123");

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin-outreach"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["public-outreach"] });
    });
  });
});
