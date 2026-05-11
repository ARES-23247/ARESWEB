# Phase 72: Component State and Forms - Research

## Context and Goal
The goal of this phase is to migrate React form implementations to `@tanstack/react-form` using `@tanstack/zod-form-adapter`. The user has specifically chosen to target a high-value area first (the `QuickAddEventModal`) and construct reusable wrapper components (`AresFormInput`, `AresFormSelect`) to prevent boilerplate duplication.

## Current Architecture Analysis
### 1. The Target: `QuickAddEventModal.tsx`
Currently, `src/components/calendar/QuickAddEventModal.tsx` uses standard React `useState` and manual event preventing/submission handling.
- It initializes a `DEFAULT_FORM_DATA` object.
- Updates occur via a custom `updateField` helper mapping over standard HTML `<input>` tags.
- Submission relies on calling `saveEvent.mutateAsync` (from `src/api/events.ts`).
- Validation is partially done by checking `!formData.title.trim()`, but real validation relies entirely on the API bouncing the request back and setting standard text in `setError`.

### 2. Available Schemas
- The backend fully validates incoming data via `eventSchema` located in `shared/schemas/eventSchema.ts`.
- `eventSchema` uses Zod to validate properties such as `title`, `dateStart`, `category`, and checks constraints.
- With `@tanstack/zod-form-adapter`, we can pass this exact `eventSchema` into the TanStack Form's `validatorAdapter` prop to unify validation across the frontend and backend.

### 3. Reusable UI Wrappers
The user wants reusable components. Currently, inputs look like this:
```tsx
<label htmlFor="quick-event-title-input" className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
  Event Title <span className="text-ares-red">*</span>
</label>
<input
  id="quick-event-title-input"
  type="text"
  value={formData.title}
  onChange={(e) => updateField("title", e.target.value)}
  className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/40 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all"
/>
```

We need to extract this styling and structural logic into a reusable `Field` component inside `src/components/ui/forms/`. 

We should create:
1. `AresForm.tsx`: A context provider or wrapper to set up standard form styles.
2. `AresField.tsx`: A component that wraps TanStack Form's `<form.Field>`, handling labels, input generation, and inline error rendering utilizing Zod error messages.
3. `AresSelect.tsx`: Similar to above, but for dropdowns/selects (e.g. Category selection).

## Validation Architecture
- **Adapter**: Use `@tanstack/zod-form-adapter`.
- **Form Level**: Validate the entire form using the `eventSchema` from `shared/schemas/eventSchema.ts`.
- **Field Level**: Errors will be passed down to individual `AresField` components automatically by the adapter.
- **Submission**: On submit, if validation passes, the `onSubmit` handler will trigger `saveEvent.mutateAsync`.

## Execution Plan Recommendations
1. **Setup Shared UI**: Create `src/components/ui/forms/` and implement `AresField` and `AresSelect` wrapping `@tanstack/react-form`.
2. **Setup Zod Adapter**: Integrate `@tanstack/zod-form-adapter` in the frontend so Zod errors are surfaced in the UI.
3. **Refactor QuickAddEventModal**: Replace `useState` with `useForm({ validatorAdapter: zodValidator, validators: { onSubmit: eventSchema } })`. Replace `<input>` elements with the new `<AresField>` components.
4. **Test & Verify**: Ensure form validation runs locally before submission to the API, and test the successful submission of a new event.
