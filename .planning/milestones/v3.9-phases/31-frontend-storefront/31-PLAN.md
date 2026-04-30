# Phase 31: Frontend Storefront (React) - Plan

## Strategy
1. **State Management:**
   - Create `src/store/useCartStore.ts` utilizing `zustand`.
   - Store an array of `{ product: Product, quantity: number }`.
   - Actions: `addItem`, `removeItem`, `updateQuantity`, `clearCart`, `cartOpen`, `setCartOpen`.
2. **Components:**
   - Create `src/components/store/ProductCard.tsx` (Display a product).
   - Create `src/components/store/CartDrawer.tsx` (Slide-out or modal view for the cart).
3. **Pages:**
   - Create `src/pages/Store.tsx`. Fetch products using `api.store.getProducts.useQuery()`. Map products to `ProductCard`. Include a "View Cart" button that opens `CartDrawer`.
4. **App Routing:**
   - Add `<Route path="/store" element={<Store />} />` in `src/App.tsx`.
   - Ensure a link exists in the navigation header (`src/components/Header.tsx` or similar, if applicable).

## Implementation Details
- To do checkout, the cart calls `api.store.createCheckoutSession.mutateAsync({ items: [...], successUrl: ..., cancelUrl: ... })`.
- On success, redirect to `res.body.url` via `window.location.href`.

## Execution
1. Create `useCartStore.ts`.
2. Create `CartDrawer.tsx`.
3. Create `Store.tsx`.
4. Update `App.tsx`.
