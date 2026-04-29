# Phase 32: Admin Fulfillment Dashboard - Plan

## Strategy
1. **Backend Endpoints:**
   - Add `getOrders` to `shared/schemas/contracts/storeContract.ts`.
   - Add `updateOrderStatus` to `storeContract.ts`.
   - Implement these in `functions/api/routes/store.ts` protected by `ensureAdmin` or role check.
2. **Frontend UI:**
   - Create `src/pages/Dashboard/StoreOrders.tsx` (an internal dashboard page).
   - Fetch `api.store.getOrders.useQuery`.
   - Render a table showing order ID, Date, Customer Email, Shipping Address, Total, and Status.
   - Use `api.store.updateOrderStatus.useMutation` to toggle `fulfillment_status` between `fulfilled` and `unfulfilled`.
3. **Routing:**
   - Add the `StoreOrders` page to `src/pages/Dashboard/index.tsx`.

## Execution
1. Update `storeContract.ts`.
2. Update `store.ts` (API).
3. Create `StoreOrders.tsx`.
4. Register the route in Dashboard.
