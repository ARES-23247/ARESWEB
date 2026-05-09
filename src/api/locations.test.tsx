import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as honoClient from "./honoClient";
import * as locationsApi from "./locations";

// Mock the honoClient module
vi.mock("./honoClient", () => ({
  client: {
    locations: {
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
  locations: {
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

describe("Locations API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useGetLocations", () => {
    it("should fetch public locations successfully", async () => {
      const mockLocations = [
        {
          id: "1",
          name: "High School Gym",
          address: "123 Main St",
          city: "Springfield",
          state: "IL",
          zip: "62701",
          latitude: 39.7817,
          longitude: -89.6501,
        },
        {
          id: "2",
          name: "Community Center",
          address: "456 Oak Ave",
          city: "Springfield",
          state: "IL",
          zip: "62702",
          latitude: 39.7825,
          longitude: -89.6510,
        },
      ];
      const mockResponse = { locations: mockLocations };
      mockClient.locations.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => locationsApi.useGetLocations(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.locations.$get).toHaveBeenCalled();
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch locations");
      mockClient.locations.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => locationsApi.useGetLocations(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should handle empty locations list", async () => {
      const mockResponse = { locations: [] };
      mockClient.locations.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => locationsApi.useGetLocations(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.locations).toEqual([]);
    });
  });

  describe("useGetAdminLocations", () => {
    it("should fetch admin locations successfully (including deleted)", async () => {
      const mockLocations = [
        {
          id: "1",
          name: "High School Gym",
          address: "123 Main St",
          deleted: false,
        },
        {
          id: "2",
          name: "Old Location",
          address: "789 Pine St",
          deleted: true,
        },
      ];
      const mockResponse = { locations: mockLocations };
      mockClient.locations.admin.list.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => locationsApi.useGetAdminLocations(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.locations.admin.list.$get).toHaveBeenCalled();
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch admin locations");
      mockClient.locations.admin.list.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => locationsApi.useGetAdminLocations(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });
  });

  describe("useSaveLocation", () => {
    it("should create new location successfully", async () => {
      const mockResponse = { success: true, id: "123" };
      mockClient.locations.admin.save.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => locationsApi.useSaveLocation(), { wrapper });

      const locationData = {
        name: "New Location",
        address: "123 New St",
        city: "Springfield",
        state: "IL",
        zip: "62701",
        latitude: 39.78,
        longitude: -89.65,
        is_deleted: 0,
      };

      result.current.mutate(locationData as locationsApi.Location);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.locations.admin.save.$post).toHaveBeenCalledWith({
        json: locationData,
      });
    });

    it("should update existing location successfully", async () => {
      const mockResponse = { success: true, id: "123" };
      mockClient.locations.admin.save.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => locationsApi.useSaveLocation(), { wrapper });

      const locationData = {
        id: "123",
        name: "Updated Location",
        address: "456 Updated St",
        city: "Springfield",
        state: "IL",
        zip: "62701",
        is_deleted: 0,
      };

      result.current.mutate(locationData as locationsApi.Location);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.locations.admin.save.$post).toHaveBeenCalledWith({
        json: locationData,
      });
    });

    it("should handle save errors", async () => {
      const mockError = new Error("Failed to save location");
      mockClient.locations.admin.save.$post.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => locationsApi.useSaveLocation(), { wrapper });

      result.current.mutate({ name: "New Location" } as locationsApi.Location);

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should invalidate locations queries on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true, id: "123" };
      mockClient.locations.admin.save.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => locationsApi.useSaveLocation(), { wrapper: customWrapper });

      result.current.mutate({ name: "New Location" } as locationsApi.Location);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["locations"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin_locations"] });
    });
  });

  describe("useDeleteLocation", () => {
    it("should soft delete location successfully", async () => {
      const mockResponse = { success: true };
      mockClient.locations.admin[":id"].$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => locationsApi.useDeleteLocation(), { wrapper });

      result.current.mutate("123");

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.locations.admin[":id"].$delete).toHaveBeenCalledWith({
        param: { id: "123" },
      });
    });

    it("should handle delete errors", async () => {
      const mockError = new Error("Failed to delete location");
      mockClient.locations.admin[":id"].$delete.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => locationsApi.useDeleteLocation(), { wrapper });

      result.current.mutate("123");

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should invalidate locations queries on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true };
      mockClient.locations.admin[":id"].$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => locationsApi.useDeleteLocation(), { wrapper: customWrapper });

      result.current.mutate("123");

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["locations"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin_locations"] });
    });
  });
});
