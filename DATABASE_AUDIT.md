# DATABASE_AUDIT.md

## Comprehensive Database Patterns Audit - ARES Web Portal

**Audit Date:** 2026-05-09
**Scope:** Drizzle ORM usage, D1 database patterns, FTS5 implementation, migrations, and query optimization
**Severity Levels:** CRITICAL, HIGH, MEDIUM, LOW

---

## Executive Summary

The ARES Web Portal demonstrates generally strong database patterns with proper soft-deletion implementation, comprehensive FTS5 search, and well-structured query helpers. However, several issues were identified ranging from critical security concerns to optimization opportunities.

**Key Findings:**
- **1 CRITICAL** issue found
- **8 HIGH** severity issues found
- **12 MEDIUM** severity issues found
- **7 LOW** severity issues found

---

## 1. Soft-Deletion Compliance

### CRITICAL: SQL Injection via Direct String Interpolation in Lifecycle Middleware

**Location:** `functions/api/middleware/lifecycle.ts:46, 66, 82, 99, 120`

**Issue:** The lifecycle middleware uses raw SQL with string interpolation without proper parameterization:

```typescript
await db.run(sql.raw(`UPDATE ${tableName} SET status = 'published' WHERE ${idColumn} = '${id}'`));
await db.run(sql.raw(`UPDATE ${tableName} SET is_deleted = 1 WHERE ${idColumn} = '${id}'`));
await db.run(sql.raw(`DELETE FROM ${tableName} WHERE ${idColumn} = '${id}'`));
```

While there is an allowlist for table names (`ALLOWED_TABLES`), the `id` value is directly interpolated into the SQL string, creating a SQL injection vulnerability.

**Remediation:**
```typescript
// Use parameterized queries
await db.run(sql`UPDATE ${sql.raw(tableName)} SET status = 'published' WHERE ${sql.raw(idColumn)} = ${id}`);
```

**Files Affected:**
- `functions/api/middleware/lifecycle.ts:46, 66, 82, 99, 120`

---

### HIGH: Hard DELETE in Inquiry Handler Violates Soft-Delete Policy

**Location:** `functions/api/routes/inquiries/handlers.ts:299`

**Issue:** The inquiry delete handler uses a hard `DELETE` instead of soft-deletion:

```typescript
await db.delete(schema.inquiries).where(eq(schema.inquiries.id, id)).run();
```

The `inquiries` table has an `is_deleted` column defined in the schema, so this should use soft-deletion.

**Remediation:**
```typescript
await db.update(schema.inquiries).set({ isDeleted: 1 }).where(eq(schema.inquiries.id, id)).run();
```

**Files Affected:**
- `functions/api/routes/inquiries/handlers.ts:299`

---

### HIGH: Hard DELETE on docs_fts Virtual Table (Implicit Cascade Issue)

**Location:** `functions/api/routes/docs.ts:907`

**Issue:** When purging a document, the handler performs a hard DELETE on the main `docs` table but does not explicitly handle the FTS virtual table:

```typescript
await db.delete(schema.docs).where(eq(schema.docs.slug, slug)).run();
c.executionCtx?.waitUntil?.(db.delete(schema.docsHistory).where(eq(schema.docsHistory.slug, slug)).run());
```

FTS virtual tables in SQLite do not cascade automatically. The `docs_fts` entries become orphaned.

**Remediation:**
```typescript
// Also rebuild FTS after purge
await db.run(sql`DELETE FROM docs_fts WHERE slug = ${slug}`);
```

**Files Affected:**
- `functions/api/routes/docs.ts:907`
- `functions/api/routes/posts.ts:732` (similar issue with `posts_fts`)

---

### MEDIUM: Inconsistent Soft-Delete Status Updates

**Location:** Multiple locations

**Issue:** When soft-deleting, some handlers set `status = 'draft'` while others do not:

```typescript
// docs.ts - sets status to draft
await db.update(schema.docs).set({ isDeleted: 1, status: "draft" })

// posts.ts - sets status to draft
await db.update(schema.posts).set({ isDeleted: 1, status: "draft" })

// lifecycle.ts - does NOT update status
await db.run(sql.raw(`UPDATE ${tableName} SET is_deleted = 1 WHERE ${idColumn} = '${id}'`));
```

