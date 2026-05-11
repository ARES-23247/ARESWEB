# Phase 72: Component State and Forms - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate React form implementations across ARESWEB to use `@tanstack/react-form` combined with `@tanstack/zod-form-adapter`. The goal is to enforce strict type safety from the backend Zod schemas all the way through the form's state and submission payload, eliminating runtime errors and unhandled validation failures.

</domain>

<decisions>
## Implementation Decisions

### Scope of Migration
- **Targeted Scope:** Focus exclusively on a high-value, highly-used area first (such as the Quick Add Event or Task Creation modals) to establish the pattern, rather than attempting a high-risk mass migration of all forms at once.

### Form Component Architecture
- **Reusable Components:** Build a suite of reusable, design-system-aligned wrapper components (e.g., `AresFormInput`, `AresFormSelect`) that internally wire up to TanStack Form's `<Field>`. This prevents boilerplate duplication of label, error rendering, and accessible ARIA attributes across every form.

### Claude's Discretion
- Exact directory placement of the reusable form components (e.g. `src/components/ui/forms/`).
- Which specific high-value form to target first, assuming the user does not specify one.
- How to surface root-level form submission errors.

</decisions>

<canonical_refs>
## Canonical References

No external specs — requirements are fully captured in decisions above.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `package.json`: `@tanstack/react-form` and `@tanstack/zod-form-adapter` are already installed and available.
- `shared/` directory: Backend Zod schemas should be reused as the validator for the frontend forms.

</code_context>

<deferred>
## Deferred Ideas

- Mass migration of all remaining forms (can be addressed as ongoing technical debt reduction after the pattern is established).

</deferred>

---

*Phase: 72-component-state-and-forms*
*Context gathered: 2026-05-11*
