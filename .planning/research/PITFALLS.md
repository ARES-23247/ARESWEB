# Research: Pitfalls

## Common mistakes when adding these features

### Sponsor Logo Uploads
- **Security:** Allowing unfiltered file uploads can lead to stored XSS if SVG files with embedded scripts are uploaded. Must strictly validate MIME types and strip metadata, or only allow raster formats (PNG, JPG, WebP).
- **Blob Storage Configuration:** If using Cloudflare R2, missing CORS configurations can cause frontend upload requests to fail if doing direct client-to-R2 uploads (pre-signed URLs). If routing through Hono, memory limits on Cloudflare Workers (typically 128MB) can cause 502 errors if uploading massive raw image files. Must limit file sizes on the client.
- **Database Mutability:** Forgetting to update the `updated_at` column when modifying the `logo_url` in the D1 `sponsors` table.

### Documentation Polish
- **Bundle Size:** Importing heavy syntax highlighting libraries (like Prism.js or Shiki) dynamically into the client bundle can ruin performance and Lighthouse scores. Should be server-side rendered or lazily loaded.
- **Responsive Overflow:** Long code blocks or deeply nested URLs can break mobile layouts if `overflow-x: auto` is not properly applied.
- **Brand Consistency:** Failing to use the ARES brand guidelines when porting `areslib` documentation styles. Must enforce ARES color palette (e.g., `#A21622` ARES Red).
