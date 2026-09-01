# Internal UI library baseline

Date: 2026-09-01  
Commit: `639d4e9f1b2127c5b5edd08e39d5de7a2c2c1302`  
Branch at measurement: `master` (clean)  
Runtime: Node 24.19.0, pnpm 11.21.0, Java 21.0.12

## Why this refactor exists

ARESWEB already has design tokens, a `cn()` class merger, accessible tabs, public
error states, and domain-specific Academy interaction controls. It does not yet
have a small application-wide primitive layer. Repeated control and dialog
markup makes mobile, keyboard, validation, and focus fixes harder to apply
consistently.

This is a source-maintainability and correctness refactor. It is not expected to
produce a large runtime reduction by itself because Tailwind and the bundler can
already deduplicate some generated output. Every stage must therefore report
both source and bundle deltas instead of assuming that fewer TSX lines means a
smaller production download.

## Measured baseline

Production application surface (`src/app` and `src/components`):

- 210 TypeScript/TSX files and 48,519 source lines.
- 532 `<button>` elements.
- 204 `<input>`, 29 `<textarea>`, and 67 `<select>` elements.
- 50 Radix `Dialog.Content` instances and 11 manual `role="dialog"` instances.
- No pre-existing `src/components/ui` directory.

Production bundle (`pnpm run build`, then `node scripts/check-bundle-size.mjs`):

| Budget surface | Raw bytes | Gzip bytes |
| --- | ---: | ---: |
| Initial JavaScript | 730,403 | 229,316 |
| Initial CSS | 178,411 | 23,566 |
| Total route JavaScript | 4,801,828 | 1,391,332 |
| Academy interactive JavaScript | 241,964 | 92,081 |
| Editor runtime JavaScript | 11,848,545 | 2,786,498 |

All existing bundle budgets passed at the baseline commit.

## Semantic contracts

The internal library lives under `src/components/ui`. It is not a published
package and may not import feature routes, Firebase, authorization, API clients,
Firestore DTOs, or application business types.

1. Prefer native elements. A primitive must not replace native semantics with
   ARIA when a native button, label, input, select, textarea, table, or dialog
   primitive is available.
2. All pointer actions remain keyboard operable with a visible focus indicator.
3. Icon-only actions require an accessible name. Default interactive targets
   are at least 44 CSS pixels in both dimensions; explicitly compact controls
   remain exceptional and must still meet the WCAG 2.2 minimum target rule.
4. Fields associate labels, descriptions, validation errors, required state,
   disabled state, and `aria-invalid` with their native control.
5. Loading, success, stale-data, and error messages expose an appropriate live
   region without repeatedly announcing static decoration.
6. Dialogs and drawers use Radix Dialog for labeling, focus containment,
   Escape handling, focus restoration, and portal behavior. Nested dialogs must
   be tested as a coordinated interaction rather than stacked focus traps.
7. Styling uses current semantic ARES tokens and `cn()`. Primitives expose a
   deliberately small set of variants and accept `className` for bounded layout
   composition, not for changing semantics.
8. Feature code retains data fetching, authorization, mutations, validation
   policy, user-facing copy, and entity-specific state.
9. Direct imports are preferred over a broad barrel so route-level bundling can
   be measured and accidental dependency growth stays visible.

## Migration acceptance criteria

Each migration slice must:

- preserve the existing accessible name, roles, user-visible wording, event
  handlers, disabled/pending behavior, and route/data boundaries;
- add focused component tests for the primitive and retain feature regression
  coverage for the migrated consumer;
- pass lint, typecheck, focused Vitest, build, and bundle budgets before commit;
- include keyboard, focus, 320 px reflow, 200%/400% zoom, and error-recovery
  inspection when it changes an interaction pattern;
- state the measured source and production-bundle delta;
- remain independently revertible; and
- leave obsolete CSS or bespoke components in place until searches, registries,
  tests, and builds prove that no consumer remains.

The refactor must not create a universal CRUD framework, move authorization into
UI code, lower coverage or bundle thresholds, or change production data.

## Slice 1 result: foundations and representative pilot

The first independently revertible slice added five dependency-light primitive
modules: buttons, fields, badges, asynchronous states, and Radix-backed dialogs,
drawers, and confirmations. Representative consumers cover public consent,
public data states, dashboard connection status, an administrator form, and a
nested photo-archive confirmation. Data access, authorization, validation
policy, route behavior, and user-facing wording remain feature-owned.

Measured source change:

- 509 lines were added under `src/components/ui`.
- The five migrated production consumers removed a net 31 lines.
- The initial slice therefore adds a net 478 production source lines. This is
  expected setup cost; later migrations must demonstrate reuse before more
  abstractions are accepted.

Measured production bundle after the slice:

| Budget surface | Raw bytes | Gzip bytes | Gzip change |
| --- | ---: | ---: | ---: |
| Initial JavaScript | 731,559 | 229,782 | +466 (+0.20%) |
| Initial CSS | 178,977 | 23,632 | +66 (+0.28%) |
| Total route JavaScript | 4,805,496 | 1,393,095 | +1,763 (+0.13%) |
| Academy interactive JavaScript | 241,964 | 92,096 | +15 (+0.02%) |
| Editor runtime JavaScript | 11,848,545 | 2,786,498 | unchanged |

All bundle budgets passed. Focused Vitest passed 34 tests across the primitives
and migrated consumers. The authoritative coverage gate then passed all 1,139
tests across 217 files; the new primitives have 100% line and function coverage.
The targeted Playwright matrix passed after fixing a pre-existing timing race in
the analytics-consent test; a Firefox browser-shutdown failure also passed when
rerun alone and did not reproduce as a product failure.

## Slice 2 result: confirmation reuse

Three additional feature confirmations now use the tested `ConfirmDialog`:
inquiry account/archive actions, roster-access revocation, and video archival.
The slice removes a net four production source lines while centralizing safe
cancel autofocus, pending-state close protection, minimum target sizing, focus
containment, and focus restoration. Feature-owned mutations and wording remain
unchanged. A roster-revocation regression test was added; the existing inquiry
and video lifecycle tests also pass.

Relative to slice 1, initial JavaScript changed by +7 gzip bytes, initial CSS
decreased by 13 gzip bytes, and total route JavaScript changed by +36 gzip bytes.
All bundle budgets, lint, typecheck, the production build, and 27 focused tests
passed.
