# ARESWEB Database Migrations

## Current State

As of launch, all historical migrations (001 through 049) have been **consolidated** into the root `schema.sql` file, which serves as the **single source of truth** for the complete database schema.

The archived migrations are preserved in `_archive/` for historical reference only. **Do not run them** — they are superseded by `schema.sql`.

## Fresh Deployment

To set up a new D1 database from scratch:

```bash
wrangler d1 execute aresweb-db --file=schema.sql --remote
```

## Creating New Migrations (Post-Launch)

Once the site is live with production data, use numbered migration files for all schema changes:

1. **Create a new file** in this directory: `050_description.sql`, `051_description.sql`, etc.
2. **Apply it** to production: `wrangler d1 execute aresweb-db --file=migrations/050_description.sql --remote`
3. **Update `schema.sql`** to reflect the change (keep it as the authoritative reference).

### Migration Rules

- **Never modify existing columns** — use `ALTER TABLE ADD COLUMN` for new fields
- **Always use `IF NOT EXISTS`** / `IF EXISTS` guards for safety
- **Never DROP production tables** — use soft-delete patterns
- **Test locally first** with `wrangler d1 execute aresweb-db --file=... --local`
- **Document the purpose** with a comment header in each migration file
