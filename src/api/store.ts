/**
 * Store API - Products, Checkout, Orders
 *
 * Types imported from backend route definitions in @shared/routes/store.ts
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { z } from "zod";
import { client, unwrapResponse, withMutationCallbacks } from "./honoClient";
import { ProductSchema, OrderSchema, CheckoutItemSchema } from "@shared/routes/store";

// Infer TypeScript types from Zod schemas
export type Product = z.infer<typeof ProductSchema>;
export type Order = z.infer<typeof OrderSchema>;
export type CheckoutItem = z.infer<typeof CheckoutItemSchema>;

export interface CheckoutSessionRequest {
  items: CheckoutItem[];
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
}

export interface OrdersResponse {
  orders: Order[];
}


// ============================================
// Hooks
// ============================================

/**
 * GET /api/store/products - Get active products
 */
export function useGetProducts(
  options?: Omit<UseQueryOptions<Product[]>, "queryKey" | "queryFn">
) {
  return useQuery<Product[]>({
    queryKey: ["store", "products"],
    queryFn: async () => {
      const response = await client.store.products.$get();
      return unwrapResponse<Product[]>(response);
    },
    ...options,
  });
}

/**
 * POST /api/store/checkout - Create checkout session
 */
export function useCreateCheckoutSession(
  options?: Omit<UseMutationOptions<CheckoutSessionResponse, Error, CheckoutSessionRequest>, "mutationFn">
) {
  return useMutation<CheckoutSessionResponse, Error, CheckoutSessionRequest>({
    mutationFn: async (data) => {
      const response = await client.store.checkout.$post({
        json: data,
      });
      return unwrapResponse<CheckoutSessionResponse>(response);
    },
    ...options,
  });
}

/**
 * GET /api/store/orders - Get orders (Admin)
 */
export function useGetOrders(
  options?: Omit<UseQueryOptions<OrdersResponse>, "queryKey" | "queryFn">
) {
  return useQuery<OrdersResponse>({
    queryKey: ["store", "orders"],
    queryFn: async () => {
      const response = await client.store.orders.$get();
      return unwrapResponse<OrdersResponse>(response);
    },
    ...options,
  });
}

/**
 * PATCH /api/store/orders/:id/status - Update order fulfillment status
 */
export function useUpdateOrderStatus(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, { id: string; fulfillmentStatus: string }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, { id: string; fulfillmentStatus: string }>({
    mutationFn: async ({ id, fulfillmentStatus }) => {
      const response = await client.store.orders[":id"].status.$patch({
        param: { id },
        json: { fulfillmentStatus }
      });
      return unwrapResponse<{ success: boolean }>(response);
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["store", "orders"] });
      }
    })
  });
}
