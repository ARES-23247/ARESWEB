import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { OpenAPIHono } from "@hono/zod-openapi";
import { AppEnv, logSystemError, ensureAdmin } from "../middleware";
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
        return c.json({ error: "Missing stripe signature" }, 400);
      }

      const stripe = new Stripe(stripeKey, { apiVersion: "2024-04-10" as const });
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
        return c.json({ error: `Invalid signature` }, 400);
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const db = c.get("db") as Kysely<DB>;

        // Fulfill order
        const metadata = session.metadata;
        const cartItems = metadata?.cartItems ? JSON.parse(metadata.cartItems) : [];

        const shippingName = (session as { shipping_details?: { name?: string | null } }).shipping_details?.name || null;

        await db
          .insertInto("orders")
          .values({
            id: session.id,
            stripe_session_id: session.id,
            customer_email: session.customer_details?.email || "unknown",
            shipping_name: shippingName,
            total_cents: session.amount_total || 0,
            status: "paid",
            items_json: JSON.stringify(cartItems),
            created_at: new Date().toISOString(),
          })
          .execute();

        // Deplete inventory
        for (const item of cartItems) {
          await db
            .updateTable("products")
            .set((eb) => ({ stock_count: eb("stock_count", "-", item.q) }))
            .where("id", "=", item.id)
            .where("stock_count", "is not", null)
            .execute();
        }

        // Alert team
        const totalAmount = session.amount_total ? (session.amount_total / 100).toFixed(2) : "0.00";
        const customerEmail = session.customer_details?.email || "Unknown Email";
        const message = `🛍️ **New Order Received!**\n\n**Order ID**: ${session.id}\n**Customer**: ${customerEmail}\n**Total**: $${totalAmount}\n\n[View Dashboard](https://aresweb.org/admin)`;
        await sendZulipMessage(c.env, "general", "Store Orders", message);
      }

      return c.json({ success: true }, 200);
    } catch (err: unknown) {
      logSystemError(c.get("db") as Kysely<DB>, "webhook_error", err);
      return c.json({ error: "Webhook fulfillment failed" }, 500);
    }
  }
);

// Apply ensureAdmin middleware to orders routes
storeRouter.use("/orders/*", ensureAdmin);
storeRouter.use("/orders", ensureAdmin);

storeRouter.openapi(getProductsRoute, async (c: any) => {
  try {
    const db = c.get("db") as Kysely<DB>;
    const products = await db
      .selectFrom("products")
      .selectAll()
      .where("active", "=", 1)
      .execute();

    return c.json(
      products.map((p) => ({
        id: p.id || "",
        name: p.name || "Unknown Product",
        description: p.description || null,
        price_cents: p.price_cents || 0,
        image_url: p.image_url || null,
        active: p.active || 1,
        stock_count: p.stock_count ?? null,
        created_at: p.created_at || null,
      })),
      200
    );
  } catch (err: unknown) {
    console.error("[Store] Get products failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

storeRouter.openapi(createCheckoutSessionRoute, async (c: any) => {
  try {
    const body = c.req.valid("json");
    const { items, successUrl, cancelUrl } = body;
    const stripeKey = c.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured.");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-04-10" as const });
    const db = c.get("db") as Kysely<DB>;

    // Fetch product details
    const productIds = items.map((i: { productId: string }) => i.productId);
    const products = await db
      .selectFrom("products")
      .selectAll()
      .where("id", "in", productIds)
      .where("active", "=", 1)
      .execute();

    const productMap = new Map(products.map((p) => [p.id, p]));

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
            images: product.image_url ? [product.image_url] : [],
          },
          unit_amount: product.price_cents,
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
  } catch (err: unknown) {
    console.error("[Store] Checkout failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

storeRouter.openapi(getOrdersRoute, async (c: any) => {
  try {
    const db = c.get("db") as Kysely<DB>;
    const orders = await db.selectFrom("orders").selectAll().orderBy("created_at", "desc").execute();

    return c.json({ orders }, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

storeRouter.openapi(updateOrderStatusRoute, async (c: any) => {
  try {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = c.get("db") as Kysely<DB>;
    await db.updateTable("orders").set({ status: body.fulfillment_status }).where("id", "=", id).execute();
    return c.json({ success: true }, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: message }, 500);
  }
});

export default storeRouter;
