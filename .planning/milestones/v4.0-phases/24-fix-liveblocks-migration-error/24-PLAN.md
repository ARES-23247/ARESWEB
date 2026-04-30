# Phase 24: Fix Liveblocks Migration Error - Plan

## Goal
Resolve duplicate column `content_draft` error in migration 048.

## Strategy
The `content_draft` columns are already included in the `schema.sql` file which acts as the source of truth. Therefore, when `048_liveblocks_state_persistence.sql` is run, it attempts to add columns that already exist.

### Steps
1. Modify `migrations/_archive/048_liveblocks_state_persistence.sql`.
2. Comment out `ALTER TABLE docs ADD COLUMN content_draft TEXT;`
3. Comment out `ALTER TABLE posts ADD COLUMN content_draft TEXT;`
4. Comment out `ALTER TABLE events ADD COLUMN content_draft TEXT;`
5. Verify `npx wrangler d1 migrations apply ares-db --local` passes.

## Verification
- Run wrangler migrations apply to ensure 0 errors.
