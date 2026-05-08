import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as honoClient from "./honoClient";
import * as profilesApi from "./profiles";

// Mock the honoClient module
vi.mock("./honoClient", () => ({
  client: {
    profile: {
      me: {
        $get: vi.fn(),
        $put: vi.fn(),
      },
      avatar: {
        $put: vi.fn(),
      },
      "team-roster": {
        $get: vi.fn(),
      },
      ":userId": {
        $get: vi.fn(),
      },
    },
  },
  unwrapResponse: vi.fn(),
  ApiError: class extends Error {
    constructor(public status: number, message: string) {
      super(message);
      this.name = "ApiError";
    }
  },
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

describe("Profiles API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useGetMe", () => {
    it("should fetch current user profile successfully", async () => {
      const mockProfile = {
        id: "123",
        name: "Test User",
        email: "test@example.com",
        member_type: "student",
      };
      mockClient.profile.me.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockProfile);

      const { result } = renderHook(() => profilesApi.useGetMe(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockProfile);
      expect(mockClient.profile.me.$get).toHaveBeenCalled();
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch profile");
      mockClient.profile.me.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => profilesApi.useGetMe(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });
  });

  describe("useUpdateMe", () => {
    it("should update current user profile successfully", async () => {
      const mockResponse = { success: true };
      mockClient.profile.me.$put.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => profilesApi.useUpdateMe(), { wrapper });

      const updateData = {
        name: "Updated Name",
        bio: "Updated bio",
      };

      result.current.mutate(updateData as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.profile.me.$put).toHaveBeenCalledWith({
        json: updateData,
      });
    });

    it("should handle update errors", async () => {
      const mockError = new Error("Failed to update profile");
      mockClient.profile.me.$put.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => profilesApi.useUpdateMe(), { wrapper });

      result.current.mutate({ name: "New Name" } as any);

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should invalidate profile queries on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true };
      mockClient.profile.me.$put.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => profilesApi.useUpdateMe(), { wrapper: customWrapper });

      result.current.mutate({ name: "New Name" } as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["profile", "me"] });
    });
  });

  describe("useUpdateAvatar", () => {
    it("should update avatar successfully", async () => {
      const mockResponse = { success: true };
      mockClient.profile.avatar.$put.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => profilesApi.useUpdateAvatar(), { wrapper });

      result.current.mutate({ image: "data:image/png;base64,iVBORw0KG..." } as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.profile.avatar.$put).toHaveBeenCalledWith({
        json: { image: "data:image/png;base64,iVBORw0KG..." },
      });
    });

    it("should handle removing avatar (null)", async () => {
      const mockResponse = { success: true };
      mockClient.profile.avatar.$put.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => profilesApi.useUpdateAvatar(), { wrapper });

      result.current.mutate({ image: null } as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.profile.avatar.$put).toHaveBeenCalledWith({
        json: { image: null },
      });
    });

    it("should handle update errors", async () => {
      const mockError = new Error("Failed to update avatar");
      mockClient.profile.avatar.$put.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => profilesApi.useUpdateAvatar(), { wrapper });

      result.current.mutate({ image: "data:image/png;base64,..." } as any);

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should invalidate profile queries on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true };
      mockClient.profile.avatar.$put.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => profilesApi.useUpdateAvatar(), { wrapper: customWrapper });

      result.current.mutate({ image: "new-avatar-url" } as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["profile", "me"] });
    });
  });

  describe("useGetTeamRoster", () => {
    it("should fetch team roster successfully", async () => {
      const mockMembers = [
        { id: "1", name: "Member 1", role: "Captain", graduation_year: 2025 },
        { id: "2", name: "Member 2", role: "Driver", graduation_year: 2026 },
      ];
      const mockResponse = { members: mockMembers };
      mockClient.profile["team-roster"].$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => profilesApi.useGetTeamRoster(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.profile["team-roster"].$get).toHaveBeenCalled();
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch team roster");
      mockClient.profile["team-roster"].$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => profilesApi.useGetTeamRoster(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should handle empty roster", async () => {
      const mockResponse = { members: [] };
      mockClient.profile["team-roster"].$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => profilesApi.useGetTeamRoster(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.members).toEqual([]);
    });
  });

  describe("useGetPublicProfile", () => {
    it("should fetch public user profile successfully", async () => {
      const mockResponse = {
        profile: { name: "Public User", bio: "Bio" },
        badges: [{ name: "Volunteer", icon: "award" }],
      };
      mockClient.profile[":userId"].$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => profilesApi.useGetPublicProfile("user123"), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.profile[":userId"].$get).toHaveBeenCalledWith({
        param: { userId: "user123" },
      });
    });

    it("should be disabled when userId is empty", () => {
      const { result } = renderHook(() => profilesApi.useGetPublicProfile(""), { wrapper });

      expect(result.current.fetchStatus).toBe("idle");
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch public profile");
      mockClient.profile[":userId"].$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => profilesApi.useGetPublicProfile("user123"), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should handle profile not found", async () => {
      const mockError = new honoClient.ApiError(404, "User not found");
      mockClient.profile[":userId"].$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => profilesApi.useGetPublicProfile("nonexistent"), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });
  });
});
