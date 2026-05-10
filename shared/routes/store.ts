import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";
import { selectProductSchema, selectOrderSchema } from "../db/schema-zod";
import { createResponseSchema } from "../db/schema-openapi";

// Auto-generated response schemas from Drizzle
export const ProductSchema = createResponseSchema(selectProductSchema, {
  title: "Product",
  example: {
    id: "prod_123",
    name: "ARES Team Shirt",
    description: "Official team shirt with logo",
    priceCents: 2500,
    imageUrl: "https://cdn.aresweb.org/shirt.jpg",
    active: 1,
    stockCount: 50,
    createdAt: "2025-01-15T10:00:00Z",
  },
});

export const OrderSchema = createResponseSchema(selectOrderSchema, {
  title: "Order",
  example: {
    id: "order_456",
    stripeSessionId: "cs_test_123",
    customerEmail: "customer@example.com",
    shippingName: "John Doe",
    shippingAddressLine1: "123 Main St",
    shippingAddressLine2: "Apt 4B",
    shippingCity: "Morgantown",
    shippingState: "WV",
    shippingPostalCode: "26505",
    shippingCountry: "USA",
    totalCents: 5000,
    status: "processing",
    fulfillmentStatus: "unfulfilled",
    createdAt: "2025-01-15T10:00:00Z",
    updatedAt: "2025-01-15T10:00:00Z",
  },
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
