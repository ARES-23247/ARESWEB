/* eslint-disable @typescript-eslint/no-explicit-any -- ts-rest handler input validated by contract library */
import { ServerInferRequest } from "../../../shared/types/api";
import { Hono } from "hono";
import { createHonoEndpoints } from "ts-rest-hono";
import { storeContract } from "../../../shared/schemas/contracts/storeContract";
import { AppEnv, logSystemError, ensureAdmin, s } from "../middleware";
import Stripe from "stripe";
import { sendZulipMessage } from "../../utils/zulip";
import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import type { HonoContext } from "@shared/types/api";

const app = new Hono<AppEnv>();


// CR-04 FIX: Apply ensureAdmin middleware to orders routes
app.use("/orders", ensureAdmin);
app.use("/orders/*", ensureAdmin);

 
const storeHandlers: any = {
  getProducts: async (_input: ServerInferRequest<typeof storeContract["getProducts"]>, c: HonoContext) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const products = await db
        .selectFrom("products")
        .selectAll()
        .where("active", "=", 1)
        .execute();

      return {
        status: 200,
        body: products.map((p) => ({
          id: p.id || "",
          name: p.name || "Unknown Product",
          description: p.description || null,
          price_cents: p.price_cents || 0,
          image_url: p.image_url || null,
          active: p.active || 1,
          stock_count: p.stock_count ?? null,
          created_at: p.created_at || null,
        })),
      };
 
    } catch (err: any) {
      console.error("[Store] Get products failed:", err);
      return { status: 500, body: { error: err.message } };
    }
  },
 
  createCheckoutSession: async ({ body }: any, c: HonoContext) => {
    try {
      const { items, successUrl, cancelUrl } = body;
      const stripeKey = c.env.STRIPE_SECRET_KEY;
      if (!stripeKey) {
        throw new Error("STRIPE_SECRET_KEY is not configured.");
      }

 
      const stripe = new Stripe(stripeKey, { apiVersion: "2024-04-10" as any });
      const db = c.get("db") as Kysely<DB>;

      // Fetch product details
 
      const productIds = items.map((i: any) => i.productId);
      const products = await db
        .selectFrom("products")
        .selectAll()
        .where("id", "in", productIds)
        .where("active", "=", 1)
        .execute();

      const productMap = new Map(products.map((p) => [p.id, p]));

 
      const lineItems = items.map((item: any) => {
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
 
          cartItems: JSON.stringify(items.map((i: any) => ({ id: i.productId, q: i.quantity })))
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

      return {
        status: 200,
        body: {
          sessionId: session.id,
          url: session.url,
        },
      };
 
    } catch (err: any) {
      console.error("[Store] Checkout failed:", err);
      return { status: 500, body: { error: err.message } };
    }
  },
  // Extracted webhook handler below
  getOrders: async (_input: ServerInferRequest<typeof storeContract["getOrders"]>, c: HonoContext) => {
    try {
      await ensureAdmin(c, async () => {});
      const db = c.get("db") as Kysely<DB>;
      const orders = await db.selectFrom("orders").selectAll().orderBy("created_at", "desc").execute();
 
      return { status: 200, body: { orders: orders as any } };
 
    } catch (err: any) {
      return { status: 500, body: { error: err.message } };
    }
  },
 
  updateOrderStatus: async ({ params, body }: any, c: HonoContext) => {
    try {
      await ensureAdmin(c, async () => {});
      const db = c.get("db") as Kysely<DB>;
      await db.updateTable("orders").set({ status: body.status }).where("id", "=", params.id).execute();
      return { status: 200, body: { success: true } };
 
    } catch (err: any) {
      return { status: 500, body: { error: err.message } };
    }
  },
};

const storeTsRestRouter = s.router(storeContract, storeHandlers as any);

createHonoEndpoints(
  storeContract,
  storeTsRestRouter,
  app,
  {
    responseValidation: true,
    responseValidationErrorHandler: (err, _c) => {
      console.error('[Contract] Response validation failed:', err.cause);
      return { error: { message: 'Internal server error' }, status: 500 };
    }
  }
);

app.post("/webhook", async (c) => {
  try {
    const stripeKey = c.env.STRIPE_SECRET_KEY;
    const endpointSecret = c.env.STRIPE_WEBHOOK_SECRET;
    const signature = c.req.header("stripe-signature");

    if (!stripeKey || !endpointSecret || !signature) {
      return c.json({ error: "Missing stripe signature" }, 400);
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
 
    } catch (err: any) {
      console.error(`[Webhook] Signature verification failed: ${err.message}`);
      return c.json({ error: `Invalid signature` }, 400);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const db = c.get("db") as Kysely<DB>;

      // Fulfill order
      const metadata = session.metadata;
      const cartItems = metadata?.cartItems ? JSON.parse(metadata.cartItems) : [];

      await db
        .insertInto("orders")
        .values({
          id: session.id,
          stripe_session_id: session.id,
          customer_email: session.customer_details?.email || "unknown",
          shipping_name: (session as any).shipping_details?.name || null,
          total_cents: session.amount_total || 0,
          status: "paid",
          items_json: JSON.stringify(cartItems),
          created_at: new Date().toISOString(),
        } as any)
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
 
  } catch (err: any) {
    logSystemError(c.get("db") as Kysely<DB>, "webhook_error", err);
    return c.json({ error: "Webhook fulfillment failed" }, 500);
  }
});

export default app;


