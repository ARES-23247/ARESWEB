import { createRoute, z } from "@hono/zod-openapi";

export const ErrorSchema = z.object({ error: z.string() });

export const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  price_cents: z.number(),
  image_url: z.string().nullable(),
  active: z.number(),
  stock_count: z.number().nullable(),
  created_at: z.string().nullable(),
});

export const OrderSchema = z.object({
  id: z.string(),
  stripe_session_id: z.string().nullable(),
  customer_email: z.string().nullable(),
  shipping_name: z.string().nullable(),
  shipping_address_line1: z.string().nullable(),
  shipping_address_line2: z.string().nullable(),
  shipping_city: z.string().nullable(),
  shipping_state: z.string().nullable(),
  shipping_postal_code: z.string().nullable(),
  shipping_country: z.string().nullable(),
  total_cents: z.number(),
  status: z.string().nullable(),
  fulfillment_status: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});

export type Product = z.infer<typeof ProductSchema>;
export type Order = z.infer<typeof OrderSchema>;

export const getProductsRoute = createRoute({
  method: "get",
  path: "/api/store/products",
  responses: {
    200: {
      description: "Get active products",
      content: { "application/json": { schema: z.array(ProductSchema) } },
    },
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

export const createCheckoutSessionRoute = createRoute({
  method: "post",
  path: "/api/store/checkout",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            items: z.array(
              z.object({
                productId: z.string(),
                quantity: z.number().int().positive(),
              })
            ),
            successUrl: z.string().url(),
            cancelUrl: z.string().url(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Create Checkout Session",
      content: { "application/json": { schema: z.object({ sessionId: z.string(), url: z.string() }) } },
    },
    400: {
      description: "Bad request",
      content: { "application/json": { schema: ErrorSchema } },
    },
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

export const getOrdersRoute = createRoute({
  method: "get",
  path: "/api/store/orders",
  responses: {
    200: {
      description: "Get orders (Admin)",
      content: { "application/json": { schema: z.array(OrderSchema) } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    },
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});

export const updateOrderStatusRoute = createRoute({
  method: "patch",
  path: "/api/store/orders/{id}/status",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: { "application/json": { schema: z.object({ fulfillment_status: z.string() }) } },
    },
  },
  responses: {
    200: {
      description: "Update order fulfillment status (Admin)",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ErrorSchema } },
    },
    500: {
      description: "Internal server error",
      content: { "application/json": { schema: ErrorSchema } },
    },
  },
});
