# Phase 38: Sponsor Logo Upload Fix - Context

**Gathered:** 2026-04-29T22:59:19-04:00
**Status:** Ready for planning

<domain>
## Phase Boundary

Resolve the bug preventing logo updates on the sponsor dashboard by implementing secure file upload and persistence for `logo_url`.
</domain>

<decisions>
## Implementation Decisions

### Upload Storage & Transport
- Cloudflare R2 bucket — standard pattern for file assets
- `multipart/form-data` to a new Worker route — simpler for small files like logos

### Security & Validation
- Any image format (including SVG)
- Strict MIME-type & extension check — stops basic renaming
- 10MB maximum file size

### Client Experience
- Drag-and-drop zone + file picker replacing the current URL text input
- Show progress bar / loading spinner overlay while uploading
</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/SponsorEditor.tsx` contains the form and API mutation logic.
- `src/components/dashboard/DashboardFormInputs.tsx` has form components, may need a new one for file upload.

### Established Patterns
- R2 usage should align with Cloudflare Workers' `env.BUCKET` bindings.
- React Hook Form with Zod for client-side validation (`@shared/schemas/sponsorSchema.ts`).

### Integration Points
- `functions/api/routes/sponsors.ts` needs a new route for handling file uploads to R2 and returning the URL.
</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.
</deferred>
