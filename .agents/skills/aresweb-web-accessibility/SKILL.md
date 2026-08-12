---
name: aresweb-web-accessibility
description: Build or review ARESWEB React UI for WCAG 2.2 AA accessibility, responsive interaction, truthful user-facing copy, design-token use, and brand consistency. Use for components, pages, dialogs, forms, simulations, visual styling, or accessibility claims.
---

# ARESWEB frontend quality

The frontend is Vite, React 19, React Router, and Tailwind CSS. Inspect the live
design tokens and components before changing styling; do not assume Next.js.

## Interaction

- Use semantic HTML and native controls before ARIA.
- Preserve visible focus, logical tab order, skip navigation, route announcements,
  and keyboard access for every pointer action.
- Give dialogs correct labels, initial focus, focus containment, Escape behavior,
  and focus restoration. Coordinate nested dialogs instead of stacking traps.
- Keep hidden mobile or collapsed content out of the accessibility tree and tab
  order with appropriate unmounting or `inert` behavior.
- Keep file inputs keyboard accessible. Associate every input with a label and
  expose validation and async status programmatically.
- Provide non-canvas alternatives for essential simulation state and controls.
- Respect reduced motion and meet WCAG AA contrast at actual rendered sizes.

## Content and visual system

- Use established semantic brand tokens; do not add arbitrary color values or
  generic cyan decoration.
- Write concise user-facing instructions understandable by students and families.
- Describe actual product behavior. Do not promise unavailable AI, offline,
  privacy, API, or storage features.
- Do not hide text in pseudo-elements, alter semantics, or disable checks to make
  an automated scanner pass.

Automated Axe/Pa11y-style checks are supporting evidence only. Test keyboard,
screen-reader semantics, zoom/reflow, contrast, touch targets, and error recovery
manually for changed flows. Never publish a perfect score or compliance claim
without a dated scope and reproducible evidence.
