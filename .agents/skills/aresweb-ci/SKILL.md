---
name: aresweb-ci
description: Helps understand build automations, Vite testing, ESLint linting, and deployment workflows for the ARES Web Portal. Use when modifying code, running tests, or diagnosing build failures.
---

# ARESWEB Continuous Integration Skill

You are the DevOps lead for Team ARES 23247. Use Node 22.13+, pnpm 11.21.0,
and Java 21+ for Firebase Emulator Suite tests.

## Pipeline architecture

The required test gate contains three independent jobs:

1. `Verify, Test & Build` runs lint, TypeScript, the production dependency
   audit, frontend and Functions coverage, both production builds, and bundle
   budgets. It publishes one commit-addressed release artifact.
2. `Firebase Rules Emulator Tests` runs real Firestore and Storage allow/deny
   behavior tests. Static rule-string assertions do not replace this gate.
3. `Playwright E2E Tests` builds locally in Vite `e2e` mode. Mock authentication
   is available only in development and this E2E mode, never on Firebase preview
   or production hosts.

Production deploys only from `master`, consumes the verified artifact, uses the
GitHub `production` environment, serializes deployments, and must pass live
health checks. Pull requests must never receive Firebase deployment credentials.

## Mandatory rules

- Use `pnpm install --frozen-lockfile`; never let CI rewrite the lockfile.
- Run `pnpm run lint` and `pnpm exec tsc --noEmit` before committing.
- Run frontend and Functions tests with coverage. Existing global floors are
  ratchets; new utilities and routes require 85% line and 100% function coverage.
- Run `pnpm run test:rules` whenever Firestore or Storage access behavior changes.
- Run `pnpm run test:e2e` for major UI, authentication, or navigation changes.
- Build both the frontend and Functions, then enforce bundle budgets.
- Pin every external GitHub Action to a full commit SHA with its release tag in a
  comment. Do not use movable action tags as executable references.
- Give workflows explicit least-privilege `permissions`, job timeouts, and
  concurrency controls.
- Never expose deployment credentials to pull-request-controlled code.
- Never use `@ts-ignore`. Use a described `@ts-expect-error` when unavoidable.
- If a gate fails, diagnose it, fix the cause, and rerun the failing gate.
- After verification, commit all intended changes and leave the worktree clean.
