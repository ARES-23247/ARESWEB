import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as honoClient from "./honoClient";
import * as seasonsApi from "./seasons";

// Mock the honoClient module
vi.mock("./honoClient", () => ({
  client: {
    seasons: {
      $get: vi.fn(),
      ":year": {
        $get: vi.fn(),
      },
      admin: {
        list: {
          $get: vi.fn(),
        },
        ":id": {
          $get: vi.fn(),
          $delete: vi.fn(),
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

describe("Seasons API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useGetSeasons", () => {
    it("should fetch public seasons successfully", async () => {
      const mockSeasons = [
        { year: "2024", game_name: "Into the Deep", robot_name: "Atlas" },
        { year: "2023", game_name: "Centerstage", robot_name: "Orion" },
      ];
      const mockResponse = { seasons: mockSeasons };
      mockClient.seasons.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => seasonsApi.useGetSeasons(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.seasons.$get).toHaveBeenCalled();
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch seasons");
      mockClient.seasons.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => seasonsApi.useGetSeasons(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should handle empty seasons list", async () => {
      const mockResponse = { seasons: [] };
      mockClient.seasons.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => seasonsApi.useGetSeasons(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.seasons).toEqual([]);
    });
  });

  describe("useGetSeasonDetail", () => {
    it("should fetch season detail successfully", async () => {
      const mockResponse = {
        season: { year: "2024", game_name: "Into the Deep" },
        awards: [{ title: "Winner" }],
        events: [{ name: "Qualifier" }],
        posts: [{ title: "Season Recap" }],
        outreach: [{ title: "Demo Day" }],
      };
      mockClient.seasons[":year"].$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => seasonsApi.useGetSeasonDetail("2024"), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.seasons[":year"].$get).toHaveBeenCalledWith({
        param: { year: "2024" },
      });
    });

    it("should be disabled when year is empty", () => {
      const { result } = renderHook(() => seasonsApi.useGetSeasonDetail(""), { wrapper });

      expect(result.current.fetchStatus).toBe("idle");
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch season detail");
      mockClient.seasons[":year"].$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => seasonsApi.useGetSeasonDetail("2024"), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });
  });

  describe("useGetAdminSeasons", () => {
    it("should fetch admin seasons successfully", async () => {
      const mockSeasons = [
        { year: "2024", game_name: "Into the Deep", deleted: false },
        { year: "2023", game_name: "Centerstage", deleted: false },
      ];
      const mockResponse = { seasons: mockSeasons };
      mockClient.seasons.admin.list.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => seasonsApi.useGetAdminSeasons(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.seasons.admin.list.$get).toHaveBeenCalled();
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch admin seasons");
      mockClient.seasons.admin.list.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => seasonsApi.useGetAdminSeasons(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });
  });

  describe("useGetAdminSeasonDetail", () => {
    it("should fetch admin season detail successfully", async () => {
      const mockSeason = { year: "2024", game_name: "Into the Deep", deleted: false };
      const mockResponse = { season: mockSeason };
      mockClient.seasons.admin[":id"].$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => seasonsApi.useGetAdminSeasonDetail("123"), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.seasons.admin[":id"].$get).toHaveBeenCalledWith({
        param: { id: "123" },
      });
    });

    it("should be disabled when id is empty", () => {
      const { result } = renderHook(() => seasonsApi.useGetAdminSeasonDetail(""), { wrapper });

      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  describe("useSaveSeason", () => {
    it("should save season successfully", async () => {
      const mockResponse = { success: true };
      mockClient.seasons.admin.save.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => seasonsApi.useSaveSeason(), { wrapper });

      const seasonData = {
        year: "2024",
        game_name: "Into the Deep",
        robot_name: "Atlas",
      };

      result.current.mutate(seasonData as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.seasons.admin.save.$post).toHaveBeenCalledWith({
        json: seasonData,
      });
    });

    it("should handle save errors", async () => {
      const mockError = new Error("Failed to save season");
      mockClient.seasons.admin.save.$post.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => seasonsApi.useSaveSeason(), { wrapper });

      result.current.mutate({ year: "2024" } as any);

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should invalidate seasons queries on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true };
      mockClient.seasons.admin.save.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => seasonsApi.useSaveSeason(), { wrapper: customWrapper });

      result.current.mutate({ year: "2024" } as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["seasons"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin-seasons"] });
    });
  });

  describe("useDeleteSeason", () => {
    it("should soft delete season successfully", async () => {
      const mockResponse = { success: true };
      mockClient.seasons.admin[":id"].$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => seasonsApi.useDeleteSeason(), { wrapper });

      result.current.mutate("123" as any);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.seasons.admin[":id"].$delete).toHaveBeenCalledWith({
        param: { id: "123" },
      });
    });

    it("should handle delete errors", async () => {
      const mockError = new Error("Failed to delete season");
      mockClient.seasons.admin[":id"].$delete.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => seasonsApi.useDeleteSeason(), { wrapper });

      result.current.mutate("123" as any);

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });
  });
});
