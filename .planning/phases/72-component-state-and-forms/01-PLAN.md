---
wave: 1
depends_on: []
files_modified:
  - "src/components/ui/forms/AresForm.tsx"
  - "src/components/ui/forms/AresField.tsx"
  - "src/components/ui/forms/AresSelect.tsx"
autonomous: true
---

# Plan 01: Reusable Form Infrastructure

## Objective
Establish standard, reusable form wrapper components utilizing `@tanstack/react-form` and `@tanstack/zod-form-adapter`. These components will encapsulate the boilerplate associated with field state management, label rendering, and inline validation error surfacing, ensuring compliance with the ARES 23247 design system.

## Tasks

### 1. Create `AresField` Component
<read_first>
- `shared/schemas/eventSchema.ts` (to understand Zod validation integration)
</read_first>
<action>
Create `src/components/ui/forms/AresField.tsx`. Implement a reusable input wrapper that accepts a TanStack `<Field>` API reference. It should render a standard text input matching the ARES styling (e.g., `bg-obsidian border border-white/10 ares-cut-sm`). Surface validation errors immediately below the input if `field.state.meta.errors` is present, colored in `text-ares-red`.
</action>
<acceptance_criteria>
- `src/components/ui/forms/AresField.tsx` exists and exports the component.
- The component correctly renders `field.state.meta.errors` as text when errors are present.
- The styling matches the dark mode obsidian aesthetic with `ares-red` focus states.
</acceptance_criteria>

### 2. Create `AresSelect` Component
<read_first>
- `src/components/ui/forms/AresField.tsx` (for style consistency)
</read_first>
<action>
Create `src/components/ui/forms/AresSelect.tsx`. Implement a reusable dropdown/select wrapper utilizing the TanStack `<Field>` API. It must accept an array of options and render a standard HTML `<select>` styled identically to `AresField`, incorporating validation error display.
</action>
<acceptance_criteria>
- `src/components/ui/forms/AresSelect.tsx` exists and exports the component.
- It correctly binds the `field.handleChange` and `field.state.value` properties.
</acceptance_criteria>

## Verification
- Run `npx tsc --noEmit` and `npm run lint` to ensure type safety and compliance across the new reusable components.
