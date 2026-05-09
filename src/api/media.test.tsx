import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as honoClient from "./honoClient";
import * as mediaApi from "./media";

// Define types for the mocked client
interface MockMediaClient {
  $get: ReturnType<typeof vi.fn>;
  admin: {
    $get: ReturnType<typeof vi.fn>;
    upload: {
      $post: ReturnType<typeof vi.fn>;
    };
    move: {
      ":key": {
        $put: ReturnType<typeof vi.fn>;
      };
    };
    ":key": {
      $delete: ReturnType<typeof vi.fn>;
    };
    syndicate: {
      $post: ReturnType<typeof vi.fn>;
    };
  };
}

interface MockHonoClient {
  media: MockMediaClient;
}

// Mock the honoClient module
vi.mock("./honoClient", () => ({
  client: {
    media: {
      $get: vi.fn(),
      admin: {
        $get: vi.fn(),
        upload: {
          $post: vi.fn(),
        },
        move: {
          ":key": {
            $put: vi.fn(),
          },
        },
        ":key": {
          $delete: vi.fn(),
        },
        syndicate: {
          $post: vi.fn(),
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
  wrapOnSuccess: vi.fn((<TData, _TError, TVariables>(
    _options: { onSuccess?: (data: TData, variables: TVariables) => void } | undefined,
    internal: (data: TData, variables: TVariables) => void
  ) => ({ onSuccess: internal })) as typeof import("./honoClient").wrapOnSuccess),
}));

const mockClient = honoClient.client as unknown as MockHonoClient;
const mockUnwrapResponse = honoClient.unwrapResponse as ReturnType<typeof vi.fn>;

// Type aliases for mutation parameters
// type UploadMediaParams = Parameters<ReturnType<typeof mediaApi.useUploadMedia>['mutate']>[0];
type MoveMediaParams = Parameters<ReturnType<typeof mediaApi.useMoveMedia>['mutate']>[0];
type DeleteMediaParams = Parameters<ReturnType<typeof mediaApi.useDeleteMedia>['mutate']>[0];
type SyndicateMediaParams = Parameters<ReturnType<typeof mediaApi.useSyndicateMedia>['mutate']>[0];

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

describe("Media API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useGetMedia", () => {
    it("should fetch public gallery media successfully", async () => {
      const mockMedia = [
        { id: "1", key: "photo1.jpg", url: "https://r2.dev/photo1.jpg", altText: "Team photo" },
        { id: "2", key: "photo2.jpg", url: "https://r2.dev/photo2.jpg", altText: "Robot closeup" },
      ];
      const mockResponse = { media: mockMedia };
      mockClient.media.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => mediaApi.useGetMedia(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch media");
      mockClient.media.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => mediaApi.useGetMedia(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useGetAdminMedia", () => {
    it("should fetch admin media successfully", async () => {
      const mockMedia = [
        { id: "1", key: "admin/photo1.jpg", url: "https://r2.dev/photo1.jpg" },
        { id: "2", key: "admin/photo2.jpg", url: "https://r2.dev/photo2.jpg" },
      ];
      const mockResponse = { media: mockMedia };
      mockClient.media.admin.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => mediaApi.useGetAdminMedia(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch admin media");
      mockClient.media.admin.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => mediaApi.useGetAdminMedia(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useUploadMedia", () => {
    it("should upload media file successfully", async () => {
      const mockResponse = { success: true, key: "uploads/photo.jpg", url: "https://r2.dev/photo.jpg", altText: "Team photo" };
      const formData = new FormData();
      formData.append("file", new File([""], "photo.jpg"));

      mockClient.media.admin.upload.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => mediaApi.useUploadMedia(), { wrapper });

      result.current.mutate(new mediaApi.UploadFormData(formData));

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });

    it("should invalidate media caches on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true, key: "test.jpg", url: "https://r2.dev/test.jpg" };
      mockClient.media.admin.upload.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => mediaApi.useUploadMedia(), { wrapper: customWrapper });

      const formData = new FormData();
      result.current.mutate(new mediaApi.UploadFormData(formData));

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin-media"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["public-media"] });
    });

    it("should handle upload errors", async () => {
      const mockError = new Error("Failed to upload");
      mockClient.media.admin.upload.$post.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => mediaApi.useUploadMedia(), { wrapper });

      const formData = new FormData();
      result.current.mutate(new mediaApi.UploadFormData(formData));

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useMoveMedia", () => {
    it("should move media to folder successfully", async () => {
      const mockResponse = { success: true, newKey: "2024/photo.jpg" };
      mockClient.media.admin.move[":key"].$put.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => mediaApi.useMoveMedia(), { wrapper });

      result.current.mutate({ key: "photo.jpg", folder: "2024" } as MoveMediaParams);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.media.admin.move[":key"].$put).toHaveBeenCalledWith({
        param: { key: "photo.jpg" },
        json: { folder: "2024" },
      });
      expect(result.current.data?.newKey).toBe("2024/photo.jpg");
    });

    it("should invalidate media caches on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true };
      mockClient.media.admin.move[":key"].$put.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => mediaApi.useMoveMedia(), { wrapper: customWrapper });

      result.current.mutate({ key: "test.jpg", folder: "archive" } as MoveMediaParams);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin-media"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["public-media"] });
    });
  });

  describe("useDeleteMedia", () => {
    it("should delete media successfully", async () => {
      const mockResponse = { success: true };
      mockClient.media.admin[":key"].$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => mediaApi.useDeleteMedia(), { wrapper });

      result.current.mutate("photo.jpg" as DeleteMediaParams);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.media.admin[":key"].$delete).toHaveBeenCalledWith({
        param: { key: "photo.jpg" },
      });
    });

    it("should invalidate media caches on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true };
      mockClient.media.admin[":key"].$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => mediaApi.useDeleteMedia(), { wrapper: customWrapper });

      result.current.mutate("test.jpg" as DeleteMediaParams);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin-media"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["public-media"] });
    });

    it("should handle delete errors", async () => {
      const mockError = new Error("Failed to delete media");
      mockClient.media.admin[":key"].$delete.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => mediaApi.useDeleteMedia(), { wrapper });

      result.current.mutate("photo.jpg" as DeleteMediaParams);

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useSyndicateMedia", () => {
    it("should syndicate media to social channels successfully", async () => {
      const mockResponse = { success: true, message: "Posted to Instagram and Twitter" };
      mockClient.media.admin.syndicate.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => mediaApi.useSyndicateMedia(), { wrapper });

      result.current.mutate({ key: "photo.jpg", caption: "Championship winner!" } as SyndicateMediaParams);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.media.admin.syndicate.$post).toHaveBeenCalledWith({
        json: { key: "photo.jpg", caption: "Championship winner!" },
      });
      expect(result.current.data?.message).toBe("Posted to Instagram and Twitter");
    });

    it("should handle syndication without caption", async () => {
      const mockResponse = { success: true, message: "Posted" };
      mockClient.media.admin.syndicate.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => mediaApi.useSyndicateMedia(), { wrapper });

      result.current.mutate({ key: "photo.jpg" } as SyndicateMediaParams);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.media.admin.syndicate.$post).toHaveBeenCalledWith({
        json: { key: "photo.jpg" },
      });
    });

    it("should handle syndication errors", async () => {
      const mockError = new Error("Failed to syndicate");
      mockClient.media.admin.syndicate.$post.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => mediaApi.useSyndicateMedia(), { wrapper });

      result.current.mutate({ key: "photo.jpg" } as SyndicateMediaParams);

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });
});
