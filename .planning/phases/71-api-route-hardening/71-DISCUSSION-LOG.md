# Phase 71: API Route Hardening - Discussion Log

**Date:** 2026-05-11
**Participants:** Antigravity (Agent), User

## Areas Discussed

### 1. AppType Splitting vs Direct Usage
- **Context:** The current client uses dummy intersections to handle over 40 routes.
- **Options presented:**
  - Option A: Keep splitting to avoid TS degradation.
  - Option B: Use `hc<AppType>` directly.
- **User Selection:** **Option B**. "Try hc<AppType> directly and only split if needed."

### 2. Handler Return Alignment
- **Context:** Many handlers use `as any` in `c.json()`.
- **Options presented:**
  - Prioritize only the most used routes.
  - Systematic sweep of all 30+ files.
- **User Selection:** **Systematic Sweep**. "lets put in the hard work then to make things as good as possible."

### 3. unwrapResponse Hardening
- **Context:** Current error handling loses structured validation data.
- **User Selection:** **Detailed Errors**. "yes I want detailed errors to help with debugging."

## Deferred Ideas
- None.

## Claude's Discretion Items
- Internal implementation of `ApiError` field mapping.
- Specific casting strategy for Drizzle-to-Zod mismatches (prioritizing `as ZodType` over `as any`).
