---
wave: 2
depends_on: ["01"]
files_modified:
  - "src/components/calendar/QuickAddEventModal.tsx"
autonomous: true
---

# Plan 02: Refactor QuickAddEventModal

## Objective
Migrate the `QuickAddEventModal` from its legacy `useState` architecture to the newly standardized `@tanstack/react-form` implementation, leveraging `@tanstack/zod-form-adapter` and `eventSchema` for robust type-safe validation.

## Tasks

### 1. Integrate TanStack Form and Zod Adapter
<read_first>
- `src/components/calendar/QuickAddEventModal.tsx`
- `shared/schemas/eventSchema.ts`
</read_first>
<action>
Modify `QuickAddEventModal.tsx` to import `useForm` from `@tanstack/react-form` and `zodValidator` from `@tanstack/zod-form-adapter`. Replace the `useState<FormData>` declaration with a `useForm` instance where `validatorAdapter: zodValidator` and `validators: { onSubmit: eventSchema }`. Initialize the form's `defaultValues` to match the existing `DEFAULT_FORM_DATA`. 
</action>
<acceptance_criteria>
- The file imports and utilizes `useForm` and `zodValidator`.
- The existing manual `useState` form tracking is removed entirely.
</acceptance_criteria>

### 2. Replace Manual Inputs with Reusable Components
<read_first>
- `src/components/calendar/QuickAddEventModal.tsx`
- `src/components/ui/forms/AresField.tsx`
- `src/components/ui/forms/AresSelect.tsx`
</read_first>
<action>
Replace the native `<input>` and `<select>` elements inside `QuickAddEventModal.tsx` with `<form.Field>` wrappers that yield the new `<AresField>` and `<AresSelect>` components. Ensure properties like `name`, `value`, and `onChange` map correctly to the TanStack Field API.
</action>
<acceptance_criteria>
- Native standard inputs for title, dateStart, and category are replaced by the new UI wrappers.
- The `updateField` helper function is removed as it's no longer necessary.
</acceptance_criteria>

### 3. Update Form Submission Logic
<read_first>
- `src/components/calendar/QuickAddEventModal.tsx`
</read_first>
<action>
Refactor the modal's primary submission handler. Instead of an ad-hoc `handleSubmit` intercepting the click, wrap the internal form content in a native `<form>` element configured with `onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); form.handleSubmit(); }}`. Move the `saveEvent.mutateAsync` call into the `onSubmit` handler of the `useForm` configuration. Remove the manual `setError` validation checks.
</action>
<acceptance_criteria>
- Form submission triggers TanStack's `form.handleSubmit()`.
- API integration executes only after Zod validation passes.
- Code compiles successfully without TypeScript errors regarding the submit signature.
</acceptance_criteria>

## Verification
- Run `npm run dev` and test the QuickAddEventModal in the browser. Verify that blank submissions yield Zod-generated error messages directly on the inputs, and valid submissions execute the backend mutation.
