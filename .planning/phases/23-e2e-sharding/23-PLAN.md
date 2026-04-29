# Phase 23: E2E Suite Sharding - Plan

## Proposed Architecture
- **Job Splitting**: Replace the `e2e-tests` job in `.github/workflows/ci.yml` with two dedicated jobs:
  - `e2e-playwright`: A matrix job (`strategy.matrix.shard: [1, 2, 3]`).
  - `e2e-pa11y`: An isolated accessibility testing job.
- **Execution Modification**:
  - In `e2e-playwright`, execute `npx playwright test --shard=${{ matrix.shard }}/3` to distribute the test load evenly.
- **Dependency Map**: Update `deploy-preview` to rely on `needs: [..., e2e-playwright, e2e-pa11y]` to handle matrix aggregation natively.

## Verification Strategy
- Validate that the GitHub Actions schema parses successfully.
- Ensure that the E2E matrix creates exactly 3 sub-jobs.
- Verify `deploy-preview` awaits all 3 shards.
