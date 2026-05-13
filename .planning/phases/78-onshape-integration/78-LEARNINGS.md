---
phase: 78
phase_name: "Onshape CAD Integration"
project: "ARESWEB"
generated: "2026-05-13"
counts:
  decisions: 7
  lessons: 6
  patterns: 7
  surprises: 5
missing_artifacts:
  - "VERIFICATION.md"
  - "UAT.md"
---

# Phase 78 Learnings: Onshape CAD Integration

## Decisions

### OAuth State Storage in Workers KV

Use Workers KV for OAuth state parameter storage with 5-minute TTL instead of D1. Faster lookups during callback validation and automatic expiration prevents stale state accumulation.

**Rationale:** KV provides lower latency for temporary state compared to D1, and built-in TTL eliminates cleanup code.

**Source:** 78-01-PLAN.md

---

### 5-Minute Token Refresh Buffer

Implement token refresh when access token expires within 5 minutes (not when already expired). Proactive refresh prevents API failures during active requests.

**Rationale:** Onshape API calls may take time; refreshing too late causes cascading failures. Buffer ensures valid token throughout request lifecycle.

**Source:** 78-01-PLAN.md, 78-01-SUMMARY.md

---

### Public Document Caching, Private Real-Time Fetch

Cache public Onshape documents in D1 (`onshape_documents` table) but fetch private documents in real-time from Onshape API. Balances performance for public content with freshness for private data.

**Rationale:** Public documents change infrequently and can be served without auth. Private documents must be fresh and require per-user authorization.

**Source:** 78-02-PLAN.md, 78-02-SUMMARY.md

---

### Synchronous STL, Asynchronous STEP Export

STL exports use synchronous streaming (direct proxy to browser), while STEP exports use asynchronous polling with Workers KV state storage. Matches Onshape API capabilities—STL is fast enough for streaming, STEP requires background processing.

**Rationale:** STL generation is quick (<10 seconds). STEP export for assemblies can take minutes; async prevents request timeouts.

**Source:** 78-03-PLAN.md, 78-03-SUMMARY.md

---

### Workers KV for Export State with 1-Hour TTL

Store STEP export state in Workers KV with 1-hour expiration. Prevents abandoned exports from consuming storage while providing reasonable window for completion.

**Rationale:** Auto-expiration prevents storage exhaustion. Most exports complete within 5 minutes; 1 hour accommodates complex assemblies.

**Source:** 78-03-PLAN.md, 78-03-SUMMARY.md

---

### Fire-and-Forget BOM Sync History Recording

Record BOM sync history in D1 without waiting for confirmation. Fire-and-forget pattern keeps API responsive; sync history failures don't block BOM retrieval.

**Rationale:** BOM data is the primary value. Sync history is audit metadata; non-critical if occasionally missed.

**Source:** 78-04-SUMMARY.md

---

### No Caching for BOM Data

Fetch BOM data fresh from Onshape API on every request—no caching. BOM changes frequently during design iteration; stale data could cause procurement errors.

**Rationale:** Unlike document metadata, BOM is design-critical. Must reflect latest assembly state.

**Source:** 78-04-PLAN.md, 78-04-SUMMARY.md

---

## Lessons

### TypeScript Compiler Memory Limitations

Full project `tsc --noEmit` runs out of memory on large codebases. Use ESLint for incremental file checking and run `npx tsc --noEmit` on specific directories when verifying type safety.

**Context:** Phase 78 codebase triggered JavaScript heap out of memory errors during full compilation. Individual file checks passed.

**Source:** 78-autonomous session (execution experience)

---

### Drizzle ORM Dynamic Where Clause Typing

Drizzle ORM's dynamic `where()` clauses with `.columns()` produce type errors that require `@ts-expect-error`. The generated TypeScript types don't account for runtime column access patterns.

**Context:** Querying `onshapeBomHistory` with `columns.documentId === documentId` triggered typing violations. Suppressing with comment is necessary pattern.

**Source:** functions/api/routes/onshape/bom.ts:261

---

### React Compiler Memoization Warnings

Using `data?.parts` as React `useMemo` dependency triggers "Could not preserve existing memoization" warnings. Change dependency to `data` (parent object) to satisfy compiler while maintaining correctness.

**Context:** BOMViewer's `sortedParts` useMemo originally used `data?.parts` which caused React Compiler to complain.

**Source:** 78-04 implementation session

---

### ARIA Attribute Limitations on Button Elements

ESLint's `jsx-a11y` rule rejects `aria-sort` on `<button>` elements. Sortable table headers must use buttons for accessibility but cannot carry aria attributes meant for table headers.

**Context:** BOMViewer table header buttons needed `aria-sort` for proper accessibility but ESLint flagged as invalid role attribute.

**Source:** 78-04 ESLint fixes

