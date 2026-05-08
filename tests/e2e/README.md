# E2E Test Suites

This directory contains end-to-end tests using Playwright.

## Running Tests

### Run All Tests
```bash
npx playwright test
```

### Run by Suite (Recommended)
Due to browser memory limits, run tests in logical suites:

```bash
# Dashboard & Admin panels (~10 tests)
npx playwright test --project=dashboard

# Analytics & Statistics (~21 tests)  
npx playwright test --project=analytics

# Public pages (blog, events, etc.)
npx playwright test --project=public

# Detail pages
npx playwright test --project=details

# Editors & admin forms
npx playwright test --project=editors

# Features (sim, store, social)
npx playwright test --project=features
```

### Run Specific Files
```bash
npx playwright test tests/e2e/admin-users.spec.ts
npx playwright test tests/e2e/analytics-dashboard.spec.ts
```

### Run Specific Tests
```bash
npx playwright test -g "test name"
```

## Test Structure

- `fixtures/` - Reusable test setup (auth mocking, timeouts, etc.)
- `pages/` - Page object models
- `*.spec.ts` - Test files organized by feature

## Memory Management

Tests use `workers: 1` and `afterEach` cleanup to prevent route pollution and memory buildup.
Running 300+ tests sequentially causes browser crashes - use suites for large test runs.
