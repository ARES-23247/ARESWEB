# Web Accessibility (WCAG 2.2 AA)

> Targets WCAG 2.2 AA. Read before building UI components, HTML, or CSS.

## Core Rules

- **Semantic HTML first:** `<button>`, `<dialog>`, `<nav>` over `<div>` with ARIA
- **No heading skips:** `<h1>` → `<h2>` → `<h3>` (never skip to `<h4>`)
- **Keyboard navigation:** All interactive elements reachable via Tab
- **`:focus-visible` must be visible** — never `outline: none` without fallback
- **Forms:** Every input needs `<label htmlFor={id}>`

## Screen Readers

- `aria-hidden="true"` on decorative icons
- Functional icons need `aria-label` or `.sr-only` text
- Canvas elements: provide native keyboard controls and a text/state equivalent;
  hide the canvas with `aria-hidden="true"` once the equivalent is complete

## Color Contrast (4.5:1 minimum)

**CRITICAL:** `ares-red` on `obsidian` = 2.69:1 ❌

**Fix:** Use `text-ares-red-light` on dark surfaces (6.27:1), or the Red Badge
Pattern — `bg-ares-red text-white` (6.48:1). Use brand `text-ares-red` only on
verified light surfaces.

## Data Grids

Use `@tanstack/react-table` for complex tables — handles ARIA, sorting, keyboard nav automatically.

## Skip Link

Visually-hidden "Skip to content" link in header for keyboard users bypassing nav.

## Automated Checks

Never hide content, inject replacement text through CSS, or exclude real UI to
evade a scanner. Fix the rendered contrast and interaction. Treat Axe/pa11y as
supporting evidence and complete keyboard, screen-reader, zoom, reflow, and
high-contrast manual checks for changed flows.
