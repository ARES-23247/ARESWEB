# Phase 74: SimRegistry Form Migration

## Domain
This phase focuses on migrating the legacy HTML `<input>` elements within the SimRegistry components (such as `SimPickerModal`) to the standardized `@tanstack/react-form` + `AresField` / `AresSelect` architecture.

## Decisions
### Input Standardization
- **Search Query Migration**: Replace the native `<input id="simSearch">` in `SimPickerModal` with a TanStack Form utilizing `AresField`.
- **Validation**: Ensure that search inputs are properly wired with `zod` schemas if any validation is needed, or just standard form state mapping for filtering.
- **Styling**: Maintain the exact visual styling (ARES design system) and focus rings via the new component architecture.

### Scope Control
- **No Feature Expansion**: The scope is strictly limited to refactoring the form state and input rendering. The search logic itself remains identical.

## Code Context
- `src/components/SimPickerModal.tsx` contains a legacy `input` and a local `useState` for search queries.

## Canonical Refs
- This continues the form standardization begun in Phase 72 (`72-CONTEXT.md`).
