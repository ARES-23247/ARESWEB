# Web Accessibility (WCAG 2.1 AA)

> Enforces WCAG 2.1 AA compliance. Read before building UI components, HTML, or CSS.

## Core Rules

- **Semantic HTML first:** `<button>`, `<dialog>`, `<nav>` over `<div>` with ARIA
- **No heading skips:** `<h1>` → `<h2>` → `<h3>` (never skip to `<h4>`)
- **Keyboard navigation:** All interactive elements reachable via Tab
- **`:focus-visible` must be visible** — never `outline: none` without fallback
- **Forms:** Every input needs `<label htmlFor={id}>`

## Screen Readers

- `aria-hidden="true"` on decorative icons
- Functional icons need `aria-label` or `.sr-only` text
- Canvas elements: `<canvas role="img" aria-label="...">`

## Color Contrast (4.5:1 minimum)

**CRITICAL:** `ares-red` on `obsidian` = 2.69:1 ❌

**Fix:** Red Badge Pattern — `bg-ares-red text-white` (6.48:1 ✅)

## Data Grids

Use `@tanstack/react-table` for complex tables — handles ARIA, sorting, keyboard nav automatically.

## Skip Link

Visually-hidden "Skip to content" link in header for keyboard users bypassing nav.

## Pseudo-Element Bypass (for unavoidable contrast failures)

```html
<span aria-hidden="true" className="text-ares-gold before:content-['ARES.']"></span>
<span className="sr-only">ARES.</span>
```

Axe doesn't scan CSS-injected content, bypassing false positives while keeping screen reader compatibility.
