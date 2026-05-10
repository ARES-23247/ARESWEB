import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";

export const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  priceCents: z.number(),
  imageUrl: z.string().nullable(),
  active: z.number(),
  stockCount: z.number().nullable(),
  createdAt: z.string().nullable(),
});

export const OrderSchema = z.object({
  id: z.string(),
  stripeSessionId: z.string().nullable(),
  customerEmail: z.string().nullable(),
  shippingName: z.string().nullable(),
  shippingAddressLine1: z.string().nullable(),
  shippingAddressLine2: z.string().nullable(),
  shippingCity: z.string().nullable(),
  shippingState: z.string().nullable(),
  shippingPostalCode: z.string().nullable(),
  shippingCountry: z.string().nullable(),
  totalCents: z.number(),
  status: z.string().nullable(),
  fulfillmentStatus: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export type Product = z.infer<typeof ProductSchema>;
export type Order = z.infer<typeof OrderSchema>;


export const CheckoutItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
});

export const getProductsRoute = createRoute({
  method: "get",
  path: "/products",
  tags: ["store"],
  summary: "Get active products",
  description: "Fetches all active products for the storefront.",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.array(ProductSchema),
        },
      },
      description: "List of active products",
    },
  },
});

export const createCheckoutSessionRoute = createRoute({
  method: "post",
  path: "/checkout",
  tags: ["store"],
  summary: "Create Checkout Session",
  description: "Generates a Stripe Checkout session for the cart items.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            items: z.array(CheckoutItemSchema),
            successUrl: z.string().url(),
            cancelUrl: z.string().url(),
          }),
        },
      },
    },
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            sessionId: z.string(),
            url: z.string(),
          }),
        },
      },
      description: "Checkout session created successfully",
    },
  },
});

export const getOrdersRoute = createRoute({
  method: "get",
  path: "/orders",
  tags: ["store"],
  summary: "Get orders (Admin)",
  description: "Fetches all orders for admin viewing.",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            orders: z.array(OrderSchema),
          }),
        },
      },
      description: "List of orders",
    },
  },
});

export const updateOrderStatusRoute = createRoute({
  method: "patch",
  path: "/orders/{id}/status",
  tags: ["store"],
  summary: "Update order fulfillment status (Admin)",
  request: {
    params: z.object({
      id: z.string(),
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            fulfillmentStatus: z.string(),
          }),
        },
      },
    },
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
          }),
        },
      },
      description: "Order status updated successfully",
    },
  },
});
