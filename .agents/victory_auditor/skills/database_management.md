# ARESWEB Database Management Standards

## 1. Schema Authority

### 🎯 Primary Source of Truth: Drizzle ORM
The authoritative definition of the database schema resides in **`src/db/schema.ts`**. This TypeScript file defines the structure, relationships, and types for the entire D1 database. All schema changes MUST originate here.

### Secondary Reference: `schema.sql`
The `schema.sql` file at the project root serves as a point-in-time reference for provisioning a database from scratch using raw SQL. While useful for rapid provisioning, it is **downstream** of the Drizzle schema.

### Migration Strategy
All schema changes must be applied via Drizzle migrations:
1. **Edit** `src/db/schema.ts`
2. **Generate** migration: `npm run db:generate`
3. **Apply** locally: `npm run db:push`
4. **Apply** remotely: `npx wrangler d1 execute ares-db --file=drizzle/xxxx_name.sql --remote`
5. **Sync** `schema.sql`: Update the reference SQL file with the new structure.

Failure to follow this chain breaks the type safety of the entire application.

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

## 5. Schema Guard & Type Safety — DRIZZLE-FIRST WORKFLOW

### 🎯 Golden Rule: Drizzle is the Single Source of Truth

**ALL database schema changes MUST start in `src/db/schema.ts`.** This file:
1. Defines all tables with TypeScript types.
2. Drives the dynamic Zod bridge in `shared/db/schema-zod.ts`.
3. Ensures OpenAPI response schemas remain synchronized.

### The Auto-Generated Schema Chain

```
src/db/schema.ts (YOU EDIT HERE)
         ↓
    [TypeScript Inference]
         ↓
┌─────────────────────────────────────────────────────────┐
│  shared/db/schema-zod.ts (THE BRIDGE)                   │
│  - uses createInsertSchema / createSelectSchema        │
│  - automatically picks up column changes                │
│  - Manual update required ONLY for new tables           │
└─────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────┐
│  shared/routes/*.ts (OPENAPI CONTRACTS)                 │
│  - Import selectXSchema from @shared/db/schema-zod      │
│  - Drizzle fields auto-propagate to API documentation   │
└─────────────────────────────────────────────────────────┘
```

### 🚫 DEPRECATED: `kysely-codegen`
The legacy workflow using `scripts/generate-types.js` and `shared/schemas/database.ts` is **DEPRECATED**. Do not use these files or run the `db:generate-types` script. Type safety is now handled entirely through Drizzle and Zod.

---

### Example: Adding a New Column

```typescript
// ✅ CORRECT: Edit drizzle/schema.ts
export const posts = sqliteTable("posts", {
  slug: text().primaryKey(),
  title: text().notNull(),
  // NEW COLUMN:
  viewCount: integer("view_count").default(0).notNull(),
});
```

After running `npm run db:generate`:
- `insertPostSchema` and `selectPostSchema` in `shared/db/schema-zod.ts` automatically include `viewCount`
- Route files that use `selectPostSchema` automatically get the new field
- No manual schema updates needed anywhere!

### Example: Using Auto-Generated Schemas in Routes

```typescript
// shared/routes/posts.ts
import { selectPostSchema } from "@shared/db/schema-zod";
import { toCamelCaseResponse, createResponseSchema } from "@shared/db/schema-openapi";

// ✅ Derive from Drizzle — Single source of truth!
export const postResponseSchema = toCamelCaseResponse(
  selectPostSchema.pick({
    slug: true,
    title: true,
    viewCount: true,  // Auto-included from Drizzle!
  })
);

export const getPostRoute = createRoute({
  method: "get",
  path: "/{slug}",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ post: postResponseSchema }),
        },
      },
    },
  },
});
```

### Rule: Preferred Query Builder
Never use raw `c.env.DB.prepare` strings for complex logic. Always use the `db` instance from Drizzle ORM. If you find a route using raw SQL, refactor it to Drizzle during your next edit to ensure long-term "Championship" stability.

```typescript
// ✅ Drizzle ORM Example
await db.select().from(schema.posts).where(eq(schema.posts.slug, slug)).get();
```

**Raw SQL (for complex queries):** For complex aggregations, FTS search, or multi-table JOINs, use `db.run(sql...)`:

```typescript
// ✅ Correct (Raw SQL for FTS)
await db.run(sql<{ slug: string; title: string }>`
  SELECT f.slug, f.title FROM docs_fts f
  JOIN docs d ON f.slug = d.slug
  WHERE d.is_deleted = 0 AND f.docs_fts MATCH ${searchQuery}
  LIMIT 20
`);
```

---

## 6. Deployment Procedures

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

**Drizzle ORM (PREFERRED):** Use **Drizzle ORM** for all standard queries and mutations. It provides full TypeScript autocomplete and prevents SQL injection by design.

```typescript
// ✅ Drizzle ORM Example
await db.select().from(schema.posts).where(eq(schema.posts.slug, slug)).get();
```

**Raw SQL (for complex queries):** For complex aggregations, FTS search, or multi-table JOINs, use `db.run(sql...)` with proper parameterization:

```typescript
// ✅ Correct (Raw SQL for FTS)
await db.run(sql`SELECT * FROM posts_fts WHERE posts_fts MATCH ${searchQuery}`);

-- ❌ SQL Injection vulnerability
await db.run(sql`SELECT * FROM posts WHERE slug = '${slug}'` -- NEVER DO THIS
```
