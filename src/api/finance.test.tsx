import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as honoClient from "./honoClient";
import * as financeApi from "./finance";

// Define types for the mocked client
interface MockFinanceClient {
  summary: {
    $get: ReturnType<typeof vi.fn>;
  };
  sponsorship: {
    $get: ReturnType<typeof vi.fn>;
    $post: ReturnType<typeof vi.fn>;
    ":id": {
      $delete: ReturnType<typeof vi.fn>;
    };
  };
  transactions: {
    $get: ReturnType<typeof vi.fn>;
    $post: ReturnType<typeof vi.fn>;
    ":id": {
      $delete: ReturnType<typeof vi.fn>;
    };
  };
}

interface MockHonoClient {
  finance: MockFinanceClient;
}

// Mock the honoClient module
vi.mock("./honoClient", () => ({
  client: {
    finance: {
      summary: {
        $get: vi.fn(),
      },
      sponsorship: {
        $get: vi.fn(),
        $post: vi.fn(),
        ":id": {
          $delete: vi.fn(),
        },
      },
      transactions: {
        $get: vi.fn(),
        $post: vi.fn(),
        ":id": {
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
}));

const mockClient = honoClient.client as unknown as MockHonoClient;
const mockUnwrapResponse = honoClient.unwrapResponse as ReturnType<typeof vi.fn>;

// Type aliases for mutation parameters
type SaveSponsorshipPipelineParams = Parameters<ReturnType<typeof financeApi.useSaveSponsorshipPipeline>['mutate']>[0];
type DeleteSponsorshipPipelineParams = Parameters<ReturnType<typeof financeApi.useDeleteSponsorshipPipeline>['mutate']>[0];
type SaveFinanceTransactionParams = Parameters<ReturnType<typeof financeApi.useSaveFinanceTransaction>['mutate']>[0];
type DeleteFinanceTransactionParams = Parameters<ReturnType<typeof financeApi.useDeleteFinanceTransaction>['mutate']>[0];

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

describe("Finance API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useGetFinanceSummary", () => {
    it("should fetch finance summary successfully", async () => {
      const mockSummary = {
        totalIncome: 50000,
        totalExpenses: 35000,
        netIncome: 15000,
        sponsorPipelineCount: 12,
      };
      mockClient.finance.summary.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockSummary);

      const { result } = renderHook(() => financeApi.useGetFinanceSummary(1), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockSummary);
    });

    it("should pass seasonId parameter", async () => {
      const mockSummary = { totalIncome: 0, totalExpenses: 0, netIncome: 0 };
      mockClient.finance.summary.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockSummary);

      const { result } = renderHook(() => financeApi.useGetFinanceSummary(42), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.finance.summary.$get).toHaveBeenCalledWith({
        query: { seasonId: 42 },
      });
    });

    it("should handle null seasonId", async () => {
      const mockSummary = { totalIncome: 0, totalExpenses: 0, netIncome: 0 };
      mockClient.finance.summary.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockSummary);

      const { result } = renderHook(() => financeApi.useGetFinanceSummary(null), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.finance.summary.$get).toHaveBeenCalledWith({
        query: { seasonId: undefined },
      });
    });
  });

  describe("useListSponsorshipPipeline", () => {
    it("should fetch sponsorship pipeline successfully", async () => {
      const mockPipeline = [
        { id: "1", companyName: "Acme Corp", status: "potential", estimatedValue: 5000 },
        { id: "2", companyName: "Beta Inc", status: "contacted", estimatedValue: 10000 },
      ];
      const mockResponse = { pipeline: mockPipeline };
      mockClient.finance.sponsorship.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => financeApi.useListSponsorshipPipeline(1), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch pipeline");
      mockClient.finance.sponsorship.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => financeApi.useListSponsorshipPipeline(1), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useSaveSponsorshipPipeline", () => {
    it("should create new pipeline item successfully", async () => {
      const mockResponse = { success: true, id: "new-123" };
      const pipelineItem = {
        companyName: "New Sponsor",
        status: "potential" as const,
        estimatedValue: 7500,
      };
      mockClient.finance.sponsorship.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => financeApi.useSaveSponsorshipPipeline(), { wrapper });

      result.current.mutate(pipelineItem as SaveSponsorshipPipelineParams);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.finance.sponsorship.$post).toHaveBeenCalledWith({
        json: pipelineItem,
      });
    });

    it("should invalidate sponsorship and summary caches on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true, id: "123" };
      mockClient.finance.sponsorship.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => financeApi.useSaveSponsorshipPipeline(), {
        wrapper: customWrapper,
      });

      result.current.mutate({ companyName: "Test", status: "potential", estimatedValue: 1000 } as SaveSponsorshipPipelineParams);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["finance", "sponsorship"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["finance", "summary"] });
    });

    it("should handle save errors", async () => {
      const mockError = new Error("Failed to save pipeline item");
      mockClient.finance.sponsorship.$post.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => financeApi.useSaveSponsorshipPipeline(), { wrapper });

      result.current.mutate({ companyName: "Test", status: "potential", estimatedValue: 1000 } as SaveSponsorshipPipelineParams);

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useDeleteSponsorshipPipeline", () => {
    it("should delete pipeline item successfully", async () => {
      const mockResponse = { success: true };
      mockClient.finance.sponsorship[":id"].$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => financeApi.useDeleteSponsorshipPipeline(), { wrapper });

      result.current.mutate("pipeline-123" as DeleteSponsorshipPipelineParams);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.finance.sponsorship[":id"].$delete).toHaveBeenCalledWith({
        param: { id: "pipeline-123" },
      });
    });

    it("should invalidate sponsorship and summary caches on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true };
      mockClient.finance.sponsorship[":id"].$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => financeApi.useDeleteSponsorshipPipeline(), {
        wrapper: customWrapper,
      });

      result.current.mutate("pipeline-123" as DeleteSponsorshipPipelineParams);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["finance", "sponsorship"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["finance", "summary"] });
    });
  });

  describe("useListFinanceTransactions", () => {
    it("should fetch transactions successfully", async () => {
      const mockTransactions = [
        { id: "1", type: "income", amount: 5000, description: "Sponsorship" },
        { id: "2", type: "expense", amount: 250, description: "Parts" },
      ];
      const mockResponse = { transactions: mockTransactions };
      mockClient.finance.transactions.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(
        () => financeApi.useListFinanceTransactions(1, "income"),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });

    it("should pass seasonId and type parameters", async () => {
      const mockResponse = { transactions: [] };
      mockClient.finance.transactions.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(
        () => financeApi.useListFinanceTransactions(42, "expense"),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.finance.transactions.$get).toHaveBeenCalledWith({
        query: { seasonId: 42, type: "expense" },
      });
    });

    it("should handle null seasonId", async () => {
      const mockResponse = { transactions: [] };
      mockClient.finance.transactions.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(
        () => financeApi.useListFinanceTransactions(null, "income"),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.finance.transactions.$get).toHaveBeenCalledWith({
        query: { seasonId: undefined, type: "income" },
      });
    });

    it("should handle undefined type parameter", async () => {
      const mockResponse = { transactions: [] };
      mockClient.finance.transactions.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(
        () => financeApi.useListFinanceTransactions(1, undefined),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.finance.transactions.$get).toHaveBeenCalledWith({
        query: { seasonId: 1, type: undefined },
      });
    });
  });

  describe("useSaveFinanceTransaction", () => {
    it("should create new transaction successfully", async () => {
      const mockResponse = { success: true, id: "trans-123" };
      const transaction = {
        type: "income" as const,
        amount: 5000,
        description: "Sponsorship payment",
      };
      mockClient.finance.transactions.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => financeApi.useSaveFinanceTransaction(), { wrapper });

      result.current.mutate(transaction as SaveFinanceTransactionParams);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.finance.transactions.$post).toHaveBeenCalledWith({
        json: transaction,
      });
    });

    it("should invalidate transactions and summary caches on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true, id: "123" };
      mockClient.finance.transactions.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => financeApi.useSaveFinanceTransaction(), {
        wrapper: customWrapper,
      });

      result.current.mutate({ type: "expense", amount: 100, description: "Test" } as SaveFinanceTransactionParams);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["finance", "transactions"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["finance", "summary"] });
    });
  });

  describe("useDeleteFinanceTransaction", () => {
    it("should delete transaction successfully", async () => {
      const mockResponse = { success: true };
      mockClient.finance.transactions[":id"].$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => financeApi.useDeleteFinanceTransaction(), { wrapper });

      result.current.mutate("trans-123" as DeleteFinanceTransactionParams);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.finance.transactions[":id"].$delete).toHaveBeenCalledWith({
        param: { id: "trans-123" },
      });
    });

    it("should invalidate transactions and summary caches on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true };
      mockClient.finance.transactions[":id"].$delete.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => financeApi.useDeleteFinanceTransaction(), {
        wrapper: customWrapper,
      });

      result.current.mutate("trans-123" as DeleteFinanceTransactionParams);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["finance", "transactions"] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["finance", "summary"] });
    });

    it("should handle delete errors", async () => {
      const mockError = new Error("Failed to delete transaction");
      mockClient.finance.transactions[":id"].$delete.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => financeApi.useDeleteFinanceTransaction(), { wrapper });

      result.current.mutate("trans-123" as DeleteFinanceTransactionParams);

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });
});

