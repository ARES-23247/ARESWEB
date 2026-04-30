# Milestone v4.0 Requirements

## System Hardening & Test Audit
- [ ] **AUDIT-01**: Conduct a full codebase audit to identify and replace brittle test assertions with robust, state-independent checks.
- [ ] **AUDIT-02**: Expand unit and E2E test coverage to exceed the established 85% industry standard baseline for critical backend and frontend paths.

## Storefront Completion
- [ ] **STORE-01**: Route Stripe checkout webhook events to a dedicated Zulip stream for reliable real-time admin order notifications.
- [ ] **STORE-02**: Implement database-level inventory tracking and stock depletion upon successful checkout, preventing out-of-stock purchases.
- [ ] **STORE-03**: Build an isolated, comprehensive webhook testing suite utilizing Stripe event mocks to guarantee payment synchronization reliability without relying on external network dependencies.

## Member Activity Points
- [ ] **MEMBER-01**: Implement a gamified points ledger in the database to track individual member contributions.
- [ ] **MEMBER-02**: Automate point accrual triggers for completing assigned Kanban tasks and registering for scheduled events.
- [ ] **MEMBER-03**: Provide a UI dashboard for members to view their points balance, recent activity history, and travel eligibility standing.

## Tech Stack Documentation
- [ ] **DOCS-01**: Update the project README and developer onboarding guides to accurately reflect the Cloudflare D1 and Hono edge backend architecture.
- [ ] **DOCS-02**: Document the real-time collaborative editing ecosystem, explicitly highlighting the integration of Liveblocks and Tiptap.
- [ ] **DOCS-03**: Add comprehensive documentation covering the use of the autonomous GSD AI orchestration pipeline for project management.

---

## Future Requirements
*None deferred currently.*

## Out of Scope
- **Transactional Email Receipts**: Deferred in favor of Zulip admin alerts (as requested by user) to minimize reliance on external email delivery services.

## Traceability
- **AUDIT-01, AUDIT-02, STORE-03**: Mapped to Phase 33
- **STORE-01, STORE-02**: Mapped to Phase 34
- **MEMBER-01, MEMBER-02, MEMBER-03**: Mapped to Phase 35
- **DOCS-01, DOCS-02, DOCS-03**: Mapped to Phase 36