---

### Click Handlers Require Keyboard Event Listeners

Accessibility rules require `onKeyDown` handlers for any element with `onClick`. Non-interactive elements (divs) with click handlers need keyboard support or `role="presentation"`.

**Context:** ModelCard card wrapper, ExportButton dropdown, ElementActionDropdown all needed keyboard event handlers to pass ESLint.

**Source:** 78-autonomous session (accessibility fixes)

---

### Onshape Translation State Mapping

Onshape export API uses non-standard state names: NEW, ACTIVE, DONE, FAILED, CANCELED. Must map these to application states (pending, processing, done, failed).

**Context:** Expected states like "in_progress" but API returns "ACTIVE". Required mapping function.

**Source:** 78-03-SUMMARY.md

---

## Patterns

### typedHandler with Zod Validation

Use `typedHandler()` wrapper for all API routes with Zod schemas for request validation. Provides type-safe params, query, and body parsing with automatic error responses.

**When to use:** All API endpoints that accept request parameters or body data.

**Source:** 78-01-PLAN.md, 78-02-PLAN.md, 78-03-PLAN.md, 78-04-PLAN.md

---

### Zero Trust Middleware Pattern

All authenticated routes use `requireAuth(async (c, { userId }) => {...})` wrapper. Extracts `cf-access-authenticated-user-email` from Cloudflare Access headers, ensures no token exposure to client.

**When to use:** Any endpoint that needs user authentication or per-user data access.

**Source:** 78-01-PLAN.md, repeated across all phases

---

### React Query with staleTime Caching

Use `@tanstack/react-query` with `staleTime: 5 * 60 * 1000` (5 minutes) for data that changes infrequently. Provides automatic refetching, loading states, and error handling.

**When to use:** Document listings, metadata fetches, any data with acceptable staleness window.

**Source:** 78-02-SUMMARY.md (ModelGallery implementation)

---

### Radix UI Dialog for Modals

Use Radix UI's `Dialog.Root` component for modal overlays. Provides accessible dialog primitives with focus trapping, escape key handling, and overlay management.

**When to use:** Any modal overlay (BOM viewer, confirmations, forms).

**Source:** 78-04-SUMMARY.md (BOMViewer modal integration)

---

### Export Dropdown with Compact Variant

ExportButton supports `variant="default"` (full dropdown) and `variant="compact"` (icon-only). Compact variant used in card grids where space is limited.

**When to use:** Components that appear in both full-page and card-grid contexts.

**Source:** 78-03-SUMMARY.md (ExportButton component)

---

### ElementActionDropdown for Multiple Options

When a document has multiple exportable elements, use ElementActionDropdown component. Single element shows actions directly; multiple use dropdown selection.

**When to use:** Any component with variable number of actionable items.

**Source:** 78-02-SUMMARY.md (ModelCard implementation)

---

### Rate Limit Header Extraction

Extract `X-Rate-Limit-Remaining` from Onshape API responses and return in API response wrapper. Enables client-side rate limit awareness and backoff handling.

**When to use:** All third-party API integrations that provide rate limit headers.

**Source:** 78-02-PLAN.md (OnshapeApiResponse interface)

---

## Surprises

### ESLint Compact Formatter Removed

ESLint's `--format compact` option is no longer available in core ESLint. Must install `eslint-formatter-compact` as separate package or use default formatter.

**Impact:** CI scripts using compact formatter broke; needed to switch to default output.

**Source:** 78-autonomous session (linting workflow)

---

### Tab Characters in Generated Files

Some source files use tab characters instead of spaces, causing Edit tool matching failures. Must preserve exact indentation when using Edit tool on these files.

**Impact:** Several edits failed due to whitespace mismatch; required Write tool to rewrite entire files.

**Source:** 78-autonomous session (file editing experience)

---

### Onshape Export ID Ownership Verification

Export state in Workers KV must include `userId` for ownership verification. Users can only access exports they initiated—critical security requirement not in initial planning.

**Impact:** Added ownership check to status and download endpoints to prevent export enumeration.

**Source:** 78-03-SUMMARY.md (security implementation)

---

### CSV Injection Prevention Required

BOM CSV export must sanitize part numbers and names to prevent CSV injection attacks. Remove or escape special characters (`,`, `"`, newline) before writing CSV.

**Impact:** Added sanitization step: `replace(/[",\n\r]/g, "")` before CSV generation.

**Source:** 78-04-SUMMARY.md (security implementation)

---

### Assembly vs PartStudio Export Handling

Assemblies support both STL and STEP export. PartStudios only support STL export. ExportButton must conditionally show STEP option based on element type.

**Impact:** Added `elementType` prop to ExportButton; STEP option hidden for PartStudios.

**Source:** 78-03-SUMMARY.md (ExportButton implementation)
