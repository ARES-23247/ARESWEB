---
name: aresweb-api-reference
description: Provides a comprehensive reference for the ARESWEB Hono API, including standardized routing, authentication, and core resource endpoints. Use this when interacting with the backend or documenting API behavior.
---

# ARESWEB API Reference Skill

You are the Lead Backend Architect for Team ARES 23247. When interacting with the ARESWEB Hono API (Cloudflare Pages Functions):

## 1. Core Routing Architecture

The API follows a standardized modular structure mounted at `/api`. Each resource domain has its own sub-router.

### Static Mount Points (in `[[route]].ts`)
| Prefix | Sub-Router | Primary Purpose |
|---|---|---|
| `/auth` | `authRouter` | Authentication lifecycle (Better-Auth) |
| `/posts` | `postsRouter` | Blog content and administrative CRUD |
| `/events` | `eventsRouter` | Team events, attendance, and sign-ups |
| `/docs` | `docsRouter` | Technical documentation and ARESLib portal |
| `/profile` | `profilesRouter` | User profile management and roster |
| `/sponsors` | `sponsorsRouter` | Sponsor display and ROI metrics |
| `/inquiries` | `inquiriesRouter` | Form submissions (Join, Sponsor, etc.) |
| `/media` | `mediaRouter` | R2 Storage management and AI tagging |
| `/badges` | `badgesRouter` | Gamification and achievements |
| `/comments` | `commentsRouter` | Threaded discussions across all content |
| `/analytics` | `analyticsRouter` | Platform-wide tracking and metrics |
| `/notifications`| `notificationsRouter`| In-portal user alerts |
| `/locations` | `locationsRouter` | Location management with OSM geocoding |
| `/logistics` | `logisticsRouter` | Administrative logistics (dietary, T-shirt, emergency contacts) |
| `/judges` | `judgesRouter` | Judges Hub portfolio export |
| `/github` | `githubRouter` | GitHub Project v2 CRUD operations |
| `/zulip` | `zulipRouter` | Zulip integration settings and test |
| `/tba` | `tbaRouter` | The Blue Alliance FRC data proxy |
| `/awards` | `awardsRouter` | Team awards management |
| `/outreach` | `outreachRouter` | Outreach activity logs and hours |
| `/settings` | `settingsRouter` | Platform configuration key-value store |
| `/sitemap.xml` | Inline handler | SEO sitemap generation |
| `/search` | Inline handler | Global FTS5 full-text search |
| `/webhooks/github` | `githubWebhookRouter` | GitHub webhook receiver (HMAC-SHA256) |
| `/webhooks/zulip` | `zulipWebhookRouter` | Zulip interactive bot webhook |

## 2. Authentication & Authorization

ARESWEB uses **Better-Auth** for session management and custom Hono middleware for internal security.

### Auth Patterns
- **`getSessionUser(c)`**: Standard utility to retrieve the authenticated user from the context. Checks context cache first (set by `ensureAdmin`), avoiding duplicate D1 queries.
- **`ensureAdmin`**: Middleware that blocks any role except `admin` or `author`. Coaches and mentors also receive standard admin privileges (except user management).
- **`ensureAuth`**: Middleware requiring any valid session.

### Role Hierarchy
1. `admin`: Full platform control.
2. `author`: Content management privileges.
3. `mentor` / `coach`: Elevated access based on member_type.
4. `parent`: Access to logistics and private rosters.
5. `student`: Standard member access.
6. `unverified`: Account created but restricted until manual approval.

## 3. Data Models (D1 Database)

Common resource structures to expect in API responses:

### `posts` (Blog)
- `slug`: Unique identifier.
- `status`: `published` or `pending_review`.
- `is_deleted`: Soft-delete flag (integer 0 or 1).

### `events`
- `id`: UUID.
- `is_volunteer`: Boolean (0/1) for outreach tracking.
- `date_start` / `date_end`: ISO timestamps.

### `docs`
- `category`: Grouping (e.g., 'Mech', 'Software').
- `is_portfolio`: Flags content for the Engineering Portfolio.

## 4. FTS5 Full-Text Search

Several endpoints support full-text search via the `?q=` query parameter:
- **`GET /posts?q=term`**: Searches posts via `posts_fts` virtual table (title, snippet, author).
- **`GET /events?q=term`**: Searches events via `events_fts` virtual table (title, location, description).
- **`GET /profile/team-roster?q=term`**: Searches profiles via `profiles_fts` (nickname, bio, subteams).
- **`GET /search?q=term`**: Global cross-domain search across posts, events, and docs.

**JOIN Rule**: All FTS5 queries MUST join the virtual table with the base table to enforce row-level security (`is_deleted = 0`, `status = 'published'`).

## 5. Development Standards

- **Standardized Endpoints**: Use `/admin/list` for pagination lists and `/admin/save` for create/update logic.
- **OpenAPIHono Architecture (PREFERRED)**: All API features MUST be defined using `@hono/zod-openapi` with `createRoute` to explicitly define Zod schemas. This replaces the legacy `@ts-rest/core` contracts to ensure robust type safety and prevent TypeScript structural inference failures.
- **D1 Schema Synchronization (CRITICAL)**: Whenever mapping UI models to D1 databases in `INSERT` or `UPDATE` transactions, you MUST verify destructuring and sql parameter bindings strictly match the column definitions in `schema.sql`. Missing a field silently drops user data.
- **PII Cryptography Compliance (CRITICAL)**: PII fields like phone numbers and parent emails are stored as AES-encrypted cyphertext in the database. You MUST explicitly call `decrypt()` on these fields in `GET` routes before returning them to authorized users. Never expose raw `iv:hex` strings to the frontend.
- **Domain-First Relative Routing**: When building modular Hono routers, NEVER use absolute paths (e.g., `/api/events/list`). Always use relative paths (`/list`) and let the root `[[route]].ts` gateway mount the domain prefixes. Overlapping absolute paths will cause silent 404s.
- **Soft-Delete Standard**: All content deletion MUST use `is_deleted = 1` (or `is_active = 0` for sponsors). Hard `DELETE FROM` is prohibited — data must remain recoverable for audit compliance.
- **Scalability & Resiliency**: Long-running tasks (notifications, social dispatches, batch processing) MUST be wrapped in `c.executionCtx.waitUntil()` to ensure immediate Worker responses.
- **Error Handling**: Use `c.json({ error: "Message" }, status)` for all failures. Never return raw text or unhandled exceptions.
- **Audit Logging**: Use `logAuditAction` for all sensitive administrative changes (deletions, role changes, settings updates).

## 6. Global State Management (Zustand)

- **UI State**: Use **Zustand** (`src/store/uiStore.ts`) for global UI toggles, active season tracking, and theme preferences. This replaces prop-drilling and high-re-render Context providers.
- **Store Access**: Prefer specific selectors `const isOpen = useUIStore(s => s.isOpen)` over destructuring the entire store to optimize React render cycles.
- **Persistence**: Any state that should survive a refresh (e.g., Active Season) must be synchronized with `localStorage` or `c.env.DB` settings via the store's action logic.

## 7. Integration Hooks

- **Zulip**: All content updates (posts, inquiries, signups) should trigger `sendZulipAlert` to the appropriate stream. The `sendZulipMessage` utility accepts either full `Bindings` or minimal `ZulipCredentials`.
- **GitHub**: High-priority inquiries (Status: Sponsor/Join) should be escalated via `createProjectItem`.
- **Social Syndication**: Use `dispatchSocialSync()` for multi-platform content broadcast. Providers use `Promise.allSettled` for resilience.