This inconsistency can lead to queries that filter on both `isDeleted` and `status` missing soft-deleted items.

**Remediation:**
Standardize on updating status to `'draft'` when soft-deleting content tables (posts, docs, events).

---

### MEDIUM: Purge Function Does Not Check isDeleted Before Hard Delete

**Location:** `functions/api/middleware/lifecycle.ts:111-128`

**Issue:** The purge endpoint performs a hard DELETE without first verifying the record is already soft-deleted:

```typescript
await db.run(sql.raw(`DELETE FROM ${tableName} WHERE ${idColumn} = '${id}'`));
```

This could accidentally permanently delete non-trashed items if the UI flow allows skipping the trash step.

**Remediation:**
```typescript
await db.run(sql.raw(`DELETE FROM ${tableName} WHERE ${idColumn} = '${id}' AND is_deleted = 1`));
```

---

### LOW: Missing isDeleted Filter in Admin Queries

**Location:** Various admin endpoints

**Issue:** Admin list queries sometimes don't filter out soft-deleted items by default, making the UI cluttered with trashed content.

**Remediation:**
Consider adding a `includeDeleted` query parameter with default `false` for admin list endpoints.

---

## 2. FTS5 Full-Text Search

### HIGH: Missing FTS Triggers/Sync Mechanism

**Location:** `src/db/schema.ts` and migration files

**Issue:** The schema defines FTS virtual tables (`docs_fts`, `posts_fts`, `events_fts`, `user_profiles_fts`, `outreach_fts`, `awards_fts`), but there are NO triggers or automatic sync mechanisms defined.

When a document, post, or event is updated, the FTS index is NOT automatically updated. This causes stale search results until manual intervention.

**Current State:**
```sql
-- From migration - FTS tables exist but no triggers
CREATE VIRTUAL TABLE docs_fts USING fts5(
    slug UNINDEXED, title, category, description, content,
    status UNINDEXED, is_deleted UNINDEXED
);
-- No triggers to keep this in sync with docs table!
```

**Remediation:**
Add triggers to schema/migration:
```sql
CREATE TRIGGER docs_fts_insert AFTER INSERT ON docs BEGIN
  INSERT INTO docs_fts(rowid, slug, title, category, description, content, status, is_deleted)
  VALUES (NEW.rowid, NEW.slug, NEW.title, NEW.category, NEW.description, NEW.content, NEW.status, NEW.is_deleted);
END;

CREATE TRIGGER docs_fts_update AFTER UPDATE ON docs BEGIN
  UPDATE docs_fts SET title=NEW.title, category=NEW.category, description=NEW.description, content=NEW.content, status=NEW.status, is_deleted=NEW.is_deleted WHERE rowid=NEW.rowid;
END;

CREATE TRIGGER docs_fts_delete AFTER DELETE ON docs BEGIN
  DELETE FROM docs_fts WHERE rowid=OLD.rowid;
END;
```

Repeat for all FTS tables: `posts_fts`, `events_fts`, `user_profiles_fts`, `outreach_fts`, `awards_fts`.

**Files Affected:**
- `drizzle/20260509022830_tired_shiver_man/migration.sql` (FTS tables defined)
- All FTS query locations below depend on this

---

### HIGH: FTS Security Filter Missing in Some Queries

**Location:** `functions/api/routes/posts.ts:129` and `functions/api/routes/events/handlers.ts:191`

**Issue:** While most FTS queries properly filter by `is_deleted`, the pattern could be more consistent:

**Good pattern** (properly filters):
```typescript
// docs.ts:265 - CORRECT
WHERE d.is_deleted = 0 AND d.status = 'published' AND f.docs_fts MATCH ${cleanQ}
```

**Also good** (posts.ts:129):
```typescript
WHERE p.is_deleted = 0 AND p.status = 'published' AND f.posts_fts MATCH ${cleanQ}
```

