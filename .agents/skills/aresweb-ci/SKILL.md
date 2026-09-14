---
name: aresweb-ci
description: Verify ARESWEB code handoffs and maintain its tests, builds, CI, and protected release workflow.
---

# ARESWEB verification and delivery

Use Node 24.15 or newer in the Node 24 line, pnpm 11.21.0, and Java 21+
for Firebase emulators. Commands and CI behavior come from package.json,
functions/package.json and .github/workflows/ci.yml.

## Verification

For code handoff, run the full root AGENTS.md verification gate, including both
frontend and Functions lint. Use focused checks during iteration. For
instruction-only edits, run validate:agents; the full code gate applies when
code changes.

For area selection or browser sharding, consult
[the area testing plan](../../../docs/AREA_TESTING_AND_RELEASE_PLAN.md).
pnpm test:affected --base origin/master reports conservative ownership;
--suite unit --run or --suite e2e --run runs selected checks locally.
Selection is observation-only in CI and does not replace its full gate.
test:release-tooling covers selection, shard completeness and release readiness.

Keep coverage ratchets, including 85% line and 100% function coverage for new
utilities and API routes. Preserve behavior-based tests, emulator permission
checks, Playwright coverage of major flows, and per-entry/aggregate lazy/PWA
bundle budgets. E2E authentication must not enter production builds. Do not
weaken thresholds, omit changed production code or mock away failing behavior.
Fix failures caused by the change and rerun affected checks; report concrete
blockers for checks that cannot run.

## CI and release changes

Pin third-party actions to immutable SHAs. Use repository-restricted Google
Workload Identity Federation for production authentication; never add
service-account JSON, refresh tokens or long-lived deploy secrets.

Keep infra/gcp/production-deployment.json, Function exports, Hosting rewrites
and secret bindings synchronized. Verification must fail on unexpected Functions
or invoker drift; never auto-delete unknown cloud resources.

For an authorized release, follow .github/workflows/ci.yml through protected
merge to master, artifact build, declared indexes, bounded game Cloud Run image
and Functions deployment, game HTTP readiness, Hosting/rules, and live
health/browser verification. Inspect the final workflow result. Direct Functions
deployment must not bypass this workflow.

Verify Current Production repeats read-only health/browser checks; it neither
clears an earlier failure nor proves a commit was deployed. See
[security operations](../../../docs/SECURITY_OPERATIONS.md) for deployment controls.

Complete authorized preparation and verification. Deployment, secret rotation,
environment changes and production data writes need explicit approval covering
the action; build/test approval alone is insufficient. Honor existing session
approval without requesting it again.
