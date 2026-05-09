# API Reference

> Reference for ARESWEB Hono API routing, data models, and patterns.

## Routing Architecture

Modular Hono routers mounted at `/api` in `[[route]].ts`. **Use relative paths only** — never `/api/events/list`, use `/list`.

### Mount Points

| Prefix | Purpose |
|---|---|
| `/auth` | Better-Auth sessions |
| `/posts`, `/events`, `/docs` | Content CRUD |
| `/profile`, `/sponsors`, `/badges` | Team & gamification |
| `/analytics`, `/notifications` | Platform features |
| `/github`, `/zulip`, `/tba` | Integrations |
| `/webhooks/github`, `/webhooks/zulip` | Webhook receivers |

### Auth Patterns
```typescript
import { getSessionUser, ensureAuth, ensureAdmin } from "../middleware";

// In handler
const user = await getSessionUser(c);
if (!user) throw new ApiError(401, "Unauthorized");

// At router level
analyticsRouter.use("/stats", ensureAuth);
analyticsRouter.use("/admin/*", ensureAdmin);
```

### Role Hierarchy
`admin` → `author` → `mentor/coach` → `parent` → `student` → `unverified`

---

## Data Models (D1)

### Common Patterns
- **Posts:** `slug` (unique), `status` (published/pending_review), `is_deleted` (soft-delete)
- **Events:** `id` (UUID), `is_volunteer` (boolean for outreach), `date_start`/`date_end` (ISO timestamps)
- **Docs:** `category` (Mech/Software grouping), `is_portfolio` (for Engineering Portfolio)

---

## Full-Text Search

Endpoints support `?q=` query parameter via FTS5 virtual tables:

- `GET /posts?q=term` — searches `posts_fts` (title, snippet, author)
- `GET /events?q=term` — searches `events_fts` (title, location, description)
- `GET /profile/team-roster?q=term` — searches `profiles_fts` (nickname, bio, subteams)
- `GET /search?q=term` — global cross-domain search

**JOIN Rule:** All FTS5 queries must join virtual table with base table for row-level security (`is_deleted = 0`, `status = 'published'`).

---

## Route Standards

- **Admin endpoints:** Use `/admin/list` for pagination, `/admin/save` for create/update
- **Soft-delete:** Always `is_deleted = 1`, never `DELETE FROM`
- **PII encryption:** Call `decrypt()` on phone/parent_email before returning
- **Long-running tasks:** Wrap in `c.executionCtx.waitUntil()`
- **Error format:** `c.json({ error: "Message" }, status)`
- **Audit logging:** `logAuditAction(c, "DELETE", "events", id, reason)`

---

## Global State (Zustand)

- **UI State:** Use `src/store/uiStore.ts` for global toggles, active season, theme
- **Selectors:** Prefer `const isOpen = useUIStore(s => s.isOpen)` over full destructuring
- **Persistence:** Sync with `localStorage` or `c.env.DB` settings for refresh survival

---

## Integration Hooks

- **Zulip:** Content updates trigger `sendZulipAlert` to appropriate stream
- **GitHub:** High-priority inquiries escalate via `createProjectItem`
- **Social:** Use `dispatchSocialSync()` for multi-platform broadcast
