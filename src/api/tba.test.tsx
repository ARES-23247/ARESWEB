import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as honoClient from "./honoClient";
import * as tbaApi from "./tba";

// Mock the honoClient module
vi.mock("./honoClient", () => ({
  client: {
    tba: {
      rankings: {
        ":eventKey": {
          $get: vi.fn(),
        },
      },
      matches: {
        ":eventKey": {
          $get: vi.fn(),
        },
      },
    },
  },
  unwrapResponse: vi.fn(),
}));

const mockClient = honoClient.client as unknown as typeof honoClient.client;
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

describe("TBA API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useGetTBARankings", () => {
    it("should fetch TBA rankings successfully", async () => {
      const mockRankings = [
        { team_key: "frc1234", rank: 1 },
        { team_key: "frc5678", rank: 2 },
      ];
      const mockResponse = { rankings: mockRankings };
      mockClient.tba.rankings[":eventKey"].$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => tbaApi.useGetTBARankings("2024mike"), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.tba.rankings[":eventKey"].$get).toHaveBeenCalledWith({
        param: { eventKey: "2024mike" },
      });
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch rankings");
      mockClient.tba.rankings[":eventKey"].$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => tbaApi.useGetTBARankings("2024mike"), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should handle empty rankings", async () => {
      const mockResponse = { rankings: [] };
      mockClient.tba.rankings[":eventKey"].$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => tbaApi.useGetTBARankings("2024mike"), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.rankings).toEqual([]);
    });
  });

  describe("useGetTBAMatches", () => {
    it("should fetch TBA matches successfully", async () => {
      const mockMatches = [
        {
          comp_level: "qm",
          match_number: 1,
          alliances: {
            red: { team_keys: ["frc1234", "frc5678", "frc9012"] },
            blue: { team_keys: ["frc3456", "frc7890", "frc2345"] },
          },
        },
      ];
      const mockResponse = { matches: mockMatches };
      mockClient.tba.matches[":eventKey"].$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => tbaApi.useGetTBAMatches("2024mike"), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.tba.matches[":eventKey"].$get).toHaveBeenCalledWith({
        param: { eventKey: "2024mike" },
      });
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch matches");
      mockClient.tba.matches[":eventKey"].$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => tbaApi.useGetTBAMatches("2024mike"), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should handle empty matches", async () => {
      const mockResponse = { matches: [] };
      mockClient.tba.matches[":eventKey"].$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => tbaApi.useGetTBAMatches("2024mike"), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.matches).toEqual([]);
    });

    it("should handle different comp levels", async () => {
      const mockMatches = [
        {
          comp_level: "f",
          match_number: 1,
          alliances: {
            red: { team_keys: ["frc1234", "frc5678", "frc9012"] },
            blue: { team_keys: ["frc3456", "frc7890", "frc2345"] },
          },
        },
      ];
      const mockResponse = { matches: mockMatches };
      mockClient.tba.matches[":eventKey"].$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => tbaApi.useGetTBAMatches("2024mike"), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.matches[0].comp_level).toBe("f");
    });
  });
});
