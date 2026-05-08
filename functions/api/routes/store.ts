import { typedHandler } from "../utils/handler";
import { ApiError } from "../middleware/errorHandler";

import { eq, desc, and, inArray, isNotNull, sql } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { OpenAPIHono } from "@hono/zod-openapi";

import { AppEnv, logSystemError, ensureAdmin, getDb } from "../middleware";
import Stripe from "stripe";
import { sendZulipMessage } from "../../utils/zulip";
import {
  getProductsRoute,
  createCheckoutSessionRoute,
  getOrdersRoute,
  updateOrderStatusRoute,
} from "../../../shared/routes/store";

export const storeRouter = new OpenAPIHono<AppEnv>();

// Webhook endpoint - must be before auth middleware since Stripe calls it
// Using native Hono route since webhook doesn't follow OpenAPI pattern (Stripe signature verification)
storeRouter.post("/webhook", async (c) => {
    try {
      const stripeKey = c.env.STRIPE_SECRET_KEY;
      const endpointSecret = c.env.STRIPE_WEBHOOK_SECRET;
      const signature = c.req.header("stripe-signature");

      if (!stripeKey || !endpointSecret || !signature) {
        throw new ApiError("Missing stripe signature", 400);
      }

      const stripe = new Stripe(stripeKey, { apiVersion: "2024-04-10" as any });
      let event: Stripe.Event;

      try {
        const rawBody = await c.req.text();
        event = stripe.webhooks.constructEvent(
          rawBody,
          signature,
          endpointSecret
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error(`[Webhook] Signature verification failed: ${message}`);
        throw new ApiError(`Invalid signature`, 400);
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const db = getDb(c);

        // Fulfill order
        const metadata = session.metadata;
        const cartItems = metadata?.cartItems ? JSON.parse(metadata.cartItems) : [];

        const shippingName = (session as { shipping_details?: { name?: string | null } }).shipping_details?.name || null;

        await db
          .insert(schema.orders)
          .values({
            id: session.id,
            stripeSessionId: session.id,
            customerEmail: session.customer_details?.email || "unknown",
            shippingName: shippingName,
            totalCents: session.amount_total || 0,
            status: "paid",
            createdAt: new Date().toISOString(),
          })
          .run();

        // Deplete inventory
        for (const item of cartItems) {
          await db
            .update(schema.products)
            .set({ stockCount: sql`${schema.products.stockCount} - ${item.q}` })
            .where(
              and(
                eq(schema.products.id, item.id),
                isNotNull(schema.products.stockCount)
              )
            )
            .run();
        }

        // Alert team
        const totalAmount = session.amount_total ? (session.amount_total / 100).toFixed(2) : "0.00";
        const customerEmail = session.customer_details?.email || "Unknown Email";
        const message = `🛍️ **New Order Received!**\n\n**Order ID**: ${session.id}\n**Customer**: ${customerEmail}\n**Total**: $${totalAmount}\n\n[View Dashboard](https://aresweb.org/admin)`;
        await sendZulipMessage(c.env, "general", "Store Orders", message);
      }

      return c.json({ success: true }, 200);
    } catch (err: unknown) {
      logSystemError(getDb(c), "webhook_error", String(err));
      throw new ApiError("Webhook fulfillment failed", 500);
    }
  }
);

// Apply ensureAdmin middleware to orders routes
storeRouter.use("/orders/*", ensureAdmin);
storeRouter.use("/orders", ensureAdmin);

storeRouter.openapi(getProductsRoute, typedHandler<typeof getProductsRoute>(async (c) => {
    const db = getDb(c);
    const products = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.active, 1))
      .all();

    type Product = typeof schema.products.$inferSelect;
    return c.json(
      products.map((p: Product) => ({
        id: p.id || "",
        name: p.name || "Unknown Product",
        description: p.description || null,
        price_cents: p.priceCents || 0,
        image_url: p.imageUrl || null,
        active: p.active || 1,
        stock_count: p.stockCount ?? null,
        created_at: p.createdAt || null,
      })),
      200
    );
}));

storeRouter.openapi(createCheckoutSessionRoute, typedHandler<typeof createCheckoutSessionRoute>(async (c) => {
    const body = c.req.valid("json");
    const { items, successUrl, cancelUrl } = body;
    const stripeKey = c.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured.");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-04-10" as any });
    const db = getDb(c);

    // Fetch product details
    const productIds = items.map((i: { productId: string }) => i.productId);
    const products = await db
      .select()
      .from(schema.products)
      .where(
        and(
          inArray(schema.products.id, productIds),
          eq(schema.products.active, 1)
        )
      )
      .all();

    type Product = typeof schema.products.$inferSelect;
    const productMap = new Map<string, Product>(products.map((p: Product) => [p.id, p]));

    const lineItems = items.map((item: { productId: string; quantity: number }) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new Error(`Product ${item.productId} not found or inactive.`);
      }
      return {
        price_data: {
          currency: "usd",
          product_data: {
            name: product.name,
            images: product.imageUrl ? [product.imageUrl] : [],
          },
          unit_amount: product.priceCents,
        },
        quantity: item.quantity,
      };
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      metadata: {
        cartItems: JSON.stringify(items.map((i: { productId: string; quantity: number }) => ({ id: i.productId, q: i.quantity })))
      },
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      shipping_address_collection: {
        allowed_countries: ["US", "CA"],
      },
    });

    if (!session.url) {
      throw new Error("Stripe session URL is null");
    }

    return c.json(
      {
        sessionId: session.id,
        url: session.url,
      },
      200
    );
}));

storeRouter.openapi(getOrdersRoute, typedHandler<typeof getOrdersRoute>(async (c) => {
    const db = getDb(c);
    const orders = await db
      .select()
      .from(schema.orders)
      .orderBy(desc(schema.orders.createdAt))
      .all();

    type Order = typeof schema.orders.$inferSelect;
    const formattedOrders = orders.map((o: Order) => ({
      ...o,
      stripe_session_id: o.stripeSessionId,
      customer_email: o.customerEmail,
      shipping_name: o.shippingName,
      shipping_address_line1: o.shippingAddressLine1,
      shipping_address_line2: o.shippingAddressLine2,
      shipping_city: o.shippingCity,
      shipping_state: o.shippingState,
      shipping_postal_code: o.shippingPostalCode,
      shipping_country: o.shippingCountry,
      total_cents: o.totalCents,
      fulfillment_status: o.fulfillmentStatus,
      created_at: o.createdAt,
      updated_at: o.updatedAt,
    }));

    return c.json({ orders: formattedOrders }, 200);
}));

storeRouter.openapi(updateOrderStatusRoute, typedHandler<typeof updateOrderStatusRoute>(async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = getDb(c);
    await db.update(schema.orders).set({ status: body.fulfillment_status }).where(eq(schema.orders.id, id)).run();
    return c.json({ success: true }, 200);
}));

export default storeRouter;
