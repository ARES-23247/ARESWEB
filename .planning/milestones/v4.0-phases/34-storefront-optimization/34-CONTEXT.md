# Phase 34: Storefront Optimization

## Current State
The e-commerce storefront processes Stripe checkouts and webhooks successfully, writing to the `orders` table. However, it lacks robust inventory depletion (stock isn't reduced when an item is bought) and immediate notification capabilities when a new order is received. Previously, we considered Resend, but email has proven unreliable.

## Goals
1. **Inventory Management**: Update the D1 database and webhook handler so that `active` inventory (if tracked) or at least a theoretical stock column can be depleted. For now, since `products` doesn't seem to have a stock count, we should add `stock_count` integer to products schema.
2. **Order Notification**: Implement a Zulip webhook integration to send a notification to the admin stream whenever a new order is paid (`checkout.session.completed`).

## Requirements (from REQUIREMENTS.md)
- **STORE-01**: Webhooks must trigger database-level inventory depletion correctly.
- **STORE-02**: Paid orders must trigger an immediate Zulip stream notification.

## Implementation Details
1. Add `stock_count INTEGER` to `products` table schema if it doesn't exist, and update migrations.
2. In `createCheckoutSession`, pass `metadata.cartItems` (stringified array of product IDs and quantities).
3. In `webhook`, parse `metadata.cartItems`, iterate, and decrement `stock_count` in D1.
4. Implement a utility `sendZulipMessage(env, stream, topic, content)` that uses the Zulip REST API (`POST /api/v1/messages`).
5. Wire `sendZulipMessage` into the webhook after a successful order.
