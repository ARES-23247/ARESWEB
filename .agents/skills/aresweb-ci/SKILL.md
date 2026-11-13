---
name: aresweb-ci
description: Verify ARESWEB code handoffs and maintain its tests, builds, CI, and protected release workflow.
---

# ARESWEB verification and delivery

Use Node 24.15 or newer in the Node 24 line, pnpm 11.21.0, and Java 21+ for
Firebase emulators. Commands and CI behavior come from `package.json`,
`functions/package.json`, and `.github/workflows/ci.yml`.

## Verification

For code handoff, run the full root `AGENTS.md` verification gate, including
both frontend and Functions lint. Use focused checks during iteration;
instruction-only edits require `validate:agents`, while code changes require the
full gate.

Note on `pnpm` v11 argument forwarding: pass CLI flags directly (e.g.
`pnpm run test:e2e --workers=4` or `pnpm exec playwright test --workers=4`)
rather than `pnpm run <script> -- --flag`, which forwards a literal `--` that
breaks Playwright/Vitest option parsing. On Windows developer hosts where
`AppData\Local\Temp` incurs real-time AV overhead, direct `TEMP`/`TMP` to an
excluded folder outside the Git tree and clean it up in a `finally` block.

For area selection, browser sharding, or fingerprinted backend deploys, consult
[docs/AREA_TESTING_AND_RELEASE_PLAN.md](../../../docs/AREA_TESTING_AND_RELEASE_PLAN.md),
`infra/verification-areas.json`, and `scripts/deployment-fingerprints.mjs`.
When adding routes, Functions, or packages, verify they map to the right area
and `components` list in `infra/verification-areas.json` and appear in
`scripts/deployment-fingerprints.mjs` closures, then run
`pnpm run test:release-tooling`.

Keep coverage ratchets (85% line and 100% function coverage on new utilities and
API routes), emulator rule tests, Playwright coverage, and bundle budgets in
`config/bundle-budgets.json`. E2E auth must never enter production builds.

## CI and release changes

Pin third-party GitHub Actions to immutable commit SHAs. Use
repository-restricted Google Workload Identity Federation (`WIF`) for production
auth; never add service-account JSON, refresh tokens, or long-lived deploy
secrets. Containerized Git checkouts (such as Playwright jobs) must preserve
`git config --global --add safe.directory` when tools inspect git diffs.

Keep `infra/gcp/production-deployment.json`, Function exports, Hosting rewrites,
and secret bindings synchronized. Verification must fail on unexpected drift;
never auto-delete unknown cloud resources.

For an authorized release, follow `.github/workflows/ci.yml` through protected
merge to `master`, artifact and fingerprint build, indexes, fingerprinted Cloud
Run (`game` and `biobuzz`) + Cloud Functions deployment, drift validation, game
readiness, Hosting/rules, and live browser security smoke. Honor existing session
approval without asking again; otherwise obtain explicit approval before any
production mutation, secret rotation, or deployment.
