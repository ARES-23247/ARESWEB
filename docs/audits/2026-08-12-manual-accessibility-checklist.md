# Manual Accessibility Verification Checklist

**Prepared:** 2026-08-12
**Last automated review:** 2026-08-20
**Status:** Pending manual execution
**Scope:** Post-audit contrast, focus containment, route announcements, and
simulation keyboard alternatives

Automated unit tests validate focus wrapping, leaked-focus containment,
top-layer Escape behavior, trigger restoration, semantic contrast ratios, and
the simulation interaction contract. They do not establish WCAG conformance or
replace the following checks with actual assistive technologies and browser
layout engines.

The 2026-08-20 automated browser matrix passed 95 tests across desktop
Chromium, Firefox, and WebKit plus Pixel 7 Chromium and iPhone 15 WebKit. It
includes 320 CSS-pixel homepage, public-navigation, dashboard-navigation, and
simulation-playground checks. The simulation check verifies that the editor
does not create document-level horizontal overflow, the toolbar remains inside
the viewport, and its input/buttons remain at least 44 by 44 CSS pixels. This
evidence narrows the manual work below; it does not replace NVDA, VoiceOver,
forced-colors, browser zoom, or physical touch-device testing.

## Test environments

- Windows 11, current Firefox, NVDA current stable
- macOS, current Safari, VoiceOver
- Chromium with Windows High Contrast/forced-colors enabled
- Browser zoom at 200% and 400%, with the viewport reduced to 320 CSS pixels
- Keyboard only: Tab, Shift+Tab, arrows, Home, End, Enter, Space, and Escape

Record the browser, assistive-technology version, viewport, route, result, and a
screen recording or issue link for every failure.

## Route navigation and current state

1. Navigate among `/`, `/academy`, `/calendar`, `/gallery`, `/robots`, and
   `/tournaments` using only links and the keyboard.
2. Confirm each route change announces the new `h1` once and moves focus to it.
3. Confirm the focused heading remains visibly outlined and the next Tab moves
   into the new page, not the previous route.
4. Confirm public and dashboard navigation announce the current page, and the
   inquiries destination announces its pending state when present.
5. Repeat through one lazy-loaded route on a throttled connection; confirm the
   loading status is announced without repeated chatter.

## Modal and drawer focus

For every surface below, confirm initial focus, forward and reverse wrap,
outside-click behavior, a single top-layer Escape action, and return to the
exact trigger:

- Public mobile navigation and dashboard mobile navigation
- Academy search and negative-feedback dialogs
- Outreach request/demo dialog
- Public event and tournament photo lightboxes
- Task details modal
- Document editor drawer, then its nested photo picker
- Event editor drawer, then each nested photo lightbox, photo picker, location
  manager, and archive/restore confirmation

While a nested surface is open, use browser accessibility tools to confirm the
obscured parent cannot receive focus. Close the nested surface and confirm the
parent resumes at the invoking control rather than its first field.

## Contrast and forced colors

1. Inspect error messages, destructive actions, archived badges, hover text,
   and red icons on `/join`, `/academy`, `/blog`, `/events/:id`, `/privacy`,
   `/terms`, and the dashboard users/inquiries/documents/tournaments screens.
2. Confirm dark-surface red text renders from `--ares-red-light` and remains at
   least 4.5:1 for normal text and 3:1 for meaningful graphics.
3. Confirm brand red on white surfaces remains at least 4.5:1.
4. In forced-colors mode, confirm every interactive control retains a visible
   focus indicator and selected/error states are not communicated by color
   alone.
5. Exercise hover, focus, disabled, loading, error, archived, and selected
   states; static token tests cannot measure composited images or browser
   forced-color substitutions.

## Reflow and touch target checks

1. At 400% zoom and 320 CSS pixels, verify no two-dimensional scrolling is
   required for text content and no dialog controls are clipped.
2. Check Academy navigation, photo-management tabs, event-editor tabs, task
   details, document editor, and all nested dialogs.
3. Confirm sticky headers/footers do not cover the focused element and that
   horizontal tab strips can scroll without trapping keyboard focus.
4. On a touch device, verify essential targets are at least 24 by 24 CSS pixels
   with adequate spacing and that pointer gestures have single-pointer/native
   control alternatives.

## Simulation checks

Run one simulation from each interaction family using only the keyboard:

- Canvas positioning: Autonomous Visualizer, Physics, Vision, Shoot-on-the-Move
- Game interaction: Pollination
- SVG coordinate manipulation: circles, quadratics, scatterplots, systems of
  inequalities, triangles, linear equations, and trigonometry
- Grid drawing: Machine Vision digit classifier

Confirm the native controls change the same values as pointer interaction,
current state/results are announced without excessive updates, and the hidden
canvas/SVG does not create a duplicate or misleading screen-reader object.

## Acceptance record

This checklist is complete only after all combinations above have dated PASS or
linked-defect results. Do not publish a WCAG conformance level, “zero issues,” or
a perfect accessibility score based solely on the automated tests.