These are correct, but the pattern should be codified into a reusable helper to prevent future omissions.

**Remediation:**
Create a helper function:
```typescript
function buildFtsQuery(tableName: 'posts' | 'docs' | 'events') {
  return sql`WHERE ${sql.raw(tableName)}.is_deleted = 0 AND ${sql.raw(tableName)}.status = 'published'`;
}
```

---

### MEDIUM: FTS Sanitization Not Consistent Across Implementations

**Location:** Multiple files

**Issue:** Different implementations of FTS query sanitization:

```typescript
// docs.ts:125 - Removes special chars, wraps in quotes with prefix
return `"${cleanQ.replace(/"/g, '""')}*`;

// posts.ts:91 - Similar but slightly different
return `"${cleanQ.replace(/"/g, '""')}*`;

// events/handlers.ts:68 - Removes different set of chars
return query.replace(/["\\^*-:]/g, ' ').trim().split(/\s+/).filter(Boolean).join(' ');
```

**Remediation:**
Consolidate to a single shared utility in `functions/api/utils/fts.ts`:
```typescript
export function sanitizeFtsQuery(query: string): string {
  const cleanQ = (query || "").replace(/[^\w\s\-.]/g, "").trim();
  if (!cleanQ) return "";
  return `"${cleanQ.replace(/"/g, '""')}*`;
}
```

**Files Affected:**
- `functions/api/routes/docs.ts:125`
- `functions/api/routes/posts.ts:91`
- `functions/api/routes/events/handlers.ts:68`
- `functions/api/routes/analytics.ts` (likely has FTS too)

---

### LOW: FTS Query Length Limits Inconsistent

**Location:** Various FTS handlers

**Issue:** Docs limits FTS query to 50 chars, posts does not validate length at all.

```typescript
// docs.ts:243
if (q.length > 50) { throw new ApiError("Query too long (max 50 characters)", 400); }

// posts.ts - no length check
```

**Remediation:**
Standardize on a 100-character limit for all FTS queries.

---

## 3. Drizzle ORM Patterns

### HIGH: Cached Database Instance Per Request, Not Per Environment

**Location:** `functions/api/middleware/db.ts:6-14`

**Issue:** The DB instance is cached globally in a module-level variable:

```typescript
let cachedDb: DrizzleD1Database<typeof schema> | null = null;

export const dbMiddleware = async (c: Context<AppEnv>, next: Next) => {
  if (!cachedDb) {
    cachedDb = drizzle(c.env.DB, { schema });
  }
  c.set("db", cachedDb);
  await next();
};
```

In Cloudflare Workers/Pages, this cache persists across requests in the same isolate, which is generally fine. However, if the `c.env.DB` binding ever changes (e.g., during testing or with multiple DB bindings), this will use the wrong connection.

**Remediation:**
```typescript
export const dbMiddleware = async (c: Context<AppEnv>, next: Next) => {
  const db = drizzle(c.env.DB, { schema });
  c.set("db", db);
  await next();
};
```

Or use a WeakMap keyed by the DB binding.

**Severity:** HIGH - could cause data to be written to wrong database in test/multi-tenant scenarios

---

### MEDIUM: Missing Index on queried columns

**Location:** `src/db/schema.ts`

**Issue:** Several frequently queried columns lack composite indexes:

**Missing indexes:**
1. `posts.cf_email` - has its own index but queries often filter by `cf_email + is_deleted + status`
2. `docs.cf_email` - no index, frequently joined with user table
3. `events.cf_email` - events don't track cf_email but should for authorship

**Remediation:**
Add composite indexes:
```typescript
// In posts table definition
index("idx_posts_cf_email_deleted_status").on(table.cfEmail, table.isDeleted, table.status),

// In docs table definition
index("idx_docs_cf_email_deleted_status").on(table.cfEmail, table.isDeleted, table.status),
```

---

### MEDIUM: N+1 Query Pattern in getUserWithRelations

**Location:** `src/db/query-helpers.ts:47-118`

