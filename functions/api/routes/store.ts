import { ApiError } from "../middleware/errorHandler";
import { eq, desc, inArray } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { OpenAPIHono } from "@hono/zod-openapi";
import Stripe from "stripe";
import { sendZulipAlert } from "../../utils/zulipSync";
import {
  getProductsRoute,
  createCheckoutSessionRoute,
  getOrdersRoute,
  updateOrderStatusRoute,
} from "../../../shared/routes/store";
import { getDb, AppEnv, logSystemError, getSessionUser } from "../middleware";

export const storeRouter = new OpenAPIHono<AppEnv>();

// Webhook endpoint - remains as-is since it's not openapi()
storeRouter.post("/webhook", async (c) => {
    try {
      const stripeKey = c.env.STRIPE_SECRET_KEY;
      const endpointSecret = c.env.STRIPE_WEBHOOK_SECRET;
      const signature = c.req.header("stripe-signature");

      if (!stripeKey || !endpointSecret || !signature) {
        throw new ApiError("Missing stripe signature", 400);
      }

      const stripe = new Stripe(stripeKey);
      let event: Stripe.Event;

      try {
        const body = await c.req.text();
        event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret);
      } catch (err: unknown) {
        const error = err as Error;
        console.error("Webhook signature verification failed.", error.message);
        return c.text("Webhook Error", 400);
      }

      const db = getDb(c);

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata;

        if (metadata?.type === "STORE_ORDER" && metadata.orderId) {
          // Update order status in DB
          await db.update(schema.orders)
            .set({
              status: "paid",
              stripeSessionId: session.id,
              customerEmail: session.customer_details?.email,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              shippingName: (session as any).shipping_details?.name,
              updatedAt: new Date().toISOString()
            })
            .where(eq(schema.orders.id, metadata.orderId))
            .run();

          // Optional: Send to Zulip
          c.executionCtx.waitUntil(sendZulipAlert(
            c.env, 
            "System",
            "Store Order Paid",
            `New Paid Order: **${metadata.orderId}**\nTotal: ${session.amount_total ? session.amount_total / 100 : 0} ${session.currency}`
          ));
        }
      }

      return c.json({ received: true });
    } catch (err: unknown) {
      const db = getDb(c);
      const error = err as Error;
      await logSystemError(db, "stripe_webhook", error.message, error.stack);
      return c.text("Webhook Handler Error", 500);
    }
});

// Get products
storeRouter.openapi(getProductsRoute, async (c) => {
    const db = getDb(c);
    const products = await db.select().from(schema.products).where(eq(schema.products.active, 1)).all();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return c.json(products as any, 200);
});

// Create checkout session
storeRouter.openapi(createCheckoutSessionRoute, async (c) => {
    const body = c.req.valid("json");
    const { items, successUrl, cancelUrl } = body;
    const db = getDb(c);
    const stripeKey = c.env.STRIPE_SECRET_KEY;

    if (!stripeKey) {
      throw new ApiError("Stripe is not configured.", 500);
    }

    const stripe = new Stripe(stripeKey);

    // Fetch products to verify price
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const productIds = items.map((i: any) => i.productId);
    const dbProducts = await db.select().from(schema.products).where(inArray(schema.products.id, productIds)).all();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lineItems = items.map((item: any) => {
      const product = dbProducts.find(p => p.id === item.productId);
      if (!product) throw new ApiError(`Product not found: ${item.productId}`, 404);
      return {
        price_data: {
          currency: "usd",
          product_data: {
            name: product.name,
            description: product.description,
            images: product.imageUrl ? [product.imageUrl] : [],
          },
          unit_amount: product.priceCents,
        },
        quantity: item.quantity,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
    });

    const orderId = crypto.randomUUID();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        type: "STORE_ORDER",
        orderId,
      },
    });

    // Create pending order
    await db.insert(schema.orders).values({
      id: orderId,
      status: "pending",
      totalCents: session.amount_total || 0,
      stripeSessionId: session.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).run();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return c.json({ sessionId: session.id, url: session.url || "" } as any, 200);
});

// Get orders (admin only)
storeRouter.openapi(getOrdersRoute, async (c) => {
    const sessionUser = await getSessionUser(c);
    if (!sessionUser) throw new ApiError("Unauthorized", 401);
    if (sessionUser.role !== "admin") throw new ApiError("Forbidden", 403);
    const db = getDb(c);
    const orders = await db.select().from(schema.orders).orderBy(desc(schema.orders.createdAt)).all();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return c.json({ orders } as any, 200);
});

// Update order status (admin only)
storeRouter.openapi(updateOrderStatusRoute, async (c) => {
    const sessionUser = await getSessionUser(c);
    if (!sessionUser) throw new ApiError("Unauthorized", 401);
    if (sessionUser.role !== "admin") throw new ApiError("Forbidden", 403);
    const params = c.req.valid("param");
    const body = c.req.valid("json");
    const { id } = params;
    const { fulfillmentStatus } = body;
    const db = getDb(c);

    await db.update(schema.orders)
      .set({
        fulfillmentStatus,
        updatedAt: new Date().toISOString()
      })
      .where(eq(schema.orders.id, id))
      .run();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return c.json({ success: true } as any, 200);
});

export default storeRouter;
