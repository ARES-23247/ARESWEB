# Legacy calendar description repair

Some older event records stored serialized Tiptap JSON in `description`. The
application now renders these records safely, and this migration converts each
legacy value to readable plain text while retaining the exact original value in
`descriptionLegacyAst` for recovery.

The script defaults to a read-only page of 25 records. It accepts at most 100
records, orders by document ID, never advances automatically, and prints record
IDs rather than event content. Apply mode requires `--apply` and an exact
`--confirm-project` match. Each candidate is re-read in a transaction and is
skipped if it changed after the page was loaded.

## Operator procedure

Use Application Default Credentials. Never download or pass a service-account
JSON key.

1. Inspect a bounded production page:

   ```text
   node scripts/repair-event-descriptions.mjs --project aresfirst-portal --limit 25
   ```

2. Review `eligible`, `candidateIds`, and `nextCursor`. Dry-run mode performs no
   Firestore writes.
3. With explicit production-change approval, apply that same page:

   ```text
   node scripts/repair-event-descriptions.mjs --project aresfirst-portal --limit 25 --apply --confirm-project aresfirst-portal
   ```

4. Re-read the candidate records and verify `description`,
   `descriptionLegacyAst`, and `descriptionMigrationVersion: 1`.
5. If `scanned` equals the page limit, inspect the next page with
   `--after NEXT_CURSOR`; review it separately before applying it.

The migration is idempotent: repaired descriptions are no longer serialized AST
and therefore are not selected again. Restore a record by copying its preserved
`descriptionLegacyAst` value back to `description` if necessary.
