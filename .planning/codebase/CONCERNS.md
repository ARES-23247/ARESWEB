# CONCERNS.md

**Date:** 2026-04-28

## Technical Debt & Issues
- **Coverage Burden:** The project mandates 100% function coverage, which often leads to complex mocking patterns (e.g., Kysely expression builders) just to satisfy thresholds, occasionally introducing test race conditions.
- **Cloudflare Edge Limitations:** Heavy dependencies like Tiptap, Three.js, and complex Markdown parsers must be carefully chunked to respect Cloudflare Pages asset limits and parsing times.
- **AI Token Leakage / CI Blocker:** Cloudflare AI bindings were moved to dashboard-only to prevent CI/CD token blockers (`wrangler.toml` notes this).
- **Local Dev vs Prod DB Sync:** Maintaining `schema.sql` parity with Cloudflare D1 across local setups requires strict discipline (no ORM migration engine is active).
