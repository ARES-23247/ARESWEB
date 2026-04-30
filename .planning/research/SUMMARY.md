# Research Summary

## Executive Summary
This research covers the necessary additions to resolve the sponsor logo upload bug and migrate high-quality documentation patterns from `areslib` into ARESWEB.

## Stack Additions
- **Storage:** Cloudflare R2 or direct Blob integration via Hono for image uploads.
- **Parsing:** Integration of `busboy` or standard `FormData` for multipart file extraction.
- **Docs:** Porting `areslib`'s markdown parsing/highlighting stack (e.g., Shiki/MDX) to ARESWEB.

## Feature Table Stakes
- **Sponsors:** Secure, size-limited (e.g., 2MB) image uploads supporting PNG/JPG/WebP, updating the `logo_url` in the D1 `sponsors` table instantly.
- **Docs:** High-fidelity markdown rendering, responsive layouts, copy-to-clipboard code blocks, and dynamic nested sidebar navigation.

## Watch Out For
- **Upload Security:** Validate MIME types to prevent SVG-based XSS attacks. Limit payload size to avoid Cloudflare Worker 128MB memory exhaustion.
- **Performance:** Avoid client-side execution of heavy syntax highlighters (e.g., Prism) which could destroy Lighthouse scores. Ensure code blocks have `overflow-x: auto` for mobile readability.
- **Branding:** Strictly adhere to ARES 23247 brand guidelines (ARES Red `#A21622`) when porting `areslib` documentation styles.
