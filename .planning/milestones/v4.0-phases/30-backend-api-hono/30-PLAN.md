# Phase 30: Backend API (Hono) - Plan

## Strategy
1. **Contract Definition:** Create `shared/schemas/contracts/storeContract.ts`.
   - `GET /api/store/products` (Fetch active inventory).
   - `POST /api/store/checkout` (Generate Stripe Checkout session).
   - `POST /api/store/webhook` (Stripe Webhook Listener).
2. **Contract Export:** Export the `storeContract` in `shared/schemas/contracts/index.ts`.
3. **Database Types:** Define `Product` and `Order` types in `shared/schemas/database.ts`.
4. **Backend Implementation:** Create `functions/api/routes/store.ts` implementing the contract using `ts-rest` and Stripe SDK.
5. **Route Mounting:** Mount the `storeRouter` in `functions/api/index.ts`.
6. **Environment Variables:** Update `Bindings` in `functions/api/middleware/utils.ts` to include `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.

## Dependencies
- Install `stripe` package via npm to get official typings and Webhook signature verification utility. (Ah wait, we are in Cloudflare workers, we just use `stripe` sdk if installed, let's check `package.json` to see if `stripe` is installed).

## Execution Steps
- Verify `stripe` is in `package.json`. If not, `npm install stripe`.
- Update `database.ts` with new tables.
- Create `storeContract.ts`.
- Update `index.ts`.
- Update `utils.ts` (Bindings).
- Create `store.ts` router.
- Update `functions/api/index.ts`.