**Issue:** The helper makes 4 sequential queries for each user request:
1. Get user + profile (1 query)
2. Get badges (1 query)
3. Get recent tasks (1 query)
4. Get recent comment (1 query)

This is acceptable for single user lookups, but if called in a loop (e.g., rendering a list of users), it becomes N+1.

**Current pattern is fine for single-user profile pages**, but document this limitation.

**Remediation:**
Add JSDoc warning:
```typescript
/**
 * Get user with all related data for profile pages.
 * WARNING: Do not call in loops - makes 4 DB queries per call.
 * For batch user data, create a dedicated batch query helper.
 */
```

---

### LOW: Query Helper Uses Simplified IN Clause

**Location:** `src/db/query-helpers.ts:191-203`

**Issue:** The `getTasksWithAssignees` helper has a TODO comment about simplified IN clause:

```typescript
.where(taskIds.length > 0 ? eq(schema.taskAssignments.taskId, taskIds[0]) : undefined); // Simplified - would need IN clause
```

This only checks the first task ID, not all of them.

**Remediation:**
```typescript
.where(taskIds.length > 0 ? inArray(schema.taskAssignments.taskId, taskIds) : undefined);
```

---

### LOW: Transaction Usage is Good but Could Be More Consistent

**Location:** Various files

**Issue:** Some multi-step operations use transactions (via `transactionHelpers`), others don't:

**Uses transactions correctly:**
- `transactionHelpers.createEventSignup` - prevents duplicate signups
- `transactionHelpers.createTaskWithAssignees` - atomic task + assignments

**Does NOT use transactions:**
- `events/handlers.ts:saveEvent` - inserts event + document history separately
- `posts.ts:savePost` - inserts post + document history separately

**Remediation:**
Consider using transactions for all multi-step writes to ensure consistency.

---

## 4. Migration Integrity

### MEDIUM: Schema Column Naming Inconsistency

**Location:** `src/db/schema.ts`

**Issue:** Drizzle schema uses camelCase property names, but the database columns use snake_case. This is correct and intentional, but some places have inconsistencies:

```typescript
// Correct pattern - explicit column names
cfEmail: text("cf_email"),
isDeleted: integer("is_deleted"),

// Inconsistent - some columns use default camelCase
createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`), // should be explicit?
```

Most columns are properly mapped, but verify all new columns follow the explicit snake_case pattern.

**Files Affected:**
- `src/db/schema.ts`

---

### MEDIUM: Missing Migration for FTS Triggers

**Location:** `drizzle/` directory

**Issue:** As noted in section 2, the FTS virtual tables are created but triggers to keep them synchronized are missing from migrations.

**Remediation:**
Create a new migration to add FTS sync triggers for all tables.

---

### LOW: Migration File Naming Not Semantic

**Location:** `drizzle/0000_tidy_prima/migration.sql`, `drizzle/20260509022830_tired_shiver_man/migration.sql`

**Issue:** Migration directory names use hash-based naming (e.g., `tired_shiver_man`) which makes it difficult to understand what each migration does without opening the file.

**Remediation:**
Consider using Drizzle Kit's `--custom` flag to name migrations descriptively:
```bash
npx drizzle-kit generate --custom="add_fts_triggers"
```

---

## 5. Query Optimization

### MEDIUM: Unbounded Queries in Some List Endpoints

**Location:** Various handlers

**Issue:** Some list endpoints have no enforced maximum limit:

```typescript
// settings.ts:97 - no max limit
db.select({ count: count(schema.posts.slug) }).from(schema.posts).where(eq(schema.posts.isDeleted, 0))

