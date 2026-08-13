---
name: aresweb-ci
description: Modify or diagnose ARESWEB linting, TypeScript, Vitest, Firebase emulator rules tests, Playwright, bundle budgets, GitHub Actions, dependency audits, builds, and deployment workflows. Use for any code handoff or CI/CD change.
---

# ARESWEB verification and delivery

Use Node 22.13 or newer in the Node 22 line, pnpm 11.21.0, and Java 21 or
newer for Firebase emulators. Treat `package.json`, `functions/package.json`,
and `.github/workflows/ci.yml` as authoritative.

## Required checks

Run the root `AGENTS.md` verification gate. Also run
`pnpm --filter functions lint`; CI must lint both frontend and Functions source.
Use focused tests while iterating, then run the full gate before handoff.

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

Do not deploy, rotate secrets, change environments, or mutate production data
without explicit user approval. Build and test approval does not imply deployment
approval. Report every skipped check with its concrete environmental blocker.
