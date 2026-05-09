import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as honoClient from "./honoClient";
import * as storeApi from "./store";

// Mock the honoClient module
vi.mock("./honoClient", () => ({
  client: {
    store: {
      products: {
        $get: vi.fn(),
      },
      checkout: {
        $post: vi.fn(),
      },
      orders: {
        $get: vi.fn(),
        ":id": {
          status: {
            $patch: vi.fn(),
          },
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

// Mock types for the Hono client
interface MockStoreClient {
  products: {
    $get: ReturnType<typeof vi.fn>;
  };
  checkout: {
    $post: ReturnType<typeof vi.fn>;
  };
  orders: {
    $get: ReturnType<typeof vi.fn>;
    ":id": {
      status: {
        $patch: ReturnType<typeof vi.fn>;
      };
    };
  };
}

interface MockClient {
  store: MockStoreClient;
}

const mockClient = honoClient.client as MockClient;
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

describe("Store API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useGetProducts", () => {
    it("should fetch products successfully", async () => {
      const mockProducts = [
        { id: "1", name: "T-Shirt", price: 20, active: true },
        { id: "2", name: "Hat", price: 15, active: true },
      ];
      mockClient.store.products.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockProducts);

      const { result } = renderHook(() => storeApi.useGetProducts(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockProducts);
      expect(mockClient.store.products.$get).toHaveBeenCalled();
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch products");
      mockClient.store.products.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => storeApi.useGetProducts(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should handle empty products list", async () => {
      mockClient.store.products.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue([]);

      const { result } = renderHook(() => storeApi.useGetProducts(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([]);
    });
  });

  describe("useCreateCheckoutSession", () => {
    it("should create checkout session successfully", async () => {
      const mockResponse = {
        sessionId: "cs_test_123",
        url: "https://checkout.stripe.com/pay/cs_test_123",
      };
      mockClient.store.checkout.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => storeApi.useCreateCheckoutSession(), { wrapper });

      const checkoutData = {
        items: [{ productId: "1", quantity: 2 }],
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      };

      result.current.mutate(checkoutData as storeApi.CheckoutSessionRequest);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });

    it("should handle checkout errors", async () => {
      const mockError = new Error("Failed to create checkout session");
      mockClient.store.checkout.$post.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => storeApi.useCreateCheckoutSession(), { wrapper });

      result.current.mutate({
        items: [],
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      } as storeApi.CheckoutSessionRequest);

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });
  });

  describe("useGetOrders", () => {
    it("should fetch orders successfully", async () => {
      const mockOrders = [
        { id: "1", items: [], total: 40, fulfillment_status: "pending" },
        { id: "2", items: [], total: 30, fulfillment_status: "shipped" },
      ];
      const mockResponse = { orders: mockOrders };
      mockClient.store.orders.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => storeApi.useGetOrders(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.store.orders.$get).toHaveBeenCalled();
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch orders");
      mockClient.store.orders.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => storeApi.useGetOrders(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should handle empty orders list", async () => {
      const mockResponse = { orders: [] };
      mockClient.store.orders.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => storeApi.useGetOrders(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.orders).toEqual([]);
    });
  });

  describe("useUpdateOrderStatus", () => {
    it("should update order status successfully", async () => {
      const mockResponse = { success: true };
      mockClient.store.orders[":id"].status.$patch.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => storeApi.useUpdateOrderStatus(), { wrapper });

      result.current.mutate({ id: "123", fulfillment_status: "shipped" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockClient.store.orders[":id"].status.$patch).toHaveBeenCalledWith({
        param: { id: "123" },
        json: { fulfillment_status: "shipped" },
      });
    });

    it("should handle update errors", async () => {
      const mockError = new Error("Failed to update order");
      mockClient.store.orders[":id"].status.$patch.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => storeApi.useUpdateOrderStatus(), { wrapper });

      result.current.mutate({ id: "123", fulfillment_status: "shipped" });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should invalidate orders queries on success", async () => {
      const queryClient = createQueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const mockResponse = { success: true };
      mockClient.store.orders[":id"].status.$patch.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => storeApi.useUpdateOrderStatus(), { wrapper: customWrapper });

      result.current.mutate({ id: "123", fulfillment_status: "delivered" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["store", "orders"] });
    });
  });
});
