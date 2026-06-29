# ARESWEB Core Patterns

> Foundational patterns — read this first for context on auth, error handling, and API structure.

## Authentication & Authorization

**Always validate Firebase ID Tokens server-side via middleware:**
```typescript
import { ensureAuth, ensureAdmin, ensureTeamMember, AuthenticatedRequest } from "../middleware/auth";

// Router level middleware usage:
router.get("/admin-only", ensureAdmin, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const user = req.user; // Typed as DecodedIdToken from Firebase Admin SDK
  res.json({ success: true, user });
}));
```

**Middlewares for protected routes:**
- `ensureAuth` - Any authenticated user
- `ensureTeamMember` - Team members/students/mentors (excluding unverified accounts)
- `ensureAdmin` - Admin/coach/mentor roles only

**Role hierarchy:** admin / coach / mentor > member > unverified

**NEVER trust spoofable headers:** `Referer`, `Host`, `Origin` for auth decisions.

---

## Error Handling: Throw, Never Return

**All route handlers MUST bubble exceptions up to the Global Error Handler. Return only happy-path responses:**
```typescript
import { ApiError } from "../middleware/errorHandler";
import { asyncHandler } from "../lib/utils";

router.post("/items", ensureAdmin, asyncHandler(async (req, res) => {
  const { id } = req.body as { id: string };
  
  // Validation errors
  if (!id) throw new ApiError(400, "ID is required");

  // Not found
  const item = await fetchItem(id);
  if (!item) throw new ApiError(404, "Item not found");

  // ONLY happy path returned
  res.json({ success: true, item });
}));
```

**The global `globalErrorHandler` middleware in `functions/src/middleware/errorHandler.ts` catches and formats all thrown errors.**

---

## API Route Structure

**Express Router pattern:**
All endpoints are organized in modular routers mounted under `/api/*` in `functions/src/index.ts`:

- `/api/auth` -> Authentication actions
- `/api/blog` -> Blog article management
- `/api/events` -> Team events calendar and RSVPs
- `/api/simulations` -> Standalone physics engines and registries

**Domain-first routing:** Use relative paths in Express routes (e.g. `router.get("/list", ...)`), never absolute (e.g. `router.get("/api/events/list", ...)`).

---

## Type Safety Rules

**TypeScript safety is strictly enforced across frontend and backend boundaries:**
- Always type request objects with `AuthenticatedRequest` if the route is authenticated.
- Declare expected request payload types explicitly:
  ```typescript
  const { title, date } = req.body as { title: string; date: string };
  ```
- Avoid `any` except at untypeable Firestore JSON parsing boundaries.

---

## Data & Security

**Soft-delete standard:** Set `isDeleted: 1` for document deletions in Firestore, never call `.delete()` on primary items directly unless purging transient records.

**PII encryption:** Phone numbers and parent emails are AES-encrypted before writing to Firestore. Use our custom crypto helpers to `decrypt()` them before returning them on admin-authorized endpoints.

**Firestore query limits:** Always append `.limit(...)` on collection scans (`get()`) to prevent high read bills (Denial of Wallet).
