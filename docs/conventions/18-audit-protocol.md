# High-Fidelity Audit Protocol

> 12-pillar code review protocol. Use when auditing files, components, or systems.

## 12 Pillars of Excellence

1. **Security** — Auth middleware, bound parameters, Zod validation, rate limiting, fail-closed logic
2. **Privacy** — YPP/COPPA compliance, encrypted PII, payload minimization
3. **Accessibility** — WCAG 2.1 AA, semantic HTML, @tanstack/react-table for grids
4. **Brand** — ARES palette, League Spartan/Inter typography, no arbitrary hex
5. **Efficiency** — Query optimization, react-hook-form, @tanstack/react-virtual for lists
6. **Refactoring** — Tremor charts, driver.js tours, React Flow diagrams, Vaul drawers
7. **Portability** — Relative routing, env variables, boundary integrity
8. **Functionality** — Schema sync, soft-delete, audit logging, failure exposure
9. **Testing** — E2E for vital paths, Vitest 85%/100% coverage, MSW mocking
10. **Architecture** — Middleware sequence, gateway mounting
11. **DevOps** — Clean temp files, remove console.log
12. **Scalability** — `waitUntil` for async tasks, GC patterns

## Parallel Auditing

For large audits: Split into domains, use parallel `generalist` subagents, synthesize findings.

## Report Format

1. Header (Date, Scope)
2. Scorecard table (Pillar | Grade | Critical items)
3. Sectioned detail (✅ Strengths / ⚠️ Findings)
4. Findings table (ID | Severity | Finding | Location)
5. Roadmap (🔴 Must Fix / 🟡 Should Fix / 🟢 Backlog)

Tone: "Gracious Professionalism" — helpful, encouraging, rigorous.
