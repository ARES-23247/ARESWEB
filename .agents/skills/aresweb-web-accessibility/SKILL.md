---
name: aresweb-web-accessibility
description: Audits, tests, and enforces web accessibility standards (WCAG 2.1 AA) on the ARESWEB Next.js website and frontend code. Use this when building or reviewing UI components, HTML, CSS, or frameworks to ensure they achieve a perfect 10.0 AIM score and maintain compliance for screen readers and keyboard navigation.
---

# ARESWEB Web Accessibility Enforcement Strategy
You are an expert accessibility engineer enforcing the championship-grade standards of the ARES 23247 ecosystem. Our commitment to **Inclusion** ensures that every student has the same opportunity for **Discovery**. When working on frontend code or UI components:

## Core Directives
* **Semantic HTML First:** Always prefer native elements (`<button>`, `<dialog>`, `<nav>`, `<fieldset>`) over `<div>` or `<span>` tags with ARIA roles attached. Never skip heading hierarchies (e.g., `<h1>` down to `<h2>` without skipping to `<h4>`).
* **Keyboard Navigability:** Ensure all interactive elements are reachable via the `Tab` key. Focus states (`:focus-visible`) must be explicitly handled and visible. Do not use `outline: none` without providing a standard fallback focus state.
* **Screen Reader Context (ARIA):**
  * Use `aria-hidden="true"` on purely decorative icons or background graphical flourishes.
  * Ensure functional icons without text have descriptive `aria-label`s or visually hidden Tailwind `.sr-only` text.
  * Explicitly denote interactive graphical simulations (like robot odometry `<canvas>`) with `<canvas role="img" aria-label="Interactive simulation of...">`.
* **Color Contrast Validation:** Text and interactive elements must have a minimum contrast ratio of **4.5:1** against their background for standard text. Default to high-contrast cyan (`text-ares-cyan`) or red (`text-ares-red`) against our dark theme.
* **Forms & DOM Hygiene:** Every `<input>`, `<textarea>`, and `<select>` MUST have an explicitly associated `<label>` using the `htmlFor`/`id` pattern in React.

## Testing Protocol
1. Ensure components render cleanly on the Cloudflare Edge.
2. Fix "Orphaned form labels" or "Unlabeled form controls" immediately. Use semantic form controls inside Next.js Server Components or Client-side actions safely.
3. **Hierarchy Traversal:** Whenever rendering dynamic pages or complex layouts, ensure a visually-hidden `Skip to content` link exists in the header layout to allow keyboard users to bypass the Navigation bar.

## Next.js / React Theming Fixes
Because ARESWEB uses a futuristic dark theme via Tailwind CSS:
1. Ensure focus rings match the aesthetic (e.g. `focus-visible:ring-ares-cyan`).
2. Do not use hardcoded black text on dark components unless visually separated by glassmorphic boundaries.
3. Injected inline elements or custom React interactive dashboards must map properly to transparent custom fallbacks rather than hardcoded colors, ensuring components hydrate seamlessly from the server.
