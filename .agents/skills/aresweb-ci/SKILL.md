---
name: aresweb-ci
description: Modify or diagnose ARESWEB linting, TypeScript, Vitest, Firebase emulator rules tests, Playwright, bundle budgets, GitHub Actions, dependency audits, builds, and deployment workflows. Use for any code handoff or CI/CD change.
---

# ARESWEB verification and delivery

Use Node 24.15 or newer in the Node 24 line, pnpm 11.21.0, and Java 21 or
newer for Firebase emulators. Treat `package.json`, `functions/package.json`,
and `.github/workflows/ci.yml` as authoritative.

## Required checks

Run the root `AGENTS.md` verification gate, including both frontend and Functions lint.
Use focused tests while iterating, then run the full gate before handoff.

`pnpm test:affected --base origin/master` reports conservative area ownership;
add `--suite unit --run` or `--suite e2e --run` for local iteration. CI remains
in observation mode and runs the full gate. Run `pnpm test:release-tooling` for
the selector, shard completeness, and release readiness coverage gate. See
`docs/AREA_TESTING_AND_RELEASE_PLAN.md` for rollout prerequisites.

- Do not lower thresholds, exclude changed production code, or replace failing
  tests with mocks that bypass the behavior under test.
- Require 85% line and 100% function coverage for new utilities and API routes.
- Use Firebase Emulator Suite tests for rule behavior and Playwright for major
  user flows. Keep E2E-only authentication behavior out of production builds.
- Enforce both per-entry and aggregate lazy/PWA bundle budgets.
- Pin third-party actions to immutable commit SHAs.
- Authenticate production deploys only through the repository-restricted Google
  Workload Identity Federation provider.
- Keep `infra/gcp/production-deployment.json`, Function exports, Hosting
  rewrites, and secret bindings synchronized. Production verification must fail
  on unexpected Functions or public/private invoker drift; never auto-delete
  unknown cloud resources.
- Never add service-account JSON, refresh tokens, or long-lived deploy secrets.

Production delivery uses `.github/workflows/ci.yml` after a protected merge to
`master`: build the verified artifact, deploy and wait for declared indexes,
deploy the bounded game Cloud Run image and declared Functions, verify game HTTP
readiness, switch Hosting/rules, then verify live health and browser security.
The manual `Verify Current Production` workflow repeats read-only health/browser
verification without redeployment; it does not erase an earlier failure or prove
a commit was deployed. Check the run's final result; a merge is not a completed deploy.
Do not use the package's direct Functions deploy command to bypass this workflow.

Do not deploy, rotate secrets, change environments, or mutate production data
without explicit user approval. Build and test approval does not imply deployment
approval. Report every skipped check with its concrete environmental blocker.
