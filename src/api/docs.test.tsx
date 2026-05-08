import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as honoClient from "./honoClient";
import * as docsApi from "./docs";

// Mock the honoClient module
vi.mock("./honoClient", () => ({
  client: {
    docs: {
      $get: vi.fn(),
      ":slug": {
        $get: vi.fn(),
        feedback: {
          $post: vi.fn(),
        },
      },
      search: {
        $get: vi.fn(),
      },
      admin: {
        list: {
          $get: vi.fn(),
        },
        ":slug": {
          detail: {
            $get: vi.fn(),
          },
          sort: {
            $patch: vi.fn(),
          },
          approve: {
            $post: vi.fn(),
          },
          reject: {
            $post: vi.fn(),
          },
          $delete: vi.fn(),
          undelete: {
            $post: vi.fn(),
          },
          purge: {
            $post: vi.fn(),
          },
          history: {
            $get: vi.fn(),
            ":id": {
              restore: {
                $patch: vi.fn(),
              },
            },
          },
        },
        save: {
          $post: vi.fn(),
        },
        export: {
          $get: vi.fn(),
        },
      },
    },
  },
  unwrapResponse: vi.fn(),
}));

const mockClient = honoClient.client as any;
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

describe("Docs API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useGetAllDocs", () => {
    it("should fetch all docs successfully", async () => {
      const mockDocs = [
        { slug: "doc1", title: "First Doc", category: "Technical", sort_order: 1 },
        { slug: "doc2", title: "Second Doc", category: "Process", sort_order: 2 },
      ];
      const mockResponse = { docs: mockDocs };
      mockClient.docs.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => docsApi.useGetAllDocs(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch docs");
      mockClient.docs.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => docsApi.useGetAllDocs(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useGetDocWithContributors", () => {
    it("should fetch doc with contributors successfully", async () => {
      const mockDoc = {
        slug: "test-doc",
        title: "Test Doc",
        category: "Technical",
        content: "Doc content",
      };
      const mockContributors = [
        { nickname: "Author 1", avatar: "avatar1.png" },
        { nickname: "Author 2", avatar: null },
      ];
      const mockResponse = { doc: mockDoc, contributors: mockContributors };
      mockClient.docs[":slug"].$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => docsApi.useGetDocWithContributors("test-doc"), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });

    it("should be disabled when slug is empty", async () => {
      const { result } = renderHook(() => docsApi.useGetDocWithContributors(""), { wrapper });

      expect(result.current.fetchStatus).toBe("idle");
    });

    it("should be enabled when slug is provided", async () => {
      mockClient.docs[":slug"].$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue({ doc: {}, contributors: [] });

      const { result } = renderHook(() => docsApi.useGetDocWithContributors("test-doc"), { wrapper });

      expect(result.current.fetchStatus).not.toBe("idle");
    });
  });

  describe("useSearchDocs", () => {
    it("should search docs successfully", async () => {
      const mockResults = [
        { slug: "doc1", title: "Result 1", category: "Technical", snippet: "...", description: "desc" },
      ];
      const mockResponse = { results: mockResults };
      mockClient.docs.search.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => docsApi.useSearchDocs("search term"), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.docs.search.$get).toHaveBeenCalledWith({ query: { q: "search term" } });
    });

    it("should be disabled for short queries", async () => {
      const { result } = renderHook(() => docsApi.useSearchDocs("a"), { wrapper });

      expect(result.current.fetchStatus).toBe("idle");
    });

    it("should be enabled for queries of 2+ characters", async () => {
      mockClient.docs.search.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue({ results: [] });

      const { result } = renderHook(() => docsApi.useSearchDocs("ab"), { wrapper });

      expect(result.current.fetchStatus).not.toBe("idle");
    });
  });

  describe("useGetAdminDocs", () => {
    it("should fetch admin docs list successfully", async () => {
      const mockDocs = [
        { slug: "admin-doc1", title: "Admin Doc 1", category: "Internal" },
      ];
      const mockResponse = { docs: mockDocs };
      mockClient.docs.admin.list.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => docsApi.useGetAdminDocs(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });
  });

  describe("useGetAdminDocDetail", () => {
    it("should fetch admin doc detail successfully", async () => {
      const mockDoc = { slug: "detail-doc", title: "Detail Doc", content: "Content" };
      const mockResponse = { doc: mockDoc };
      mockClient.docs.admin[":slug"].detail.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => docsApi.useGetAdminDocDetail("detail-doc"), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });

    it("should be disabled when slug is empty", async () => {
      const { result } = renderHook(() => docsApi.useGetAdminDocDetail(""), { wrapper });

      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  describe("useSaveDoc", () => {
    it("should save new doc successfully", async () => {
      const mockResponse = { success: true, slug: "new-doc-slug" };
      const docData = {
        slug: "new-doc",
        title: "New Doc",
        category: "Technical",
        content: "Content",
      };
      mockClient.docs.admin.save.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => docsApi.useSaveDoc(), { wrapper });

      result.current.mutate(docData as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.docs.admin.save.$post).toHaveBeenCalledWith({ json: docData });
    });

    it("should invalidate docs cache on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true };
      mockClient.docs.admin.save.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => docsApi.useSaveDoc(), { wrapper: customWrapper });

      result.current.mutate({ slug: "test", title: "Test" } as unknown as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["docs"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin-docs"] });
    });
  });

  describe("useUpdateDocSort", () => {
    it("should update doc sort order successfully", async () => {
      const mockResponse = { success: true };
      mockClient.docs.admin[":slug"].sort.$patch.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => docsApi.useUpdateDocSort(), { wrapper });

      result.current.mutate({ slug: "test-doc", sortOrder: 5 } as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.docs.admin[":slug"].sort.$patch).toHaveBeenCalledWith({
        param: { slug: "test-doc" },
        json: { sortOrder: 5 },
      });
    });
  });

  describe("useSubmitDocFeedback", () => {
    it("should submit doc feedback successfully", async () => {
      const mockResponse = { success: true };
      mockClient.docs[":slug"].feedback.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => docsApi.useSubmitDocFeedback(), { wrapper });

      result.current.mutate({
        slug: "test-doc",
        data: { isHelpful: true, turnstileToken: "token123" },
      } as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.docs[":slug"].feedback.$post).toHaveBeenCalledWith({
        param: { slug: "test-doc" },
        json: { isHelpful: true, turnstileToken: "token123" },
      });
    });

    it("should submit feedback with comment", async () => {
      const mockResponse = { success: true };
      mockClient.docs[":slug"].feedback.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => docsApi.useSubmitDocFeedback(), { wrapper });

      result.current.mutate({
        slug: "test-doc",
        data: { isHelpful: false, comment: "Not clear enough", turnstileToken: "token" },
      } as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.docs[":slug"].feedback.$post).toHaveBeenCalledWith({
        param: { slug: "test-doc" },
        json: { isHelpful: false, comment: "Not clear enough", turnstileToken: "token" },
      });
    });
  });

  describe("useGetDocHistory", () => {
    it("should fetch doc history successfully", async () => {
      const mockHistory = [
        { id: 1, slug: "test-doc", title: "Old Title", category: "Technical" },
        { id: 2, slug: "test-doc", title: "New Title", category: "Technical" },
      ];
      const mockResponse = { history: mockHistory };
      mockClient.docs.admin[":slug"].history.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => docsApi.useGetDocHistory("test-doc"), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });
  });

  describe("useRestoreDocHistory", () => {
    it("should restore doc from history successfully", async () => {
      const mockResponse = { success: true };
      mockClient.docs.admin[":slug"].history[":id"].restore.$patch.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => docsApi.useRestoreDocHistory(), { wrapper });

      result.current.mutate({ slug: "test-doc", id: 123 } as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.docs.admin[":slug"].history[":id"].restore.$patch).toHaveBeenCalledWith({
        param: { slug: "test-doc", id: 123 },
      });
    });
  });

  describe("useApproveDoc", () => {
    it("should approve doc successfully", async () => {
      const mockResponse = { success: true };
      mockClient.docs.admin[":slug"].approve.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => docsApi.useApproveDoc(), { wrapper });

      result.current.mutate("test-doc" as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.docs.admin[":slug"].approve.$post).toHaveBeenCalledWith({
        param: { slug: "test-doc" },
      });
    });
  });

  describe("useRejectDoc", () => {
    it("should reject doc successfully", async () => {
      const mockResponse = { success: true };
      mockClient.docs.admin[":slug"].reject.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => docsApi.useRejectDoc(), { wrapper });

      result.current.mutate({ slug: "test-doc", reason: "Inaccurate information" } as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.docs.admin[":slug"].reject.$post).toHaveBeenCalledWith({
        param: { slug: "test-doc" },
        json: { reason: "Inaccurate information" },
      });
    });
  });

  describe("useDeleteDoc", () => {
    it("should soft-delete doc successfully", async () => {
      const mockResponse = { success: true };
      mockClient.docs.admin[":slug"].$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => docsApi.useDeleteDoc(), { wrapper });

      result.current.mutate("test-doc" as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.docs.admin[":slug"].$delete).toHaveBeenCalledWith({
        param: { slug: "test-doc" },
      });
    });
  });

  describe("useUndeleteDoc", () => {
    it("should restore deleted doc successfully", async () => {
      const mockResponse = { success: true };
      mockClient.docs.admin[":slug"].undelete.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => docsApi.useUndeleteDoc(), { wrapper });

      result.current.mutate("test-doc" as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.docs.admin[":slug"].undelete.$post).toHaveBeenCalledWith({
        param: { slug: "test-doc" },
      });
    });
  });

  describe("usePurgeDoc", () => {
    it("should permanently purge doc successfully", async () => {
      const mockResponse = { success: true };
      mockClient.docs.admin[":slug"].purge.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => docsApi.usePurgeDoc(), { wrapper });

      result.current.mutate("test-doc" as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.docs.admin[":slug"].purge.$post).toHaveBeenCalledWith({
        param: { slug: "test-doc" },
      });
    });
  });

  describe("useExportAllDocs", () => {
    it("should export all docs successfully", async () => {
      const mockDocs = [{ slug: "doc1", title: "Doc 1", content: "Content 1" }];
      const mockResponse = { docs: mockDocs };
      mockClient.docs.admin.export.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => docsApi.useExportAllDocs(), { wrapper });

      result.current.mutate();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });
  });
});
