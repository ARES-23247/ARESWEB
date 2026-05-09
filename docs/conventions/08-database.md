# Database Management

> D1 database schema, migrations, FTS5, and query patterns. Read before modifying tables or writing SQL.

## Schema Authority

**`schema.sql` is the single source of truth.** Can provision entire DB:
```bash
npx wrangler d1 execute ares-db --file=schema.sql --remote
```

## Dual-Update Rule

Every schema change MUST update BOTH:
1. Numbered migration file in `migrations/` (starts at `050`)
2. The `schema.sql` file

## Table Conventions

- **Content tables:** `TEXT PRIMARY KEY` with UUIDs/slugs
- **Join/history tables:** `INTEGER PRIMARY KEY AUTOINCREMENT`
- **Soft-delete:** `is_deleted INTEGER DEFAULT 0` (never `DELETE FROM`)
- **Timestamps:** `created_at TEXT DEFAULT (datetime('now'))`
- **DDL guards:** Always `IF NOT EXISTS` / `IF EXISTS`

## FTS5 Critical Rule

**NEVER filter on unindexed columns in FTS5.** Always JOIN to base table:

```sql
-- ❌ BROKEN — is_deleted not indexed in FTS
SELECT slug FROM docs_fts WHERE is_deleted = '0' AND docs_fts MATCH ?

-- ✅ CORRECT — JOIN for metadata filtering
SELECT f.slug FROM docs_fts f
JOIN docs d ON f.slug = d.slug
WHERE d.is_deleted = 0 AND f.docs_fts MATCH ?
```

## Indexing

Create indexes for: `WHERE` clauses, `ORDER BY`, `JOIN` conditions. Composite indexes for common patterns like `status + is_deleted`.

## Query Patterns

**Preferred:** Drizzle ORM for type safety
```typescript
await db.select().from(schema.posts).where(eq(schema.posts.slug, slug)).get();
```

**Raw SQL for:** FTS, complex aggregations, multi-table JOINs
```typescript
await db.run(sql`SELECT * FROM docs_fts WHERE docs_fts MATCH ${query}`);
```

## Deployment

Database name: **`ares-db`** (not aresweb-db)

```bash
# Test locally first
npx wrangler d1 execute ares-db --file=migrations/050_xxx.sql --local
# Apply to production
npx wrangler d1 execute ares-db --file=migrations/050_xxx.sql --remote
```
