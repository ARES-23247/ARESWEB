---
name: aresweb-comprehensive-audit
description: Audit ARESWEB repository quality, technical debt, live production posture, or suspected orphaned code and assets.
---

# ARESWEB comprehensive audit

Match the investigation to the requested scope. Derive architecture, routes,
roles, and data boundaries directly from live source, configuration, and
executed checks rather than historical reports or planning archives. Record the
exact commit SHA, branch, initial worktree state, date, runtime versions, and
commands executed.

## Reference playbooks

Read each checklist relevant to the audit scope before collecting evidence:

- Domain checklists (Security/Rules, Public UX/A11y/SEO/Print, Portal/Championship/Content, Arcade/CI/Orphans): [references/domain-checklists.md](references/domain-checklists.md)
- Read-only live production & cloud checks (`https://aresfirst.org` + GCP/Firebase): [references/live-production-checks.md](references/live-production-checks.md)
- Canonical report template & severity contract: [references/report-template.md](references/report-template.md)

## Baseline diagnostic commands

Run applicable automated checks to separate hard facts from static inspection:

```text
pnpm run validate:agents
pnpm run check:route-security
pnpm run validate:security-observability
pnpm run validate:game-deployment
pnpm run validate:functions-deploy-lock
pnpm run content:verify
pnpm run content:release-validate
pnpm run test:release-tooling
pnpm run lint
pnpm --filter functions lint
pnpm run typecheck
pnpm run test:rules
pnpm run test:functions-emulator
pnpm run build
node scripts/check-bundle-size.mjs
pnpm audit --prod --audit-level=low
```

Include `pnpm run test:coverage`, `pnpm --filter functions test:coverage`, and
`pnpm run test:e2e` when assessing full regression posture or verifying fixes.

## Audit workflow

1. **Inventory & baseline:** Capture git SHA, branch, clean/dirty state, tool
   versions, and baseline check results.
2. **Trace trust boundaries & primary journeys:** Check all four non-overlapping
   domains in [references/domain-checklists.md](references/domain-checklists.md).
   Team claims, 3D parts, hardware specs, sponsors, alumni, and awards must map
   to authentic team records, explicit user data, or truthful empty states.
3. **Orphan / dead-code protocol:** Never mark code or public assets orphaned
   from a filename search alone. Check static/dynamic imports, lazy registries,
   routes, Firebase rewrites, scripts, CI, tests, generated deployment copies,
   dynamic URL construction, and documentation.
4. **Live production checks (when authorized):** Follow
   [references/live-production-checks.md](references/live-production-checks.md)
   strictly read-only; never submit forms, mutate Firestore/Storage, or print
   secret values.
5. **Parallel delegation (when user-approved):** Stage up to four
   non-overlapping specialist scopes (`Security/API/Rules`, `Public UX/A11y/Print`,
   `Portal/Championship/Offline/Content`, `Arcade/Cloud Run/CI/Orphans`) plus an
   optional read-only `browser` inspection. The lead agent must verify cited
   files/lines, reconcile contradictions, and publish one deduplicated report.

## Deliverable & evidence limits

Publish one deduplicated Markdown report under `docs/audits/` using
[references/report-template.md](references/report-template.md). Put scratch
notes in root `scratch/` and clean them up when finished. Separate confirmed
defects from risks needing reproduction; never claim total security, full
WCAG conformance, or zero violations from partial evidence. An audit alone does
not authorize app edits, merges, secret rotation, or production deployments.
