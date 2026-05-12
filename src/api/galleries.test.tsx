import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as honoClient from "./honoClient";
import * as galleriesApi from "./galleries";

// Mock the honoClient module
vi.mock("./honoClient", () => ({
  client: {
    galleries: {
      $get: vi.fn(),
      ":id": {
        $get: vi.fn(),
        media: {
          $get: vi.fn(),
        },
      },
      admin: {
        $post: vi.fn(),
        ":id": {
          $patch: vi.fn(),
          $delete: vi.fn(),
        },
      },
    },
  },
  unwrapResponse: vi.fn(),
  withMutationCallbacks: vi.fn((_queryClient, options, callbacks) => {
    const originalOnSuccess = options?.onSuccess;
    return {
      ...options,
      onSuccess: async (...args: unknown[]) => {
        await callbacks.onSuccess?.(_queryClient, ...(args as [unknown, unknown]));
        await originalOnSuccess?.(...(args as [unknown, unknown, unknown]));
      },
    };
  }),
  toastApiError: vi.fn(),
}));

const mockClient = honoClient.client as unknown as {
  galleries: {
    $get: ReturnType<typeof vi.fn>;
    ":id": {
      $get: ReturnType<typeof vi.fn>;
      media: {
        $get: ReturnType<typeof vi.fn>;
      };
    };
    admin: {
      $post: ReturnType<typeof vi.fn>;
      ":id": {
        $patch: ReturnType<typeof vi.fn>;
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

describe("Galleries API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useGetGalleries", () => {
    it("should fetch galleries successfully", async () => {
      const mockGalleries = [
        { id: "gal_1", title: "Championship Photos", description: "Best moments" },
        { id: "gal_2", title: "Build Season", description: null },
      ];
      const mockResponse = { galleries: mockGalleries };
      mockClient.galleries.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => galleriesApi.useGetGalleries(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch galleries");
      mockClient.galleries.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => galleriesApi.useGetGalleries(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });
  });

  describe("useGetGallery", () => {
    it("should fetch a single gallery by id", async () => {
      const mockGallery = { id: "gal_1", title: "Championship Photos", description: "Best moments" };
      const mockResponse = { gallery: mockGallery };
      mockClient.galleries[":id"].$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => galleriesApi.useGetGallery("gal_1"), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.galleries[":id"].$get).toHaveBeenCalledWith({ param: { id: "gal_1" } });
    });

    it("should not fetch when id is empty", async () => {
      const { result } = renderHook(() => galleriesApi.useGetGallery(""), { wrapper });

      // Should remain idle (disabled) since id is falsy
      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  describe("useGetGalleryMedia", () => {
    it("should fetch media for a gallery", async () => {
      const mockMedia = [
        { key: "photo1.jpg", size: 1024, uploaded: "2024-01-01T00:00:00Z" },
        { key: "photo2.jpg", size: 2048, uploaded: "2024-01-02T00:00:00Z" },
      ];
      const mockResponse = { media: mockMedia };
      mockClient.galleries[":id"].media.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => galleriesApi.useGetGalleryMedia("gal_1"), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });
  });

  describe("useCreateGallery", () => {
    it("should create a gallery successfully", async () => {
      const mockResponse = { gallery: { id: "gal_new", title: "New Gallery" } };
      const payload: galleriesApi.CreateGalleryPayload = { title: "New Gallery", description: "A test gallery" };
      mockClient.galleries.admin.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => galleriesApi.useCreateGallery(), { wrapper });

      result.current.mutate(payload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.galleries.admin.$post).toHaveBeenCalledWith({ json: payload });
      expect(result.current.data).toEqual(mockResponse);
    });

    it("should handle create errors", async () => {
      const mockError = new Error("Failed to create gallery");
      mockClient.galleries.admin.$post.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => galleriesApi.useCreateGallery(), { wrapper });

      result.current.mutate({ title: "Test" });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useUpdateGallery", () => {
    it("should update a gallery successfully", async () => {
      const mockResponse = { gallery: { id: "gal_1", title: "Updated Title" } };
      mockClient.galleries.admin[":id"].$patch.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => galleriesApi.useUpdateGallery(), { wrapper });

      result.current.mutate({ id: "gal_1", title: "Updated Title" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.galleries.admin[":id"].$patch).toHaveBeenCalledWith({
        param: { id: "gal_1" },
        json: { title: "Updated Title" },
      });
    });

    it("should handle update errors", async () => {
      const mockError = new Error("Failed to update gallery");
      mockClient.galleries.admin[":id"].$patch.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => galleriesApi.useUpdateGallery(), { wrapper });

      result.current.mutate({ id: "gal_1", title: "Updated" });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useDeleteGallery", () => {
    it("should delete a gallery successfully", async () => {
      const mockResponse = { success: true };
      mockClient.galleries.admin[":id"].$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => galleriesApi.useDeleteGallery(), { wrapper });

      result.current.mutate("gal_1");

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.galleries.admin[":id"].$delete).toHaveBeenCalledWith({
        param: { id: "gal_1" },
      });
    });

    it("should invalidate galleries cache on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true };
      mockClient.galleries.admin[":id"].$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => galleriesApi.useDeleteGallery(), { wrapper: customWrapper });

      result.current.mutate("gal_1");

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["galleries"] });
    });

    it("should handle delete errors", async () => {
      const mockError = new Error("Failed to delete gallery");
      mockClient.galleries.admin[":id"].$delete.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => galleriesApi.useDeleteGallery(), { wrapper });

      result.current.mutate("gal_1");

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });
  });
});
