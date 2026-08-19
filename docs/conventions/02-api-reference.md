# API Reference

> Reference for ARESWEB Express API routing, Firestore data models, and routing patterns.

## Routing Architecture

Express routers are composed into five isolated apps in `functions/src/apps/`
(`public.ts`, `core.ts`, `media.ts`, `drive.ts`, `communications.ts`) via
`createApiApp` in `functions/src/apiApp.ts`; `functions/src/index.ts` only
wires those apps to Cloud Functions. Each app is a process boundary with its
own runtime identity and secret bindings (see
`functions/src/functionConfig.ts` and `docs/SECURITY_OPERATIONS.md`).

**Use relative paths only** inside routers. The route-group → app mapping is
declared in `API_ROUTE_GROUPS` (`functions/src/functionConfig.ts`) and must
stay in sync with the Hosting rewrites in `firebase.json`.

### Mount Points

Mount paths live in the `createApiApp({ routes: [...] })` call of each app
file. Current mounts (keep this table aligned with `functions/src/apps/*.ts`):

| App file | Mounts | Purposes |
|---|---|---|
| `apps/public.ts` | `/api/announcements`, `/api/calendar`, `/api/sponsors`, `/api/seasons`, `/api/awards`, `/api/outreach`, `/api/tournaments`, `/api/robots`, `/api/store`, `/api/finance`, `/api/reference`, `/api/og`, `/sitemap.xml`, `/feed.xml` | Public content DTOs, calendar (incl. recurrence/iCal), sponsors, seasons & awards, outreach, tournaments, robots, finance ledger, OG image rendering, sitemap and RSS |
| `apps/core.ts` | `/api/profiles`, `/api/inquiries`, `/api/ai`, and related profile routes | Identity/session claims, inquiry intake (encrypted PII), profile admin, AI copilot |
| `apps/media.ts` | `/api/photos`, `/api/videos` | Photo/album management, derivatives, Google Photos picker import, YouTube sync |
| `apps/drive.ts` | `/api/drive` | Drive library browse, draft import, retired-sync tombstone |
| `apps/communications.ts` | `/api/tasks`, `/api/webhooks`, `/api/simulations`, `/api/zulip` | Kanban tasks + Zulip notify, inbound Zulip/Onshape webhooks, simulation registry/Gists, Zulip proxy |

Routers themselves live in `functions/src/routes/<name>.ts` and are imported
by the app files. There is no `/api/blog` or `/api/events` router: blog posts
are served through the public content routes, and calendar data through
`routes/calendar.ts`.

### Auth Patterns
```typescript
import { ensureAuth, ensureAdmin, ensureTeamMember, AuthenticatedRequest } from "../middleware/auth";

// At router level
router.use("/admin/*", ensureAdmin);

// Inside route handler
router.post("/save", ensureTeamMember, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const user = req.user; // Typed as DecodedIdToken
  // ...
}));
```

### Role Hierarchy
`admin` / `coach` / `mentor` → `member` → `unverified`

---

## Data Models (Firestore Collections)

### Common Schema Patterns
- **posts:**
  - `slug`: String (document ID)
  - `title`: String
  - `isDeleted`: Number (`1` for soft-deleted)
  - `approvalStatus`: String (explicitly reviewed posts must be `approved`; legacy records without the field remain readable)
  - `author`: String (author display name)
  - `body`: String (ProseMirror AST structure or Markdown string)
- **events:**
  - `id`: String (document ID)
  - `title`: String
  - `dateStart`: ISO String
  - `dateEnd`: ISO String (optional)
  - `isVolunteer`: Number (volunteer required flag)
  - `recurrence`: weekly rule (see `routes/calendarHelpers.ts`)
- **profiles:**
  - `uid`: String (document ID)
  - `nickname`: String
  - `role`: String (`admin`, `coach`, `mentor`, `member`, `unverified`)
  - `isMinor`: Boolean (COPPA safety check)

---

## Route Standards

- **Query Limits:** All collection reads must restrict return sizes (e.g. `.limit(50)`) to guard against excessive read operations.
- **Soft-delete:** Always set `isDeleted: 1` instead of recursively deleting primary references.
- **PII security:** Contact information for minors must be kept encrypted in the database and only decrypted server-side for admin requests.
- **Structured Logging:** Banish `console.log`/`console.error` calls. Import `logger` from `../lib/logger` and write logs as `logger.error("tag", "message", error)`.
- **Coverage ratchet:** New files under `functions/src/routes/` or `functions/src/lib/` must be registered in the `functions/vitest.config.mts` thresholds (85% lines / 100% functions) — `functions/src/__tests__/coverageRatchet.test.ts` fails CI otherwise.
