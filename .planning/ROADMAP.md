# Proposed Roadmap

**4 phases** | **10 requirements mapped**

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 29 | Database & Stripe Configuration | Initialize D1 schemas and Cloudflare Stripe bindings. | STRIPE-01, STRIPE-02 | [x] `schema.sql` migrations pass and secret bindings are active. |
| 30 | Backend API (Hono) | Build secure endpoints for product fetching, checkout sessions, and webhooks. | STRIPE-03, STRIPE-04, STRIPE-05 | [x] Webhook correctly parses Stripe signatures and `orders` row is created. |
| 31 | Frontend Storefront (React) | Build the `/store` UI and cart state management. | STORE-01, STORE-02, STORE-03 | [x] User can browse inventory, add items to cart, and redirect to Stripe Checkout. |
| 32 | Admin Fulfillment Dashboard | Build an internal panel for tracking and shipping physical orders. | ADMIN-01, ADMIN-02 | Admins can view orders, see shipping addresses, and toggle fulfillment status. |

### Archived Milestones
- [v3.8 - Database Audit & Bug Fixes](milestones/v3.8-ROADMAP.md)
- [v3.7 - UI Polish & CSS Linting](milestones/v3.7-ROADMAP.md)
- [v3.6 - Collaboration Polish & UI Fixes](milestones/v3.6-ROADMAP.md)
- [v3.5 - Version Control & Contributor Attribution](milestones/v3.5-ROADMAP.md)
