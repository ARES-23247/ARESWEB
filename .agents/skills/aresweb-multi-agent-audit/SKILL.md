---
name: aresweb-multi-agent-audit
description: Run a comprehensive codebase audit using multiple parallel subagents specializing in security, accessibility, brand/hygiene, performance, SEO, tests, and UI feature gap analysis.
---

# ARESWEB Multi-Agent Codebase Audit Protocol

This skill dictates how to orchestrate a championship-grade, parallel codebase audit of the ARESWEB portal using multiple concurrent subagents.

## 👥 The Specialized Subagents

When executing this audit, spawn **7 concurrent subagents** with the following specific scopes:

1.  **Security & Privacy Auditor**: Checks route security (`ensureAuth`), Firebase security rules, client-side Firestore access gating, and PII protection.
2.  **Web Accessibility (WCAG) Auditor**: Audits frontend React code for keyboard navigation compliance, focus indicators, modal focus traps, and ARIA roles.
3.  **Code Quality, Brand, and DevOps Auditor**: Audits Tailwind grays / brand colors conformity, ESLint setups, modular code boundaries (500-line limits), and logger integration.
4.  **Performance & Assets Optimizer**: Checks asset sizes, lazy loading configurations, bundle splitting bottlenecks, and query pagination.
5.  **SEO & Rich Snippets Auditor**: Audits page titles, descriptions, Open Graph data, and structured schemas (JSON-LD).
6.  **Test Coverage & Edge-Case Auditor**: Identifies testing gaps, scans Vitest mock behaviors, and evaluates Playwright E2E coverage.
7.  **Missing Features & UI Auditor**: Conducts gap analysis to find missing user features, dashboard enhancements, and UI polish items.

## 📝 Compiling the Scorecard

Once all subagents write their reports under the scratch directory (`scratch/*.md`), the lead agent compiles their findings into the unified report scorecard (`final_audit_scorecard.md`) matching the 12 pillars of excellence.
