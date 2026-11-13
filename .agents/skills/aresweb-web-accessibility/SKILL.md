---
name: aresweb-web-accessibility
description: Build or review ARESWEB interfaces for accessibility, responsive behavior, printables, and brand consistency.
---

# ARESWEB frontend quality

Use the live design tokens (`design/ares-design-tokens.json`,
`src/styles/ares-design-tokens.css`) and components for this Vite/React
Router/Tailwind frontend. Apply every requirement relevant to the changed
surface.

## Interaction, landmarks, and print contracts

Use semantic HTML and native controls. Preserve one semantic `<h1>` per view
(including 404, empty, and lockscreen states), visible `:focus-visible`, logical
tab order, skip navigation, route announcements, and keyboard access to pointer
actions. Dialogs and drawers need labels, initial focus, focus containment,
`Escape` handling, and focus restoration; coordinate nested focus traps. Hidden
mobile or collapsed content must leave the accessibility tree and tab order via
unmounting or `inert` behavior.

Keep file inputs keyboard accessible, label inputs, and expose validation and
async status programmatically. Canvas/SVG tools (simulations, QR cards, and
`src/lib/blogShareKit.ts` / `BlogShareKitModal.tsx` image cards) need
non-visual alternatives, readable fallbacks when CORS prevents image tainting,
and reduced-motion respect. Avoid endless `animate-pulse` or `animate-bounce`
animations on static non-loading UI.

Meet WCAG 2.2 AA contrast (`>= 4.5:1` normal text, `>= 3.0:1` large text/UI)
across default, `:hover` (especially `.clipped-button:hover` and bronze/gold
accents using `--ares-on-bright-accent`), disabled, and `@media print` states
(Pit Spec Cards, Judges' Handouts, Travel Emergency Binders).

## Content, prerendering, and styling

Use semantic brand tokens; avoid arbitrary `#[0-9a-fA-F]` hex classes and
generic cyan decoration. Keep `scripts/prerender-static-routes.mjs` synchronized
with live route capabilities, eligibility, game rosters, and canonical
`https://aresfirst.org` URLs, and preserve homepage OAuth identity
(`ARES Robotics Studio`, `/privacy`, `/terms`) without funneling signed-out
visitors into `/dashboard/*` walls.

Write for students and families using actual product behavior and authentic
team records (`PublicDataState`). Empty catalogs need truthful empty states or
official links; never invent hardware, CAD, datasets, sponsors, alumni, or
awards. In `src/app/globals.css`, keep all `@import` statements consecutive and
before `@source` so design tokens are preserved.

## Evidence

Combine automated component/contrast/E2E checks with rendered inspection,
keyboard traversal, `320px` reflow, hover/print contrast, and error-recovery
checks. Record manual checks that remain unverified. Public compliance or
perfect-score claims require a dated scope and reproducible evidence.
