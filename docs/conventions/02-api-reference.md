# API Reference

> Reference for ARESWEB Express API routing, Firestore data models, and routing patterns.

## Routing Architecture

Modular Express routers mounted at `/api` in `functions/src/index.ts`. **Use relative paths only** inside routers.

### Mount Points

| Router File | Mount Path | Purpose |
|---|---|---|
| `routes/blog.ts` | `/api/blog` | Blog CRUD and thumbnail picker |
| `routes/events.ts` | `/api/events` | Calendar entries and RSVPs |
| `routes/profiles.ts` | `/api/profiles` | Member roster and settings sync |
| `routes/simulations.ts` | `/api/simulations` | Interactive physics engines registry |
| `routes/sponsors.ts` | `/api/sponsors` | Sponsor tiers and logo uploads |
| `routes/ai.ts` | `/api/ai` | Vertex AI copilot, assistant, and spelling |

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
  - `author`: String (author display name)
  - `body`: String (ProseMirror AST structure or Markdown string)
- **events:**
  - `id`: String (document ID)
  - `title`: String
  - `dateStart`: ISO String
  - `dateEnd`: ISO String (optional)
  - `isVolunteer`: Number (volunteer required flag)
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
