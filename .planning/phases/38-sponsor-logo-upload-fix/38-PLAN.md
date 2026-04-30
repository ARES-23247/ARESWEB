# Phase 38: Sponsor Logo Upload Fix - Plan

**Status:** Ready for Execution

## Objective
Implement secure sponsor logo uploads directly to Cloudflare R2 (`ARES_STORAGE`) from the admin dashboard, and persist the logo URL to D1. Allow SVG uploads.

## Scope
1. **Backend Integration**:
   - Update `functions/api/routes/media/handlers.ts` -> `isValidImage` to allow SVG files.
   - Leverage the existing `POST /api/media/upload` endpoint for uploading sponsor logos to R2.
2. **Frontend UI Integration**:
   - Update `SponsorEditor.tsx` to include a drag-and-drop zone + file picker instead of just a basic text input.
   - Show a loading spinner overlay while uploading.
   - Hook up the file selection to call the `POST /api/media/upload` endpoint with `folder="Sponsors"`. After upload, set the returned `url` to the React Hook Form `logo_url` field.

## Implementation Steps

### Step 1: Update API Validator
- Modify `functions/api/routes/media/handlers.ts`:
  - Update `isValidImage` to detect SVG files by checking for `<svg` or `<?xml` magic bytes in the buffer.

### Step 2: UI Refactoring for SponsorEditor
- In `src/components/SponsorEditor.tsx`, modify the `logo_url` input area.
- Create a file picker button next to or below the URL input.
- Use a `label` with `input type="file" accept="image/*" className="hidden"`.
- When a file is selected:
  - Set `isUploading` state to true.
  - Create `FormData`, append `file`, append `folder="Sponsors"`.
  - Fetch `POST /api/media/upload`.
  - On success, use React Hook Form's `setValue("logo_url", res.url)` to populate the field.
  - On error, show a toast.
  - Set `isUploading` state to false.
- Ensure the loading state prevents form submission while the upload is in progress.
