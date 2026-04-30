# Phase 22: CI Pipeline Optimization - Plan

## Proposed Architecture
- **Job Splitting**: Break the monolithic `test` job in `.github/workflows/ci.yml` into distinct, concurrent jobs:
  - `static-checks`: `tsc --noEmit` and `npm run lint`
  - `security`: `npm run audit:security`
  - `unit-tests`: `npm run test`
  - `e2e-tests`: `npm run build`, `playwright test`, and `pa11y-ci`
- **Deployment Isolation**:
  - Extract the `Deploy Preview` step into a separate `deploy-preview` job.
  - Require the `deploy-preview` job to depend (`needs:`) on the successful execution of all prior test jobs.
  - Restrict `deploy-preview` to only execute `if: github.event_name == 'pull_request'`, leaving `master` branch deployments strictly to `deploy.yml`.

## Verification Strategy
- Commit the parallelized workflow.
- Ensure the workflow triggers correctly.
- Verify test status to ensure that environmental issues (like missing Kysely database mocks in Vitest, e.g. `media.test.ts`) are detected and fixed during parallelization checks.
