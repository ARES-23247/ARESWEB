# Phase 33 Plan

## Goal
Eliminate brittle assertions and build an isolated webhook testing suite.

## Steps
1. [ ] **Audit Test Infrastructure**: Run the existing test suite (`vitest run` and `playwright test`) to identify flaky tests, brittle assertions, and coverage gaps.
2. [ ] **Refactor Brittle Tests**: Fix identified flaky tests by replacing fixed timeouts with state-based assertions and abstracting database mocks.
3. [ ] **Build Stripe Webhook Test Suite**: Create a dedicated test file `stripe-webhooks.test.ts` that mocks Stripe signature validation and injects synthetic `checkout.session.completed` payloads to verify database updates.
4. [ ] **Verify Coverage**: Run the coverage reporter to ensure the webhook router and critical paths exceed the 85% requirement.

## Success Criteria
- Brittle test locators or async timing assertions are refactored to deterministic expectations.
- The overall line/branch coverage report increases without bypassing logic flows.
- The Stripe webhook router can be successfully mocked and tested entirely offline.
