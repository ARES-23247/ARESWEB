---
name: aresweb-inclusive-design
description: Unified ARESWEB accessibility: WCAG 2.1 AA and 8th-grade readability.
---

# ARES Inclusive Design

## 1. Technical Accessibility (WCAG 2.1 AA)
- **Contrast**: 4.5:1 minimum (text). 3:1 (large text/UI).
- **Semantics**: `<button>` for actions, `<a>` for nav. Labels for icons/canvases.
- **Focus**: Visible rings on all interactive elements using `ares-cyan`.
- **Forms**: Every input MUST have a programmatically linked `<label>`.
- **Nav**: 100% functionality must be reachable via Tab + Enter.

## 2. Cognitive Accessibility (8th Grade Level)
Maintain **Flesch-Kincaid < 8.0** for all documentation and UI copy.
- **Active Voice**: "React hydrates the site" (NOT "is hydrated by").
- **Simplicity**: "Use" instead of "Utilize". Short sentences (<20 words).
- **Concrete First**: Explain what it *does* before *how* it works.
- **Bridging**: Use simple analogies for technical concepts (e.g., "Edge Worker is like a drive-thru window").

## 3. Verification
- **Axe-core**: Run `AxeBuilder` in all Playwright E2E tests.
- **AIM Score**: Maintain 10.0 AIM score across all Next.js pages.
