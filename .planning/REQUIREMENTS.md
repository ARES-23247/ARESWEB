# Requirements

**Coverage:** 0 / 12 requirements satisfied

| REQ-ID | Description | Phase | Status |
|--------|-------------|-------|--------|
| STRIPE-01 | Stripe Secret Keys Configuration | 29 | [x] |
| STRIPE-02 | D1 E-Commerce Schema (products, orders) | 29 | [x] |
| STRIPE-03 | Fetch Active Inventory API | 30 | [x] |
| STRIPE-04 | Generate Stripe Checkout Session API | 30 | [x] |
| STRIPE-05 | Stripe Webhook Listener & Signature Verification | 30 | [x] |
| STORE-01 | Storefront UI Grid (ARES Brand) | 31 | [x] |
| STORE-02 | Shopping Cart State (Multi-item) | 31 | [x] |
| STORE-03 | Add/Remove Cart Items & Calculate Totals | 31 | [x] |
| ADMIN-01 | Order Tracking Dashboard UI | 32 | [ ] |
| ADMIN-02 | Fulfill/Ship Order Toggle | 32 | [ ] |

## Detailed Requirements

### [x] STRIPE-01: Stripe Secret Keys Configuration
Configure Cloudflare bindings for `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
- **[x] AC-1**: Keys are securely handled via Cloudflare environment variables and never exposed to the client.

### [x] STRIPE-02: D1 E-Commerce Schema
Create SQL tables to manage physical merchandise.
- **[x] AC-1**: `products` table tracks id, name, description, price, image_url, and active status.
- **[x] AC-2**: `orders` table tracks stripe_session_id, customer email, shipping address, total amount, and fulfillment status.

### [x] STRIPE-03: Fetch Active Inventory API
Create a `ts-rest` Hono endpoint `GET /api/store/products`.
- **[x] AC-1**: Selects all products where `active = 1`.
- **[x] AC-2**: Exposes id, name, description, price, and image.

### [x] STRIPE-04: Generate Stripe Checkout Session API
Create a `POST /api/store/checkout` endpoint.
- **[x] AC-1**: Accepts a list of product IDs and quantities.
- **[x] AC-2**: Cross-references product IDs against the D1 database to pull authentic prices (prevents client-side price spoofing).
- **[x] AC-3**: Generates a Stripe Checkout Session URL and returns it to the client.

### [x] STRIPE-05: Stripe Webhook Listener & Signature Verification
Create a raw Hono endpoint `POST /api/store/webhook` to listen to Stripe events.
- **[x] AC-1**: Validates `stripe-signature` using the official SDK.
- **[x] AC-2**: On `checkout.session.completed`, inserts a new row into the `orders` D1 table with the customer's email and shipping address and marks it as paid.

### [x] STORE-01: Storefront UI Grid
Create `src/pages/Store.tsx` to display merchandise.
- **[x] AC-1**: Implements a responsive grid of `ProductCard` components.
- **[x] AC-2**: Fetches `GET /api/store/products` using `@ts-rest/react-query`.
- **[x] AC-3**: Matches ARES branding standards (obsidian background, gold accents).

### [x] STORE-02: Shopping Cart State
Implement robust cart state management via Zustand.
- **[x] AC-1**: Uses `src/store/useCartStore.ts` to manage cart state.
- **[x] AC-2**: Persists cart data to `localStorage` to prevent loss on refresh.
- **[x] AC-3**: Cart supports identical item grouping (quantity incrementing).

### [x] STORE-03: Add/Remove Cart Items & Calculate Totals
Build the cart interface (`CartDrawer.tsx`).
- **[x] AC-1**: Allows users to remove items or update item quantity.
- **[x] AC-2**: Dynamically calculates and displays the cart total in USD.
- **[x] AC-3**: The checkout button calls `POST /api/store/checkout` and redirects to the generated `url`.

### [ ] ADMIN-01: Order Tracking Dashboard UI
Build an admin panel for tracking incoming physical orders.
- **[ ] AC-1**: Accessible only to roles with `admin` or specific `store_manager` privileges.
- **[ ] AC-2**: Displays a table of orders with their shipping addresses.

### [ ] ADMIN-02: Fulfill/Ship Order Toggle
Provide operations for order fulfillment.
- **[ ] AC-1**: Admins can mark an order as "Shipped" or "Fulfilled", updating the D1 table.
