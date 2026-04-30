# Phase 22: CI Pipeline Optimization - Context

## Background
The ARESWEB repository historically used a single, sequential GitHub Actions workflow (`ci.yml`) to run all static checks, unit tests, and End-to-End Playwright tests. This monolithic `test` job took significant wall-clock time and delayed developer feedback on pull requests.

Furthermore, both `ci.yml` and `deploy.yml` were configured to trigger a Cloudflare Pages deployment upon a push to the `master` branch. This redundancy caused build conflicts and wasted CI minutes.

## Objective
To restructure the Continuous Integration pipeline by separating tasks into parallel jobs (Lint, Security, Unit Tests, E2E Tests), enabling GitHub to process them simultaneously across multiple runner instances. Additionally, decouple preview deployments in `ci.yml` from production deployments in `deploy.yml`.
