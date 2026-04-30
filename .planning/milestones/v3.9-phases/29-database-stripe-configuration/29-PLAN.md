# Phase 29: Database & Stripe Configuration - Plan

## Strategy
1. **Schema Modifications:** Append `products` and `orders` tables to `schema.sql`.
2. **Migration Generation:** Generate a new D1 migration from `schema.sql`.
3. **Migration Application:** Apply the migration locally.
4. **Wrangler Configuration:** Add Cloudflare KV or Secrets bindings for Stripe (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`). We'll add placeholder configurations to `wrangler.toml` for the types.

## Files to modify
- `schema.sql`: Add `products` and `orders`.
- `wrangler.toml`: Optional, add type bindings if necessary (usually secrets are managed externally, but we will add `[vars]` placeholders).
- Generate a migration file via `npx wrangler d1 migrations create ares-db e-commerce-store`.

## Execution
- Modify `schema.sql`.
- Run `npx wrangler d1 migrations create ares-db e-commerce-store`.
- Output `schema.sql` contents into the migration file.
- Apply migration: `npx wrangler d1 migrations apply ares-db --local`.
