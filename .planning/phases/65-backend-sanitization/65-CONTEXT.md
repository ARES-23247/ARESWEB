# Phase 65: Backend Sanitization

## Domain
Code quality and ESLint compliance across all `functions/api/` handlers, middleware, and utilities.

## Decisions

### Unused Variables
- **Decision:** Remove unused variables entirely where possible to keep the codebase clean.
- **Nuance:** If a variable is required to satisfy a positional function signature (like middleware arguments) or destructured object boundaries, prefix it with `_` (e.g., `_req`) rather than removing it, to explicitly signal it is intentionally unused.

### Rule Enforcement
- **Decision:** Actually fix the underlying code issues rather than relying on inline `eslint-disable` comments.
- **Nuance:** The goal of this milestone is championship-grade code quality; patching over errors with disable comments is not acceptable unless it is a severe external dependency boundary that cannot be strictly typed.

## Canonical Refs
- ROADMAP.md (v7.3 Full Codebase ESLint Sanitization)
- .planning/STATE.md (Anti-Patterns to Avoid)