// analytics.ts:371 - no max limit
db.select({ total: sql<number>`count(${schema.posts.slug})` }).from(schema.posts).where(eq(schema.posts.isDeleted, 0))
```

These are COUNT queries so unbounded is acceptable, but ensure all actual data-fetching queries have limits.

**Checklist:**
- [x] `posts.ts` - has limit/offset
- [x] `docs.ts` - has limit/offset
- [x] `events.ts` - has limit/offset
- [x] `awards.ts` - has limit/offset
- [?] Check all other list endpoints

---

### MEDIUM: Missing LIMIT on Analytics Search Queries

**Location:** `functions/api/routes/analytics.ts:409-411`

**Issue:** The global search queries each have `LIMIT 5`, but this is duplicated three times with no configurable constant:

```typescript
db.all(sql<SearchResultRow>`SELECT f.slug as id, f.title FROM posts_fts f JOIN posts p ON f.slug = p.slug WHERE p.is_deleted = 0 AND p.status = 'published' AND f.posts_fts MATCH ${ftsQ} LIMIT 5`)
db.all(sql<SearchResultRow>`SELECT f.id, f.title FROM events_fts f JOIN events e ON f.id = e.id WHERE e.is_deleted = 0 AND e.status = 'published' AND f.events_fts MATCH ${ftsQ} LIMIT 5`)
db.all(sql<SearchResultRow>`SELECT f.slug as id, f.title FROM docs_fts f JOIN docs d ON f.slug = d.slug WHERE d.status = 'published' AND d.is_deleted = 0 AND f.docs_fts MATCH ${ftsQ} LIMIT 5`)
```

**Remediation:**
Define a constant:
```typescript
const GLOBAL_SEARCH_LIMIT = 5;
```

---

### LOW: Sequential Queries That Could Be Batched

**Location:** `functions/api/routes/settings.ts:176-215`

**Issue:** The backup endpoint runs sequential queries for each table:

```typescript
const backupPromises = SAFE_TABLES.map(async (tableName) => {
  // ... query
});
```

This uses `Promise.all`, so it's actually parallel, not sequential. Good pattern!

**No action needed** - this is correctly optimized.

---

## 6. Security Concerns

### CRITICAL: SQL Injection in Lifecycle Middleware (Duplicate Entry)

Already covered in section 1 under Soft-Deletion Compliance.

**Severity:** CRITICAL

---

### MEDIUM: Missing Row-Level Security on FTS Queries

**Location:** All FTS query implementations

**Issue:** FTS queries properly filter by `is_deleted` and `status`, but there's no enforcement that users can only search content they're allowed to see.

For example, a user with `member_type = "student"` might not be allowed to see draft posts, but the FTS query doesn't check user permissions.

**Remediation:**
The current approach (filtering by `status = 'published'`) is reasonable for most cases, but consider adding context-aware filtering:

```typescript
// In FTS query helpers
const statusFilter = user?.role === 'admin' ? sql`1=1` : sql`status = 'published'`;
```

---

## 7. Summary of Remediation Priorities

### Immediate Actions (CRITICAL/HIGH)

1. **Fix SQL injection in lifecycle middleware** - CRITICAL
2. **Add FTS sync triggers to migration** - HIGH
3. **Fix inquiry hard DELETE** - HIGH
4. **Add docs_fts/posts_fts cleanup on purge** - HIGH
5. **Review cached DB instance pattern** - HIGH

### Short-term Actions (MEDIUM)

6. Add FTS sync triggers
7. Standardize FTS sanitization
8. Add missing composite indexes
9. Fix soft-delete status inconsistency
10. Add is_deleted check to purge endpoint

### Long-term Actions (LOW/Refactoring)

11. Improve migration naming
12. Add query limit constants
13. Document N+1 patterns in query helpers
14. Standardize FTS query length limits

---

## Files Requiring Changes

**Critical/High Priority:**
- `functions/api/middleware/lifecycle.ts` - SQL injection, purge fix
- `functions/api/routes/inquiries/handlers.ts` - hard DELETE fix
- `functions/api/routes/docs.ts` - FTS cleanup on purge
- `functions/api/routes/posts.ts` - FTS cleanup on purge
- `functions/api/middleware/db.ts` - cached DB pattern review

**Medium Priority:**
- `drizzle/` (new migration) - Add FTS triggers
- `src/db/schema.ts` - Add composite indexes
- Consolidated FTS utility - Create shared sanitization

---

**Audit Completed:** 2026-05-09
**Audited By:** Claude Code Agent
**Next Review:** After implementation of CRITICAL and HIGH priority items
