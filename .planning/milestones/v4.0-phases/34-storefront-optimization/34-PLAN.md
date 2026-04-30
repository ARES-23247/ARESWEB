# Phase 34: Storefront Optimization - Plan

## Step 1: Database Schema Expansion
1. Create a new migration file (e.g. `0005_add_stock_count_to_products.sql`).
2. Add `stock_count INTEGER DEFAULT 100` to the `products` table.
3. Update `shared/schemas/database.ts` to reflect `stock_count: number | null` or `number` in the `ProductsTable`.

## Step 2: Store Route Cart Metadata
1. Modify `functions/api/routes/store.ts` (`createCheckoutSession`).
2. Map the `items` payload into `metadata.cartItems` using `JSON.stringify` inside the Stripe session creation.
3. Update `functions/api/routes/store.test.ts` to mock or expect this metadata.

## Step 3: Zulip Integration
1. Create `functions/utils/zulip.ts` exporting `sendZulipMessage(env: AppEnv, stream: string, topic: string, content: string)`.
2. Ensure it utilizes `env.ZULIP_URL`, `env.ZULIP_EMAIL`, and `env.ZULIP_API_KEY`.
3. Add tests in `functions/utils/zulip.test.ts` to mock the `fetch` call and verify behavior.

## Step 4: Webhook Handler Update
1. Modify the `checkout.session.completed` block in `store.ts`.
2. Parse `session.metadata.cartItems`.
3. For each item, update the `products` table, decrementing `stock_count` by the quantity.
4. Call `sendZulipMessage` with order details (email, total amount, items).

## Step 5: Verification
1. Run local tests (`npm run test`) to ensure everything passes.
2. Mark STORE-01 and STORE-02 as completed.
