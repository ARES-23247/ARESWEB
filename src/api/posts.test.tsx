import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as honoClient from "./honoClient";
import * as postsApi from "./posts";

// Mock the honoClient module
vi.mock("./honoClient", () => ({
  client: {
    posts: {
      $get: vi.fn(),
      ":slug": {
        $get: vi.fn(),
      },
      admin: {
        list: {
          $get: vi.fn(),
        },
        ":slug": {
          $get: vi.fn(),
          $post: vi.fn(),
          $delete: vi.fn(),
          undelete: {
            $post: vi.fn(),
          },
          purge: {
            $delete: vi.fn(),
          },
          approve: {
            $post: vi.fn(),
          },
          reject: {
            $post: vi.fn(),
          },
          history: {
            $get: vi.fn(),
          },
          repush: {
            $post: vi.fn(),
          },
        },
        save: {
          $post: vi.fn(),
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

describe("Posts API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useGetPosts", () => {
    it("should fetch public posts successfully", async () => {
      const mockPosts = [
        { id: "1", slug: "post-1", title: "Post 1", published: true },
        { id: "2", slug: "post-2", title: "Post 2", published: true },
      ];
      const mockResponse = { posts: mockPosts };
      mockClient.posts.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => postsApi.useGetPosts(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });

    it("should pass query parameters", async () => {
      const mockResponse = { posts: [] };
      mockClient.posts.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => postsApi.useGetPosts({ q: "test", limit: 10 }), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.posts.$get).toHaveBeenCalledWith({ query: { q: "test", limit: 10 } });
    });
  });

  describe("useGetPost", () => {
    it("should fetch single post successfully", async () => {
      const mockPost = { id: "123", slug: "test-post", title: "Test Post", content: "Content" };
      const mockResponse = {
        post: mockPost,
        is_editor: false,
        author: { name: "Author", email: "author@test.com" },
      };
      mockClient.posts[":slug"].$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => postsApi.useGetPost("test-post"), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.posts[":slug"].$get).toHaveBeenCalledWith({ param: { slug: "test-post" } });
    });

    it("should be disabled when slug is empty", async () => {
      const { result } = renderHook(() => postsApi.useGetPost(""), { wrapper });
      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  describe("useGetAdminPosts", () => {
    it("should fetch admin posts successfully", async () => {
      const mockPosts = [
        { id: "1", slug: "admin-post-1", title: "Admin Post 1" },
        { id: "2", slug: "admin-post-2", title: "Admin Post 2" },
      ];
      const mockResponse = { posts: mockPosts };
      mockClient.posts.admin.list.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => postsApi.useGetAdminPosts(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });
  });

  describe("useGetAdminPost", () => {
    it("should fetch admin post detail successfully", async () => {
      const mockPost = { id: "123", slug: "test-post", title: "Test Post", content: "Content" };
      const mockResponse = { post: mockPost };
      mockClient.posts.admin[":slug"].$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => postsApi.useGetAdminPost("test-post"), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });
  });

  describe("useSavePost", () => {
    it("should save new post successfully", async () => {
      const mockResponse = { success: true, slug: "new-post-slug" };
      const postData = {
        title: "New Post",
        content: "Post content",
        published: false,
      };
      mockClient.posts.admin.save.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => postsApi.useSavePost(), { wrapper });

      result.current.mutate(postData as never as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.posts.admin.save.$post).toHaveBeenCalledWith({
        json: postData,
      });
    });

    it("should handle save with warning", async () => {
      const mockResponse = { success: true, slug: "post-slug", warning: "Slug already exists" };
      mockClient.posts.admin.save.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => postsApi.useSavePost(), { wrapper });

      result.current.mutate({ title: "Test", content: "Content" } as never as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.warning).toBe("Slug already exists");
    });
  });

  describe("useUpdatePost", () => {
    it("should update existing post successfully", async () => {
      const mockResponse = { success: true, slug: "updated-post-slug" };
      const postData = { title: "Updated Title", content: "Updated content" };
      mockClient.posts.admin[":slug"].$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => postsApi.useUpdatePost(), { wrapper });

      result.current.mutate({ slug: "test-post", body: postData as never } as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.posts.admin[":slug"].$post).toHaveBeenCalledWith({
        param: { slug: "test-post" },
        json: postData,
      });
    });
  });

  describe("useDeletePost", () => {
    it("should soft-delete post successfully", async () => {
      const mockResponse = { success: true };
      mockClient.posts.admin[":slug"].$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => postsApi.useDeletePost(), { wrapper });

      result.current.mutate("test-post" as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.posts.admin[":slug"].$delete).toHaveBeenCalledWith({
        param: { slug: "test-post" },
      });
    });
  });

  describe("useUndeletePost", () => {
    it("should restore deleted post successfully", async () => {
      const mockResponse = { success: true };
      mockClient.posts.admin[":slug"].undelete.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => postsApi.useUndeletePost(), { wrapper });

      result.current.mutate("test-post" as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.posts.admin[":slug"].undelete.$post).toHaveBeenCalledWith({
        param: { slug: "test-post" },
      });
    });
  });

  describe("usePurgePost", () => {
    it("should permanently purge post successfully", async () => {
      const mockResponse = { success: true };
      mockClient.posts.admin[":slug"].purge.$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => postsApi.usePurgePost(), { wrapper });

      result.current.mutate("test-post" as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.posts.admin[":slug"].purge.$delete).toHaveBeenCalledWith({
        param: { slug: "test-post" },
      });
    });
  });

  describe("useApprovePost", () => {
    it("should approve post successfully", async () => {
      const mockResponse = { success: true, warnings: [] };
      mockClient.posts.admin[":slug"].approve.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => postsApi.useApprovePost(), { wrapper });

      result.current.mutate("test-post" as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.posts.admin[":slug"].approve.$post).toHaveBeenCalledWith({
        param: { slug: "test-post" },
      });
    });

    it("should handle approval with warnings", async () => {
      const mockResponse = { success: true, warnings: ["Missing alt text"] };
      mockClient.posts.admin[":slug"].approve.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => postsApi.useApprovePost(), { wrapper });

      result.current.mutate("test-post" as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.warnings).toEqual(["Missing alt text"]);
    });
  });

  describe("useRejectPost", () => {
    it("should reject post successfully", async () => {
      const mockResponse = { success: true };
      mockClient.posts.admin[":slug"].reject.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => postsApi.useRejectPost(), { wrapper });

      result.current.mutate({ slug: "test-post", reason: "Inappropriate content" } as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.posts.admin[":slug"].reject.$post).toHaveBeenCalledWith({
        param: { slug: "test-post" },
        json: { reason: "Inappropriate content" },
      });
    });
  });

  describe("useGetPostHistory", () => {
    it("should fetch post history successfully", async () => {
      const mockHistory = [
        { id: "1", version: 1, created_at: "2024-01-01", changes: "Initial version" },
        { id: "2", version: 2, created_at: "2024-01-02", changes: "Updated title" },
      ];
      const mockResponse = { history: mockHistory };
      mockClient.posts.admin[":slug"].history.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => postsApi.useGetPostHistory("test-post"), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });
  });

  describe("useRepushPost", () => {
    it("should repush post to social media successfully", async () => {
      const mockResponse = { success: true };
      mockClient.posts.admin[":slug"].repush.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => postsApi.useRepushPost(), { wrapper });

      result.current.mutate({ slug: "test-post", socials: ["twitter", "instagram"] } as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.posts.admin[":slug"].repush.$post).toHaveBeenCalledWith({
        param: { slug: "test-post" },
        json: { socials: ["twitter", "instagram"] },
      });
    });
  });
});
