---
name: aresweb-database-management
description: Enforces ARESWEB Cloudflare D1 database management standards including schema authority, migration strategy, FTS5 query patterns, indexing conventions, and deployment procedures. Use this when creating or modifying database tables, writing SQL queries, or managing the D1 schema lifecycle.
---

# ARESWEB Database Management Standards

## 1. Schema Authority

### Single Source of Truth
The file `schema.sql` at the project root is the **authoritative, complete** database schema. It can provision a fully functional D1 database from scratch with a single command:

```bash
npx wrangler d1 execute ares-db --file=schema.sql --remote
```

### Migration Strategy
Historical migrations (001–049) have been consolidated into `schema.sql` and archived to `migrations/_archive/`. All future schema changes use numbered migration files starting at `050`:

```
schema.sql                    ← Always reflects the COMPLETE current schema
migrations/
  README.md                   ← Strategy documentation
  050_next_change.sql         ← Next post-launch migration
  _archive/                   ← Historical reference only, never re-run
```

### The Dual-Update Rule
**Every schema change MUST update TWO files:**
1. A new numbered migration file in `migrations/` (for applying to the live DB)
2. The `schema.sql` file (to keep it as the authoritative reference)

Failure to update both creates schema drift — the exact problem this consolidation solved.

---

## 2. D1 Table Conventions

### Primary Keys
- **Content tables** (posts, events, docs, comments, etc.): Use `TEXT PRIMARY KEY` with application-generated UUIDs/slugs
- **Join/history tables** (event_signups, posts_history, docs_history): Use `INTEGER PRIMARY KEY AUTOINCREMENT`
- **Better Auth tables** (user, session, account, verification): Managed by Better Auth — do not alter column names

### Required Guards
Always use `IF NOT EXISTS` / `IF EXISTS` in DDL statements:

```sql
-- ✅ Correct
CREATE TABLE IF NOT EXISTS my_table (...);
CREATE INDEX IF NOT EXISTS idx_my_table_col ON my_table(col);

-- ❌ Wrong — will fail if table exists
CREATE TABLE my_table (...);
```

### Soft-Delete Pattern
All user-facing content tables use soft-delete:
```sql
is_deleted INTEGER DEFAULT 0
```
**Never use `DELETE FROM` on content tables.** Use `UPDATE SET is_deleted = 1`.

### Timestamp Convention
All timestamps use ISO 8601 TEXT format via SQLite:
```sql
created_at TEXT DEFAULT (datetime('now'))
updated_at TEXT DEFAULT (datetime('now'))
```

---

## 3. FTS5 Virtual Tables — CRITICAL RULES

### The JOIN Rule (Non-Negotiable)
**NEVER filter on UNINDEXED columns directly in FTS5 queries.** Always JOIN back to the base table for metadata filtering.

```sql
-- ❌ BROKEN — is_deleted/status are UNINDEXED, filtering is unreliable
SELECT slug, title FROM docs_fts 
WHERE is_deleted = '0' AND status = 'published' AND docs_fts MATCH ?

-- ✅ CORRECT — JOIN to base table for metadata, FTS for text matching
SELECT f.slug, f.title FROM docs_fts f 
JOIN docs d ON f.slug = d.slug 
WHERE d.is_deleted = 0 AND d.status = 'published' AND f.docs_fts MATCH ?
ORDER BY f.rank LIMIT 20
```

This bug has been found and fixed twice in this codebase. Do not introduce it a third time.

### FTS Table Structure
Every FTS5 table must have:
1. A primary key column marked `UNINDEXED` (for JOIN back to base table)
2. Searchable text columns (title, description, content, etc.)
3. Metadata columns marked `UNINDEXED` (status, is_deleted, etc.)
4. **Three sync triggers**: INSERT, DELETE, UPDATE

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS example_fts USING fts5(
    id UNINDEXED,        -- Primary key, not searchable
    title,               -- Searchable
    description,         -- Searchable
    status UNINDEXED,    -- Metadata, not searchable
    is_deleted UNINDEXED -- Metadata, not searchable
);

