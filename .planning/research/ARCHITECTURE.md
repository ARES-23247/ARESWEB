# Research: Architecture

## How do these integrate with existing architecture?

### Sponsor Logo Uploads
- **Current State:** ARESWEB uses a Hono + `ts-rest` backend and a React frontend. Sponsos are stored in a Cloudflare D1 database.
- **Integration Points:** 
  1. Frontend: `dashboard/sponsors` React component needs an file upload dropzone.
  2. API Contract: `ts-rest` contract needs an endpoint to accept `multipart/form-data` or a JSON payload with a base64 string/pre-signed URL.
  3. Backend: Hono route must handle the file, push to R2 (or other blob storage), and update the D1 `logo_url` column for the specific sponsor ID.

### Documentation Quality
- **Current State:** Documentation resides at `aresfirst.org/docs/` but lacks the quality present in `areslib`.
- **Integration Points:**
  1. Markdown rendering engine: Investigate how `areslib` formats docs. If it uses a specific CSS system or Markdown plugin ecosystem (like Shiki for syntax highlighting, or Vitepress layouts), those components must be ported into the React frontend.
  2. Navigation: Implement a dynamic nested sidebar navigation tree for docs if one doesn't exist, driven by a config file or file system routing.
