# Requirements

**Coverage:** 0 / 12 requirements satisfied

| REQ-ID | Description | Phase | Status |
|--------|-------------|-------|--------|
| STRIPE-01 | Stripe Secret Keys Configuration | 29 | [ ] |
| STRIPE-02 | D1 E-Commerce Schema (products, orders) | 29 | [ ] |
| STRIPE-03 | Fetch Active Inventory API | 30 | [ ] |
| STRIPE-04 | Generate Stripe Checkout Session API | 30 | [ ] |
| STRIPE-05 | Stripe Webhook Listener & Signature Verification | 30 | [ ] |
| STORE-01 | Storefront UI Grid (ARES Brand) | 31 | [ ] |
| STORE-02 | Shopping Cart State (Multi-item) | 31 | [ ] |
| STORE-03 | Add/Remove Cart Items & Calculate Totals | 31 | [ ] |
| ADMIN-01 | Order Tracking Dashboard UI | 32 | [ ] |
| ADMIN-02 | Fulfill/Ship Order Toggle | 32 | [ ] |

## Detailed Requirements

### [ ] STRIPE-01: Stripe Secret Keys Configuration
Configure Cloudflare bindings for `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
- **[ ] AC-1**: Keys are securely handled via Cloudflare environment variables and never exposed to the client.

### [ ] STRIPE-02: D1 E-Commerce Schema
Create SQL tables to manage physical merchandise.
- **[ ] AC-1**: `products` table tracks id, name, description, price, image_url, and active status.
- **[ ] AC-2**: `orders` table tracks stripe_session_id, customer email, shipping address, total amount, and fulfillment status.

### [ ] STRIPE-03: Fetch Active Inventory API
Create a `ts-rest` Hono endpoint `GET /api/store/products`.
- **[ ] AC-1**: Returns only `active = 1` products to the frontend.

### [ ] STRIPE-04: Generate Stripe Checkout Session API
Create `POST /api/store/checkout` to build Stripe hosted checkout sessions.
- **[ ] AC-1**: Accepts an array of product IDs and quantities (the cart).
- **[ ] AC-2**: Requires shipping address collection natively via Stripe Checkout.
- **[ ] AC-3**: Returns the Stripe Checkout URL for frontend redirect.

### [ ] STRIPE-05: Stripe Webhook Listener
Create `POST /api/store/webhook` to asynchronously confirm payments.
- **[ ] AC-1**: Verifies Stripe webhook signatures.
- **[ ] AC-2**: On `checkout.session.completed`, inserts a new row into the `orders` table with the shipping address and marks it as paid.

### [ ] STORE-01: Storefront UI Grid
Create `src/pages/Store.tsx` to display merchandise.
- **[ ] AC-1**: Fully responsive grid layout adhering to ARESFIRST brand standards.

### [ ] STORE-02: Shopping Cart State
Implement a client-side shopping cart.
- **[ ] AC-1**: Cart persists across page loads (using `zustand` with `persist` or `localStorage`).

### [ ] STORE-03: Add/Remove Cart Items & Calculate Totals
Cart UI functionality.
- **[ ] AC-1**: Users can add items, increment/decrement quantities, and remove items.
- **[ ] AC-2**: Cart modal/sidebar calculates the exact subtotal.

### [ ] ADMIN-01: Order Tracking Dashboard UI
Build an admin panel for tracking incoming physical orders.
- **[ ] AC-1**: Accessible only to roles with `admin` or specific `store_manager` privileges.
- **[ ] AC-2**: Displays a table of orders with their shipping addresses.

### [ ] ADMIN-02: Fulfill/Ship Order Toggle
Provide operations for order fulfillment.
- **[ ] AC-1**: Admins can mark an order as "Shipped" or "Fulfilled", updating the D1 table.
