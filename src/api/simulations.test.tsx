import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as honoClient from "./honoClient";
import * as simulationsApi from "./simulations";

// Mock the honoClient module
vi.mock("./honoClient", () => ({
  client: {
    simulations: {
      $get: vi.fn(),
      $post: vi.fn(),
      ":id": {
        $get: vi.fn(),
        $delete: vi.fn(),
      },
      gist: {
        $post: vi.fn(),
        ":id": {
          $get: vi.fn(),
        },
      },
    },
  },
  unwrapResponse: vi.fn(),
}));

const mockClient = honoClient.client as unknown as {
  simulations: {
    $get: ReturnType<typeof vi.fn>;
    $post: ReturnType<typeof vi.fn>;
    ":id": {
      $get: ReturnType<typeof vi.fn>;
      $delete: ReturnType<typeof vi.fn>;
    };
    gist: {
      $post: ReturnType<typeof vi.fn>;
      ":id": {
        $get: ReturnType<typeof vi.fn>;
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

describe("Simulations API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useGetSimulations", () => {
    it("should fetch simulations successfully", async () => {
      const mockSimulations = [
        { id: "1", name: "Sim 1", files: { "index.ts": "code" } },
        { id: "2", name: "Sim 2", files: { "index.ts": "code" } },
      ];
      const mockResponse = { simulations: mockSimulations };
      mockClient.simulations.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => simulationsApi.useGetSimulations(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.simulations.$get).toHaveBeenCalled();
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch simulations");
      mockClient.simulations.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => simulationsApi.useGetSimulations(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should handle empty simulations list", async () => {
      const mockResponse = { simulations: [] };
      mockClient.simulations.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => simulationsApi.useGetSimulations(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.simulations).toEqual([]);
    });
  });

  describe("useGetSimulation", () => {
    it("should fetch single simulation successfully", async () => {
      const mockSimulation = { id: "123", name: "Test Sim", files: { "index.ts": "code" } };
      const mockResponse = { simulation: mockSimulation };
      mockClient.simulations[":id"].$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => simulationsApi.useGetSimulation("123"), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.simulations[":id"].$get).toHaveBeenCalledWith({
        param: { id: "123" },
      });
    });

    it("should be disabled when id is empty", () => {
      const { result } = renderHook(() => simulationsApi.useGetSimulation(""), { wrapper });

      expect(result.current.fetchStatus).toBe("idle");
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch simulation");
      mockClient.simulations[":id"].$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => simulationsApi.useGetSimulation("123"), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });
  });

  describe("useSaveSimulation", () => {
    it("should save simulation successfully", async () => {
      const mockResponse = { id: "123" };
      mockClient.simulations.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => simulationsApi.useSaveSimulation(), { wrapper });

      const simData = {
        name: "New Sim",
        files: { "index.ts": "console.log('hello');" },
      };

      result.current.mutate(simData as simulationsApi.SaveSimulationRequest);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.simulations.$post).toHaveBeenCalledWith({
        json: simData,
      });
    });

    it("should handle save errors", async () => {
      const mockError = new Error("Failed to save simulation");
      mockClient.simulations.$post.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => simulationsApi.useSaveSimulation(), { wrapper });

      result.current.mutate({ name: "New Sim", files: {} } as simulationsApi.SaveSimulationRequest);

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should invalidate simulations queries on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { id: "123" };
      mockClient.simulations.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => simulationsApi.useSaveSimulation(), { wrapper: customWrapper });

      result.current.mutate({ files: {} } as simulationsApi.CreateGistRequest);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["simulations"] });
    });
  });

  describe("useDeleteSimulation", () => {
    it("should delete simulation successfully", async () => {
      const mockResponse = { success: true };
      mockClient.simulations[":id"].$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => simulationsApi.useDeleteSimulation(), { wrapper });

      result.current.mutate("123");

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.simulations[":id"].$delete).toHaveBeenCalledWith({
        param: { id: "123" },
      });
    });

    it("should handle delete errors", async () => {
      const mockError = new Error("Failed to delete simulation");
      mockClient.simulations[":id"].$delete.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => simulationsApi.useDeleteSimulation(), { wrapper });

      result.current.mutate("123");

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should invalidate simulations queries on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true };
      mockClient.simulations[":id"].$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => simulationsApi.useDeleteSimulation(), { wrapper: customWrapper });

      result.current.mutate("123");

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["simulations"] });
    });
  });

  describe("useCreateGist", () => {
    it("should create gist successfully", async () => {
      const mockResponse = { success: true, gistId: "abc123", url: "https://gist.github.com/abc123" };
      mockClient.simulations.gist.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => simulationsApi.useCreateGist(), { wrapper });

      const gistData = {
        name: "My Gist",
        files: { "index.ts": "code" },
      };

      result.current.mutate(gistData as simulationsApi.CreateGistRequest);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.simulations.gist.$post).toHaveBeenCalledWith({
        json: gistData,
      });
    });

    it("should handle gist creation errors", async () => {
      const mockError = new Error("Failed to create gist");
      mockClient.simulations.gist.$post.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => simulationsApi.useCreateGist(), { wrapper });

      result.current.mutate({ files: {} } as simulationsApi.CreateGistRequest);

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });
  });

  describe("useGetGist", () => {
    it("should fetch gist successfully", async () => {
      const mockSimulation = { id: "gist123", name: "Gist Sim", files: { "index.ts": "code" } };
      const mockResponse = { simulation: mockSimulation };
      mockClient.simulations.gist[":id"].$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => simulationsApi.useGetGist("abc123"), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.simulations.gist[":id"].$get).toHaveBeenCalledWith({
        param: { id: "abc123" },
      });
    });

    it("should be disabled when id is empty", () => {
      const { result } = renderHook(() => simulationsApi.useGetGist(""), { wrapper });

      expect(result.current.fetchStatus).toBe("idle");
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch gist");
      mockClient.simulations.gist[":id"].$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => simulationsApi.useGetGist("abc123"), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });
  });
});
