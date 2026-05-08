import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as honoClient from "./honoClient";
import * as settingsApi from "./settings";

// Mock the honoClient module
vi.mock("./honoClient", () => ({
  client: {
    settings: {
      admin: {
        settings: {
          $get: vi.fn(),
          $post: vi.fn(),
        },
        stats: {
          $get: vi.fn(),
        },
        backup: {
          $get: vi.fn(),
        },
      },
      public: {
        settings: {
          $get: vi.fn(),
        },
      },
    },
  },
  unwrapResponse: vi.fn(),
}));

const mockClient = honoClient.client as {
  settings: {
    admin: {
      settings: { $get: ReturnType<typeof vi.fn>; $post: ReturnType<typeof vi.fn> };
      stats: { $get: ReturnType<typeof vi.fn> };
      backup: { $get: ReturnType<typeof vi.fn> };
    };
    public: {
      settings: { $get: ReturnType<typeof vi.fn> };
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

describe("Settings API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useGetSettings", () => {
    it("should fetch admin settings successfully", async () => {
      const mockResponse = {
        success: true,
        settings: {
          github_token: "ghp_***",
          zulip_bot_email: "bot@example.com",
        },
      };
      mockClient.settings.admin.settings.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => settingsApi.useGetSettings(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.settings.admin.settings.$get).toHaveBeenCalled();
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch settings");
      mockClient.settings.admin.settings.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => settingsApi.useGetSettings(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });
  });

  describe("useGetPublicSettings", () => {
    it("should fetch public settings successfully", async () => {
      const mockResponse = {
        success: true,
        settings: {
          site_name: "ARES 23247",
          social_twitter: "https://twitter.com/ares23247",
        },
      };
      mockClient.settings.public.settings.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => settingsApi.useGetPublicSettings(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.settings.public.settings.$get).toHaveBeenCalled();
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch public settings");
      mockClient.settings.public.settings.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => settingsApi.useGetPublicSettings(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });
  });

  describe("useUpdateSettings", () => {
    it("should update settings successfully", async () => {
      const mockResponse = { success: true, updated: 2 };
      mockClient.settings.admin.settings.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => settingsApi.useUpdateSettings(), { wrapper });

      const newSettings: Record<string, string> = {
        github_token: "ghp_newtoken",
        zulip_bot_email: "newbot@example.com",
      };

      result.current.mutate(newSettings);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.settings.admin.settings.$post).toHaveBeenCalledWith({
        json: newSettings,
      });
    });

    it("should handle update errors", async () => {
      const mockError = new Error("Failed to update settings");
      mockClient.settings.admin.settings.$post.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => settingsApi.useUpdateSettings(), { wrapper });

      result.current.mutate({ github_token: "new" });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should invalidate settings queries on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true, updated: 1 };
      mockClient.settings.admin.settings.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => settingsApi.useUpdateSettings(), { wrapper: customWrapper });

      result.current.mutate({ github_token: "new" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["settings"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["public-settings"] });
    });
  });

  describe("useGetPlatformStats", () => {
    it("should fetch platform stats successfully", async () => {
      const mockResponse = {
        posts: 150,
        events: 25,
        docs: 40,
        inquiries: 10,
        users: 50,
      };
      mockClient.settings.admin.stats.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => settingsApi.useGetPlatformStats(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.settings.admin.stats.$get).toHaveBeenCalled();
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch stats");
      mockClient.settings.admin.stats.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => settingsApi.useGetPlatformStats(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should handle zero stats", async () => {
      const mockResponse = {
        posts: 0,
        events: 0,
        docs: 0,
        inquiries: 0,
        users: 0,
      };
      mockClient.settings.admin.stats.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => settingsApi.useGetPlatformStats(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.posts).toBe(0);
    });
  });

  describe("useGetBackup", () => {
    it("should fetch database backup successfully", async () => {
      const mockResponse = {
        success: true,
        timestamp: "2024-01-01T00:00:00Z",
        backup: {
          users: [{ id: "1", name: "User 1" }],
          posts: [{ id: "1", title: "Post 1" }],
        },
      };
      mockClient.settings.admin.backup.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => settingsApi.useGetBackup(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.settings.admin.backup.$get).toHaveBeenCalled();
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch backup");
      mockClient.settings.admin.backup.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => settingsApi.useGetBackup(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should handle empty backup", async () => {
      const mockResponse = {
        success: true,
        timestamp: "2024-01-01T00:00:00Z",
        backup: {},
      };
      mockClient.settings.admin.backup.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => settingsApi.useGetBackup(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(Object.keys(result.current.data?.backup || {})).toHaveLength(0);
    });
  });
});
