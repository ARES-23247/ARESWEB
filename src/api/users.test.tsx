import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as honoClient from "./honoClient";
import * as usersApi from "./users";

// Mock the honoClient module
vi.mock("./honoClient", () => ({
  client: {
    users: {
      admin: {
        list: {
          $get: vi.fn(),
        },
        ":id": {
          $get: vi.fn(),
          $patch: vi.fn(),
          profile: {
            $get: vi.fn(),
            $put: vi.fn(),
          },
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
  ApiError: class extends Error {
    constructor(public status: number, message: string) {
      super(message);
      this.name = "ApiError";
    }
  },
}));

const mockClient = honoClient.client as unknown as {
  users: {
    admin: {
      list: {
        $get: ReturnType<typeof vi.fn>;
      };
      ":id": {
        $get: ReturnType<typeof vi.fn>;
        $patch: ReturnType<typeof vi.fn>;
        profile: {
          $get: ReturnType<typeof vi.fn>;
          $put: ReturnType<typeof vi.fn>;
        };
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

describe("Users API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useGetUsers", () => {
    it("should fetch users list successfully", async () => {
      const mockUsers = [
        { id: "1", name: "User 1", email: "user1@test.com" },
        { id: "2", name: "User 2", email: "user2@test.com" },
      ];
      const mockResponse = { users: mockUsers };
      mockClient.users.admin.list.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => usersApi.useGetUsers({ limit: 10 }), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.users.admin.list.$get).toHaveBeenCalledWith({ query: { limit: 10 } });
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch users");
      mockClient.users.admin.list.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => usersApi.useGetUsers(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should accept query parameters", async () => {
      const mockResponse = { users: [], nextCursor: "cursor123" };
      mockClient.users.admin.list.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(
        () => usersApi.useGetUsers({ limit: 20, cursor: "cursor123" }),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.users.admin.list.$get).toHaveBeenCalledWith({
        query: { limit: 20, cursor: "cursor123" },
      });
    });
  });

  describe("useGetUser", () => {
    it("should fetch single user successfully", async () => {
      const mockUser = { id: "123", name: "Test User", email: "test@test.com" };
      const mockResponse = { user: mockUser };
      mockClient.users.admin[":id"].$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => usersApi.useGetUser("123"), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.users.admin[":id"].$get).toHaveBeenCalledWith({
        param: { id: "123" },
      });
    });

    it("should be disabled when id is empty", async () => {
      const { result } = renderHook(() => usersApi.useGetUser(""), { wrapper });

      expect(result.current.fetchStatus).toBe("idle");
    });

    it("should handle user not found error", async () => {
      const mockError = new honoClient.ApiError(404, "User not found");
      mockClient.users.admin[":id"].$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => usersApi.useGetUser("999"), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });
  });

  describe("usePatchUser", () => {
    it("should update user role successfully", async () => {
      const mockResponse = { success: true };
      mockClient.users.admin[":id"].$patch.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => usersApi.usePatchUser(), { wrapper });

      result.current.mutate({ id: "123", role: "admin" as usersApi.UserRole });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.users.admin[":id"].$patch).toHaveBeenCalledWith({
        param: { id: "123" },
        json: { role: "admin" },
      });
    });

    it("should update user member_type successfully", async () => {
      const mockResponse = { success: true };
      mockClient.users.admin[":id"].$patch.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => usersApi.usePatchUser(), { wrapper });

      result.current.mutate({ id: "123", member_type: "student" as usersApi.UserMemberType });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.users.admin[":id"].$patch).toHaveBeenCalledWith({
        param: { id: "123" },
        json: { member_type: "student" },
      });
    });

    it("should handle update errors", async () => {
      const mockError = new Error("Update failed");
      mockClient.users.admin[":id"].$patch.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => usersApi.usePatchUser(), { wrapper });

      result.current.mutate({ id: "123", role: "admin" as usersApi.UserRole });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should invalidate users query cache on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true };
      mockClient.users.admin[":id"].$patch.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => usersApi.usePatchUser(), { wrapper: customWrapper });

      result.current.mutate({ id: "123", role: "admin" as usersApi.UserRole });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["users"] });
    });
  });

  describe("useGetUserProfile", () => {
    it("should fetch user profile successfully", async () => {
      const mockProfile = {
        profile: {
          nickname: "Test Nick",
          bio: "Test bio",
          memberType: "student",
        },
      };
      mockClient.users.admin[":id"].profile.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockProfile);

      const { result } = renderHook(() => usersApi.useGetUserProfile("123"), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockProfile);
    });
  });

  describe("useUpdateUserProfile", () => {
    it("should update user profile successfully", async () => {
      const mockResponse = { success: true };
      const mockProfile = { nickname: "New Nick", bio: "New bio" };
      mockClient.users.admin[":id"].profile.$put.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => usersApi.useUpdateUserProfile(), { wrapper });

      result.current.mutate({ id: "123", profile: mockProfile });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.users.admin[":id"].profile.$put).toHaveBeenCalledWith({
        param: { id: "123" },
        json: mockProfile,
      });
    });
  });

  describe("useDeleteUser", () => {
    it("should delete user successfully", async () => {
      const mockResponse = { success: true };
      mockClient.users.admin[":id"].$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => usersApi.useDeleteUser(), { wrapper });

      result.current.mutate("123");

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.users.admin[":id"].$delete).toHaveBeenCalledWith({
        param: { id: "123" },
      });
    });

    it("should handle delete errors", async () => {
      const mockError = new Error("Delete failed");
      mockClient.users.admin[":id"].$delete.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => usersApi.useDeleteUser(), { wrapper });

      result.current.mutate("123");

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });
  });
});
