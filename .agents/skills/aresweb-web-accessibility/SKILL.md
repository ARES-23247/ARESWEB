---
name: aresweb-web-accessibility
description: Build or review ARESWEB interfaces for accessibility, responsive behavior, and brand consistency.
---

# ARESWEB frontend quality

Use the live design tokens and components for this Vite/React Router/Tailwind
frontend. Apply the requirements relevant to the changed interaction.

## Interaction contracts

Use semantic HTML and native controls. Preserve visible focus, logical tab
order, skip navigation, route announcements and keyboard access to pointer
actions. Dialogs need labels, initial focus, containment, Escape and restoration;
coordinate nested focus traps. Hidden mobile/collapsed content must leave the
accessibility tree and tab order through unmounting or appropriate inert behavior.

Keep file inputs keyboard accessible, label inputs, and expose validation and
async status programmatically. Essential simulation state and controls need
non-canvas alternatives. Respect reduced motion and WCAG AA contrast at rendered
sizes.

## Content and styling

Use semantic brand tokens; avoid arbitrary colors and generic cyan decoration.
Write for students and families using actual product behavior and authentic
team records. Empty catalogs need truthful empty states or official profile links.
Do not invent hardware, models, datasets, sponsors, alumni, awards or unavailable
AI/offline/privacy/API/storage features.

In src/app/globals.css, keep CSS imports consecutive and before Tailwind source
directives; interleaving drops design tokens. Verify rendered colors for styling
changes. Do not hide text, alter semantics or disable checks to pass a scanner.

## Evidence

For changed flows, combine applicable automated checks with keyboard,
screen-reader semantics, zoom/reflow, rendered contrast, touch-target and
error-recovery inspection. Record manual checks that remain unverified. Public
compliance or perfect-score claims require a dated scope and reproducible evidence.