-- All three triggers are MANDATORY
CREATE TRIGGER IF NOT EXISTS example_fts_insert AFTER INSERT ON example BEGIN ... END;
CREATE TRIGGER IF NOT EXISTS example_fts_delete AFTER DELETE ON example BEGIN ... END;
CREATE TRIGGER IF NOT EXISTS example_fts_update AFTER UPDATE ON example BEGIN ... END;
```

### Current FTS Tables
| FTS Table | Base Table | Join Column |
|-----------|-----------|-------------|
| `docs_fts` | `docs` | `slug` |
| `posts_fts` | `posts` | `slug` |
| `events_fts` | `events` | `id` |
| `user_profiles_fts` | `user_profiles` | `user_id` |

---

## 4. Indexing Strategy

### When to Create Indexes
Create an index when a column appears in:
- `WHERE` clauses (especially equality checks)
- `ORDER BY` clauses
- `JOIN` conditions (if not already a PRIMARY KEY)
### Composite Indexes
Use composite indexes for common filter patterns:
```sql
-- Common pattern: filter by status AND soft-delete together
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status, is_deleted);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status, is_deleted);
```

---

## 5. Schema Guard & Type Safety

### Rule: Generate Types After Every Schema Change
The ARES backend uses **Kysely** for type-safe database queries. Whenever you modify `schema.sql` or run a migration, you **MUST** run the type generator to synchronize the TypeScript interfaces.

```bash
npm run db:generate-types
```

### Rule: Preferred Query Builder
Never use raw `c.env.DB.prepare` strings for complex logic. Always use the `db` instance from Kysely. If you find a route using raw SQL, refactor it to Kysely during your next edit to ensure long-term "Championship" stability.

---

## 6. Deployment Procedures

idx_{table}_{column}     — Single column
idx_{table}_{col1}_{col2} — Composite (if clarity needed)
```

### Current Production Indexes
Refer to the `schema.sql` file for the complete list. Key indexes include:
- `idx_user_email` — Auth lookups
- `idx_posts_status`, `idx_events_status` — Public content filtering
- `idx_posts_date`, `idx_events_date` — Timeline ordering
- `idx_signups_event`, `idx_signups_user` — Event participation
- `idx_notifications_user_id` — Per-user notification queries
- `idx_comments_target` — Comment threading

---

## 5. Deployment Procedures

### Database Name
The production D1 database is named **`ares-db`** (NOT `aresweb-db`):
```bash
npx wrangler d1 execute ares-db --file=<migration_file> --remote
```

### Deployment Checklist
1. Write the migration SQL file
2. **Test locally first**: `npx wrangler d1 execute ares-db --file=migrations/050_xxx.sql --local`
3. **Apply to production**: `npx wrangler d1 execute ares-db --file=migrations/050_xxx.sql --remote`
4. **Update schema.sql** to reflect the change
5. **Commit both files** in the same commit

### Verifying Live Schema
```bash
# List all tables
npx wrangler d1 execute ares-db --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name" --remote

# Check table columns
npx wrangler d1 execute ares-db --command="PRAGMA table_info(posts)" --remote

# Check indexes
npx wrangler d1 execute ares-db --command="SELECT name, tbl_name FROM sqlite_master WHERE type='index' ORDER BY tbl_name" --remote
```

---

## 6. Security Rules

### Settings Masking
The `GET /api/admin/settings` endpoint masks sensitive infrastructure keys. The `SENSITIVE_KEYS` array in `settings.ts` must be updated when new secrets are added:

```typescript
const SENSITIVE_KEYS = [
  "ENCRYPTION_SECRET", "BETTER_AUTH_SECRET", "GITHUB_CLIENT_SECRET",
  "GOOGLE_CLIENT_SECRET", "DISCORD_CLIENT_SECRET", "CLOUDFLARE_API_TOKEN",
  "R2_ACCESS_KEY_ID", "R2_SECRET_KEY", "ZULIP_API_KEY",
  "GITHUB_WEBHOOK_SECRET", "TURNSTILE_SECRET_KEY", "TBA_API_KEY",
  "GOOGLE_SERVICE_KEY", "BSKY_PASSWORD"
];
```

### Query Parameterization
**Always use parameterized queries.** Never interpolate user input into SQL strings.

**Kysely (PREFERRED):** Use **Kysely** for all complex queries and mutations. It provides full TypeScript autocomplete for the `schema.sql` structure and prevents SQL injection by design.

```typescript
// ✅ Kysely Example
await db.selectFrom("posts")
  .selectAll()
  .where("slug", "=", slug)
  .executeTakeFirst();
```

**D1 Raw (Fallback):** Only use `c.env.DB.prepare()` for simple, low-logic queries or where Kysely overhead is not justified.

```typescript
// ✅ Correct (Raw Fallback)
c.env.DB.prepare("SELECT * FROM posts WHERE slug = ?").bind(slug)

// ❌ SQL Injection vulnerability
c.env.DB.prepare(`SELECT * FROM posts WHERE slug = '${slug}'`)
```
