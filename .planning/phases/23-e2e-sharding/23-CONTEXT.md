# Phase 23: E2E Suite Sharding - Context

## Background
Following the initial parallelization of `ci.yml` (Phase 22), the end-to-end tests remained the primary bottleneck. The `e2e-tests` job contained both the complete Playwright UI test suite and the Pa11y accessibility suite, resulting in sequential execution delays.

## Objective
To further optimize CI speed by utilizing GitHub Actions Matrix strategies. Playwright tests will be sharded across 3 concurrent runners, and Pa11y tests will run in an isolated job, dramatically reducing the overall wall-clock time for the E2E verification gate.
