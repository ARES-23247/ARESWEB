import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as honoClient from "./honoClient";
import * as tasksApi from "./tasks";

// Mock the honoClient module
vi.mock("./honoClient", () => ({
  client: {
    tasks: {
      $get: vi.fn(),
      $post: vi.fn(),
      ":id": {
        $patch: vi.fn(),
        $delete: vi.fn(),
      },
      reorder: {
        $patch: vi.fn(),
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
  tasks: {
    $get: ReturnType<typeof vi.fn>;
    $post: ReturnType<typeof vi.fn>;
    ":id": {
      $patch: ReturnType<typeof vi.fn>;
      $delete: ReturnType<typeof vi.fn>;
    };
    reorder: {
      $patch: ReturnType<typeof vi.fn>;
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

describe("Tasks API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useGetTasks", () => {
    it("should fetch tasks successfully", async () => {
      const mockTasks = [
        { id: "1", title: "Task 1", status: "todo", priority: "normal" },
        { id: "2", title: "Task 2", status: "in_progress", priority: "high" },
      ];
      const mockResponse = { tasks: mockTasks };
      mockClient.tasks.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => tasksApi.useGetTasks(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });

    it("should pass status filter", async () => {
      const mockResponse = { tasks: [] };
      mockClient.tasks.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => tasksApi.useGetTasks({ status: "todo" }), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.tasks.$get).toHaveBeenCalledWith({ query: { status: "todo" } });
    });

    it("should pass parentId filter", async () => {
      const mockResponse = { tasks: [] };
      mockClient.tasks.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => tasksApi.useGetTasks({ parentId: "parent-123" }), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.tasks.$get).toHaveBeenCalledWith({ query: { parentId: "parent-123" } });
    });
  });

  describe("useCreateTask", () => {
    it("should create task successfully", async () => {
      const mockTask = { id: "new-123", title: "New Task", status: "todo", priority: "normal" };
      const mockResponse = { success: true, task: mockTask };
      mockClient.tasks.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => tasksApi.useCreateTask(), { wrapper });

      result.current.mutate({
        title: "New Task",
        description: "Task description",
        status: "todo",
        priority: "normal",
      } as tasksApi.CreateTaskRequest);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.tasks.$post).toHaveBeenCalledWith({
        json: {
          title: "New Task",
          description: "Task description",
          status: "todo",
          priority: "normal",
        },
      });
    });

    it("should create task with assignees", async () => {
      const mockTask = { id: "new-123", title: "Team Task", assignees: ["user1", "user2"] };
      const mockResponse = { success: true, task: mockTask };
      mockClient.tasks.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => tasksApi.useCreateTask(), { wrapper });

      result.current.mutate({
        title: "Team Task",
        assignees: ["user1", "user2"],
      } as tasksApi.CreateTaskRequest);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.tasks.$post).toHaveBeenCalledWith({
        json: expect.objectContaining({
          title: "Team Task",
          assignees: ["user1", "user2"],
        }),
      });
    });

    it("should handle create errors", async () => {
      const mockError = new Error("Failed to create task");
      mockClient.tasks.$post.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => tasksApi.useCreateTask(), { wrapper });

      result.current.mutate({ title: "Test" } as tasksApi.CreateTaskRequest);

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useUpdateTask", () => {
    it("should update task successfully", async () => {
      const mockResponse = { success: true };
      mockClient.tasks[":id"].$patch.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => tasksApi.useUpdateTask(), { wrapper });

      result.current.mutate({
        id: "task-123",
        updates: { status: "done", priority: "urgent" },
      } as { id: string; updates: tasksApi.UpdateTaskRequest });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.tasks[":id"].$patch).toHaveBeenCalledWith({
        param: { id: "task-123" },
        json: { status: "done", priority: "urgent" },
      });
    });

    it("should update task with sortOrder", async () => {
      const mockResponse = { success: true };
      mockClient.tasks[":id"].$patch.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => tasksApi.useUpdateTask(), { wrapper });

      result.current.mutate({
        id: "task-123",
        updates: { sortOrder: 5 },
      } as { id: string; updates: tasksApi.UpdateTaskRequest });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.tasks[":id"].$patch).toHaveBeenCalledWith({
        param: { id: "task-123" },
        json: { sortOrder: 5 },
      });
    });
  });

  describe("useDeleteTask", () => {
    it("should delete task successfully", async () => {
      const mockResponse = { success: true };
      mockClient.tasks[":id"].$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => tasksApi.useDeleteTask(), { wrapper });

      result.current.mutate("task-123");

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.tasks[":id"].$delete).toHaveBeenCalledWith({
        param: { id: "task-123" },
      });
    });

    it("should handle delete errors", async () => {
      const mockError = new Error("Failed to delete task");
      mockClient.tasks[":id"].$delete.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => tasksApi.useDeleteTask(), { wrapper });

      result.current.mutate("task-123");

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useReorderTasks", () => {
    it("should reorder tasks successfully", async () => {
      const mockResponse = { success: true };
      const reorderItems = [
        { id: "task-1", status: "todo", sortOrder: 0 },
        { id: "task-2", status: "todo", sortOrder: 1 },
        { id: "task-3", status: "in_progress", sortOrder: 0 },
      ];
      mockClient.tasks.reorder.$patch.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => tasksApi.useReorderTasks(), { wrapper });

      result.current.mutate({ items: reorderItems } as tasksApi.ReorderTasksRequest);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.tasks.reorder.$patch).toHaveBeenCalledWith({
        json: { items: reorderItems },
      });
    });

    it("should handle reorder errors", async () => {
      const mockError = new Error("Failed to reorder tasks");
      mockClient.tasks.reorder.$patch.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => tasksApi.useReorderTasks(), { wrapper });

      result.current.mutate({ items: [] } as tasksApi.ReorderTasksRequest);

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });
});
