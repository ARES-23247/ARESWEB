import { initContract } from "@ts-rest/core";
import { z } from "zod";
const c = initContract();

export const ErrorSchema = z.object({ error: z.string() });

export const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  price_cents: z.number(),
  image_url: z.string().nullable(),
  active: z.number(),
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

export const storeContract = c.router({
  getProducts: {
    method: "GET",
    path: "/api/store/products",
    responses: {
      200: z.array(ProductSchema),
      500: ErrorSchema,
    },
    summary: "Get active products",
    description: "Fetches all active products for the storefront.",
  },
  createCheckoutSession: {
    method: "POST",
    path: "/api/store/checkout",
    body: z.object({
      items: z.array(
        z.object({
          productId: z.string(),
          quantity: z.number().int().positive(),
        })
      ),
      successUrl: z.string().url(),
      cancelUrl: z.string().url(),
    }),
    responses: {
      200: z.object({
        sessionId: z.string(),
        url: z.string(),
      }),
      400: ErrorSchema,
      500: ErrorSchema,
    },
    summary: "Create Checkout Session",
    description: "Generates a Stripe Checkout session for the cart items.",
  },
});
