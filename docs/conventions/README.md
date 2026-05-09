# ARESWEB Development Conventions

This directory contains the team's coding standards, architectural patterns, and development guidelines. These conventions ensure championship-grade quality across the ARES 23247 Web Portal.

## Getting Started

**New here?** Start with:
1. **[00-core-patterns.md](00-core-patterns.md)** — Foundation: auth, error handling, API structure
2. **[01-typescript-safety.md](01-typescript-safety.md)** — Type safety rules for `.ts`/`.tsx` files

Then reference specific conventions as needed.

---

## By Category

### Architecture & Backend

| File | When to Read |
|------|--------------|
| [02-api-reference.md](02-api-reference.md) | Working with Hono API routes |
| [03-zero-trust-security.md](03-zero-trust-security.md) | Editing auth flows or protected routes |
| [04-error-handling.md](04-error-handling.md) | Writing API handlers |
| [08-database.md](08-database.md) | Modifying D1 schema or writing SQL |
| [16-social-manager.md](16-social-manager.md) | Working with scheduled posts or social integrations |

### Frontend & UI

| File | When to Read |
|------|--------------|
| [05-brand-guidelines.md](05-brand-guidelines.md) | Building UI components or styling |
| [06-accessibility.md](06-accessibility.md) | Building UI components, HTML, or CSS |
| [11-cultural-legacy.md](11-cultural-legacy.md) | Writing team copy, documentation, or About content |
| [07-readability.md](07-readability.md) | Writing user-facing text or documentation |
| [12-pwa-resilience.md](12-pwa-resilience.md) | Deploying or debugging service worker issues |

### Quality & Standards

| File | When to Read |
|------|--------------|
| [01-typescript-safety.md](01-typescript-safety.md) | Editing `.ts`/`.tsx` files, API routes, or zod schemas |
| [09-ci-build.md](09-ci-build.md) | Running commands or diagnosing build failures |
| [13-testing.md](13-testing.md) | Writing new utilities or API routes |
| [14-failure-exposure.md](14-failure-exposure.md) | Handling errors or building error UIs |
| [18-audit-protocol.md](18-audit-protocol.md) | Auditing files, components, or systems |

### Specialized

| File | When to Read |
|------|--------------|
| [10-pr-workflow.md](10-pr-workflow.md) | Creating GitHub pull requests |
| [15-youth-protection.md](15-youth-protection.md) | Working with profiles, comments, or public user data |
| [17-subagent-orchestration.md](17-subagent-orchestration.md) | Delegating work to subagents |
| [19-ast-migration.md](19-ast-migration.md) | Importing or repairing documentation |

---

## Quick Reference

### Core Principles

1. **Throw, never return errors** — All API errors must be thrown via `ApiError`
2. **Type safety first** — Use `typedHandler`, infer from Zod, `as any` only at boundaries
3. **Soft-delete standard** — `is_deleted = 1`, never `DELETE FROM`
4. **Server-side validation** — Never trust client headers for auth
5. **WCAG 2.1 AA** — 4.5:1 contrast ratio, keyboard navigation, semantic HTML

### Common Commands

```bash
npm run dev          # Start dev server
npm run lint         # Check code quality
npm run build        # Production build
npm run test:e2e     # E2E tests (remote mode preferred)
```

### Color Palette (Use ONLY these)

- `ares-red` (#C00000), `ares-bronze` (#CD7F32), `ares-gold` (#FFB81C)
- `ares-cyan` (#00E5FF), `marble` (#F9F9F9), `obsidian` (#1A1A1A)

---

## For AI Assistants

When working on this codebase:

1. **Read the relevant Institutional Skill** in [.agents/skills/](file:///c:/Users/david/dev/robotics/ftc/ARESWEB/.agents/skills/) before making changes. These contain highly detailed technical directives specifically for AI agents.
2. **Follow the patterns exactly** — these are battle-tested standards.
3. **Refer to these local convention files** for human-readable summaries and examples.

The files in `.agents/skills/*.md` are the source of truth for AI behavior and contain more rigorous technical constraints than these summary docs.
