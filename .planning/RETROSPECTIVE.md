# Retrospective

## Milestone: v8.2 — Native Photo Albums & Tournaments

**Shipped:** 2026-05-15
**Phases:** 4 | **Plans:** 4+
**Timeline:** 28 days (2026-04-17 → 2026-05-15)
**Files:** 92 changed | **LOC:** +22,040 / -4,800

### What Was Built
- Native photo album system with D1 schema and OpenAPI CRUD
- Drag-and-drop media management with Google Photos bulk ingestion
- Dual-mode album display (CSS Masonry + GPU carousel)
- Tournament management with FTC Events API match sync
- Robot fleet documentation with Pokémon-style spec cards
- Public gallery and detail pages for robots and tournaments

### What Worked
- CSS-only layout approaches (masonry columns, keyframe carousel) eliminated JS library complexity
- Reusing the existing FTC Events API proxy pattern for match sync was zero additional infra work
- Centralized `ensureAdmin` middleware at router level prevented auth gaps in new routes
- Drizzle ORM schema-first approach made migration generation trivial

### What Was Inefficient
- Requirements traceability was not maintained during execution — all 6 requirements were never marked off in REQUIREMENTS.md until milestone close
- The `useUpdateX("")` hook pattern didn't support per-ID mutations well, forcing a `fetch()` + `reload()` workaround
- RichTextEditor.tsx lint errors slipped through to CI because targeted lint checks didn't cover all files

### Patterns Established
- Centralized router-level middleware for admin auth (replaces per-route manual calls)
- Partial payload Zod schemas with explicit defaults for Drizzle NOT NULL constraints
- Upsert-on-sync strategy for external API data (FTC Events matches)

### Key Lessons
- Always run full-project `pnpm run lint` (not just targeted files) before pushing to catch stray violations
- Mark requirements as complete in REQUIREMENTS.md as each phase finishes, not at milestone close
- When a hook requires initialization-time parameters (like entity ID), use a factory pattern or direct fetch instead of trying to reassign hook internals

---

## Milestone: v6.3 - Outreach & Impact Logging Restoration

**Shipped:** 2026-05-04
**Phases:** 2 | **Plans:** 3

### What Was Built
- Outreach & Impact Logging Fixes
- Interactive Tools Foundation & FTC Scouting

### What Worked
- Fast iteration using Hono proxy endpoints to protect API keys.

### Key Lessons
- Structuring AI calls via centralized tool registry prevents code duplication.
