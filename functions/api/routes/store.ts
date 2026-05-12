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
import { getDb, AppEnv, typedJson } from "../middleware";
import { requireAuth } from "../middleware/auth";

const _storeRouter = new OpenAPIHono<AppEnv>();

// Webhook endpoint - remains as-is since it's not openapi()
_storeRouter.post("/webhook", async (c) => {
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
                    shippingName: (session as unknown as { shipping_details?: { name?: string | null } }).shipping_details?.name,
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
});

// Get products
export const storeRouter = _storeRouter
    .openapi(getProductsRoute, async (c) => {
        const db = getDb(c);
        const products = await db.select().from(schema.products).where(eq(schema.products.active, 1)).all();
        return typedJson(c, products, 200);
    })
    .openapi(createCheckoutSessionRoute, async (c) => {
        const body = c.req.valid("json");
        const { items, successUrl, cancelUrl } = body;
        const db = getDb(c);
        const stripeKey = c.env.STRIPE_SECRET_KEY;

        if (!stripeKey) {
            throw new ApiError("Stripe is not configured.", 500);
        }

        const stripe = new Stripe(stripeKey);

        // Fetch products to verify price
        const productIds = items.map((i: { productId: string; quantity: number }) => i.productId);
        const dbProducts = await db.select().from(schema.products).where(inArray(schema.products.id, productIds)).all();

        const lineItems = items.map((item: { productId: string; quantity: number }) => {
            const product = dbProducts.find(p => p.id === item.productId);
            if (!product) throw new ApiError(`Product not found: ${item.productId}`, 404);
            return {
                price_data: {
                    currency: "usd",
                    product_data: {
                        name: product.name,
                        description: product.description || undefined,
                        images: product.imageUrl ? [product.imageUrl] : [],
                    },
                    unit_amount: product.priceCents,
                },
                quantity: item.quantity,
            };
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

        // Response boundary: Drizzle return type diverges from Zod schema
        return typedJson(c, { sessionId: session.id, url: session.url || "" }, 200);
    })
    .openapi(getOrdersRoute, async (c) => {
        const sessionUser = await requireAuth(c);
        if (sessionUser.role !== "admin") throw new ApiError("Forbidden", 403);
        const db = getDb(c);
        const orders = await db.select().from(schema.orders).orderBy(desc(schema.orders.createdAt)).all();
        // Response boundary: Drizzle return type diverges from Zod schema
        return typedJson(c, { orders }, 200);
    })
    .openapi(updateOrderStatusRoute, async (c) => {
        const sessionUser = await requireAuth(c);
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

        // Response boundary: Drizzle return type diverges from Zod schema
        return typedJson(c, { success: true }, 200);
    });
// Create checkout session
// Get orders (admin only)
// Update order status (admin only)
export default storeRouter;
