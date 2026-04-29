import { Hono } from "hono";
import { initServer } from "@ts-rest/hono";
import { storeContract } from "../../../shared/schemas/contracts/storeContract";
import type { AppEnv } from "../middleware/utils";
import Stripe from "stripe";
import { logSystemError } from "../middleware/utils";

const app = new Hono<AppEnv>();
const s = initServer<AppEnv>();

const storeRouter = s.router(storeContract, {
  getProducts: async ({ c }) => {
    try {
      const db = c.get("db");
      const products = await db
        .selectFrom("products")
        .selectAll()
        .where("active", "=", 1)
        .execute();

      return {
        status: 200,
        body: products.map((p) => ({
          id: p.id || "",
          name: p.name,
          description: p.description,
          price_cents: p.price_cents,
          image_url: p.image_url,
          active: p.active || 1,
          created_at: p.created_at || "",
        })),
      };
    } catch (err: any) {
      console.error("[Store] Get products failed:", err);
      return { status: 500, body: { error: err.message } };
    }
  },
  createCheckoutSession: async ({ body, c }) => {
    try {
      const { items, successUrl, cancelUrl } = body;
      const stripeKey = c.env.STRIPE_SECRET_KEY;
      if (!stripeKey) {
        throw new Error("STRIPE_SECRET_KEY is not configured.");
      }

      const stripe = new Stripe(stripeKey, { apiVersion: "2024-04-10" });
      const db = c.get("db");

      // Fetch product details
      const productIds = items.map((i) => i.productId);
      const products = await db
        .selectFrom("products")
        .selectAll()
        .where("id", "in", productIds)
        .where("active", "=", 1)
        .execute();

      const productMap = new Map(products.map((p) => [p.id, p]));

      const lineItems = items.map((item) => {
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
        mode: "payment",
        success_url: successUrl,
        cancel_url: cancelUrl,
        shipping_address_collection: {
          allowed_countries: ["US", "CA"],
        },
      });

      return {
        status: 200,
        body: {
          sessionId: session.id,
          url: session.url || "",
        },
      };
    } catch (err: any) {
      console.error("[Store] Create checkout session failed:", err);
      return { status: 500, body: { error: err.message } };
    }
  },
  getOrders: async ({ c }) => {
    try {
      const sessionUser = c.get("sessionUser");
      if (!sessionUser || sessionUser.role !== "admin") {
        return { status: 401, body: { error: "Unauthorized" } };
      }

      const db = c.get("db");
      const orders = await db
        .selectFrom("orders")
        .selectAll()
        .orderBy("created_at", "desc")
        .execute();

      return {
        status: 200,
        body: orders.map(o => ({
          ...o,
          id: o.id || "",
        }))
      };
    } catch (err: any) {
      console.error("[Store] Get orders failed:", err);
      return { status: 500, body: { error: err.message } };
    }
  },
  updateOrderStatus: async ({ body, params, c }) => {
    try {
      const sessionUser = c.get("sessionUser");
      if (!sessionUser || sessionUser.role !== "admin") {
        return { status: 401, body: { error: "Unauthorized" } };
      }

      const db = c.get("db");
      await db
        .updateTable("orders")
        .set({ fulfillment_status: body.fulfillment_status })
        .where("id", "=", params.id)
        .execute();

      return {
        status: 200,
        body: { success: true }
      };
    } catch (err: any) {
      console.error("[Store] Update order status failed:", err);
      return { status: 500, body: { error: err.message } };
    }
  },
});

export const storeHandler = app.route(
  "/",
  s.plugin(storeRouter, {
    logInitialization: true,
  })
);

// We define the webhook separately from ts-rest because webhooks require raw body parsing.
app.post("/webhook", async (c) => {
  const stripeKey = c.env.STRIPE_SECRET_KEY;
  const webhookSecret = c.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    return c.json({ error: "Stripe keys not configured" }, 500);
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-04-10" });
  const signature = c.req.header("stripe-signature");

  if (!signature) {
    return c.json({ error: "Missing stripe signature" }, 400);
  }

  try {
    const rawBody = await c.req.text();
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const db = c.get("db");

      const shippingDetails = session.shipping_details;

      const orderId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `order-${Date.now()}`;

      await db
        .insertInto("orders")
        .values({
          id: orderId,
          stripe_session_id: session.id,
          customer_email: session.customer_details?.email || null,
          shipping_name: shippingDetails?.name || null,
          shipping_address_line1: shippingDetails?.address?.line1 || null,
          shipping_address_line2: shippingDetails?.address?.line2 || null,
          shipping_city: shippingDetails?.address?.city || null,
          shipping_state: shippingDetails?.address?.state || null,
          shipping_postal_code: shippingDetails?.address?.postal_code || null,
          shipping_country: shippingDetails?.address?.country || null,
          total_cents: session.amount_total || 0,
          status: "paid",
          fulfillment_status: "unfulfilled",
        })
        .execute();
    }

    return c.json({ received: true }, 200);
  } catch (err: any) {
    console.error("[Store] Webhook error:", err);
    await logSystemError(c.get("db"), "Stripe Webhook", err.message);
    return c.json({ error: err.message }, 400);
  }
});

export default storeHandler;
