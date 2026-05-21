# ARES Web Portal Comprehensive Codebase Audit Plan

## Objective
Perform a high-fidelity, multi-domain audit of the ARES Web Portal codebase (`c:\Users\david\dev\robotics\ftc\ARESWEB`) against the 12 Pillars of Excellence in the Team ARES audit protocol, producing a comprehensive compliance report (`AUDIT_REPORT.md` in the workspace root) and a prioritized roadmap to compliance.

## Multi-Domain Decompositions & Milestones

| # | Milestone Name | Description / Scope | Subagents Involved | Status |
|---|----------------|---------------------|--------------------|--------|
| **M1** | Parallel Multi-Domain Audit | Audit the codebase in three distinct domains in parallel against all 12 Pillars of Excellence. | `explorer_audit_backend`, `explorer_audit_frontend`, `explorer_audit_testing` | PLANNED |
| **M2** | Findings Consolidation & Synthesis | Aggregate and analyze findings from the three sub-agents, resolve conflicts, and construct the unified Findings Table and roadmap. | `orchestrator` | PLANNED |
| **M3** | Compile `AUDIT_REPORT.md` | Spawn a worker to write the final high-fidelity `AUDIT_REPORT.md` in the workspace root, meeting all acceptance criteria exactly. | `worker_audit_writer` | PLANNED |
| **M4** | Review & Forensic Audit Gate | Perform independent reviews of the audit report and execute a forensic audit to ensure absolute accuracy and integrity. | `reviewer_audit`, `auditor_audit` | PLANNED |

## Domain Boundaries for Subagents

### Domain 1: Backend API, Security, & Database (R1)
- **Subagent**: `explorer_audit_backend`
- **Scope**:
  - Hono API routes and routing structure in `src/routes/` or `functions/`.
  - Authentication/authorization checks (`ensureAuth`, `ensureAdmin`).
  - OpenAPI & Zod input validation schemas and response payload boundaries.
  - Turnstile verification fail-closed logic and rate-limiting middleware.
  - Cloudflare D1 query patterns: scan for string concatenations vs bound (`?`) parameters.
  - D1 database schemas, indices, migration history (`schema.sql` vs D1 states).
  - Async context task execution via `c.executionCtx.waitUntil()`.
- **Primary Skills Armed**: `aresweb-database-management`, `aresweb-error-handling`, `aresweb-failure-exposure`, `aresweb-typescript-safety`, `aresweb-api-reference`, `aresweb-youth-data-protection`

### Domain 2: Frontend Component, Brand, & Accessibility (R2)
- **Subagent**: `explorer_audit_frontend`
- **Scope**:
  - Next.js/React components, pages, and layout structures (`src/components/`, `src/pages/`).
  - Strict ARES Brand Palette enforcement (`ares-red`, `ares-gold`, CSS vars, no arbitrary Tailwind scales/raw hexes).
  - Web accessibility compliance (WCAG 2.1 AA, contrast ratios, ARIA roles for complex tables/lists, keyboard navigation).
  - Frontend state management: Zustand (`useUIStore`) vs Contexts, React Hook Form, `nuqs` for URL deep-linking, `react-virtual` for heavy lists.
  - Guided portal tours (driver.js), analytics charts (Tremor), robotics visualizations (R3F, React Flow), mobile drawers (Vaul).
  - Payload boundaries (checking if frontend receives unnecessary fields).
- **Primary Skills Armed**: `aresweb-brand-enforcement`, `aresweb-web-accessibility`, `aresweb-youth-data-protection`, `aresweb-cultural-legacy`, `aresweb-documentation-readability`

### Domain 3: Test Coverage & Environment Hygiene (R3)
- **Subagent**: `explorer_audit_testing`
- **Scope**:
  - Vitest unit/integration test suites (coverage: minimum 85% line, 100% function).
  - Playwright E2E integration pathways and visual regression capabilities.
  - Mock integrity (MSW for API mocks, Hono mock execution context).
  - Code hygiene: scan for developmental residues (lingering `console.log`, debugging comments, unused imports).
  - File cleanliness: search for untracked scratch/temp files (`fix_*.mjs`, `scratch/`, etc.) in production paths.
- **Primary Skills Armed**: `aresweb-testing-enforcement`, `aresweb-ci`

## Verification Strategy
- A complete and compliant `AUDIT_REPORT.md` is generated in the root of the workspace.
- The report is independently validated by two reviewers and gates a clean Forensic Audit.
