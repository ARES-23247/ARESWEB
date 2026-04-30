# Phase 30: Backend API (Hono) - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous workflow)

<domain>
## Phase Boundary

Build secure endpoints for product fetching, checkout sessions, and webhooks using the Hono API framework.
</domain>

<decisions>
## Implementation Decisions

### Autonomous Discretion
- **Routing:** Hono routes will be structured under `/api/store`.
- **Validation:** Use `zod` for parsing and validating the cart items before sending them to Stripe.
- **Stripe SDK:** Use the official `stripe` Node.js library, fetching it using the Cloudflare Worker environment variables.
- **Webhook Handling:** A separate `/api/store/webhook` endpoint will verify the signature via `stripe.webhooks.constructEvent` and write successful events to the D1 `orders` table.

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.
</code_context>

<specifics>
## Specific Ideas

No specific requirements — discuss phase resolved automatically.
</specifics>

<deferred>
## Deferred Ideas

None.
</deferred>
