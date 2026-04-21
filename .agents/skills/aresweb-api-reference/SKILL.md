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

## 2. Authentication & Authorization

ARESWEB uses **Better-Auth** for session management and custom Hono middleware for internal security.

### Auth Patterns
- **`getSessionUser(c)`**: Standard utility to retrieve the authenticated user from the context.
- **`ensureAdmin`**: Middleware that blocks any role except `admin`. Mount admin routes under `/admin/` in the sub-router for automatic protection.
- **`ensureAuth`**: Middleware requiring any valid session.

### Role Hierarchy
1. `admin`: Full platform control.
2. `mentor` / `coach`: Content management and team oversight.
3. `parent`: Access to logistics and private rosters.
4. `student`: Standard member access.
5. `unverified`: Account created but restricted until manual approval.

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

## 4. Development Standards

- **Standardized Endpoints**: Use `/admin/list` for pagination lists and `/admin/save` for create/update logic.
- **D1 Schema Synchronization (CRITICAL)**: Whenever mapping UI models to D1 databases in `INSERT` or `UPDATE` transactions, you MUST verify destructuring and sql parameter bindings strictly match the column definitions in `schema.sql`. Missing a field silently drops user data.
- **PII Cryptography Compliance (CRITICAL)**: PII fields like phone numbers and parent emails are stored as AES-encrypted cyphertext in the database. You MUST explicitly call `decrypt()` on these fields in `GET` routes before returning them to authorized users. Never expose raw `iv:hex` strings to the frontend.
- **Domain-First Relative Routing**: When building modular Hono routers, NEVER use absolute paths (e.g., `/api/events/list`). Always use relative paths (`/list`) and let the root `[[route]].ts` gateway mount the domain prefixes. Overlapping absolute paths will cause silent 404s.
- **Error Handling**: Use `c.json({ error: "Message" }, status)` for all failures. Never return raw text or unhandled exceptions.
- **Audit Logging**: Use `logAuditAction` for all sensitive administrative changes (deletions, role changes, settings updates).

## 5. Integration Hooks

- **Zulip**: All content updates (posts, inquiries, signups) should trigger `sendZulipAlert` to the appropriate stream.
- **GitHub**: High-priority inquiries (Status: Sponsor/Join) should be escalated via `createProjectItem`.
