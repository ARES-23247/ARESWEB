# Research: Stack

## What stack additions/changes are needed for sponsor logo uploads and docs improvement?

### Core Dependencies
- **Sponsor Logos:** We are already using Cloudflare D1 for the database. Logo updates likely require Cloudflare R2 bucket integration or a Cloudflare Worker proxy if we are storing images, OR if it's just a URL string update, no new stack is needed beyond Kysely for the `update` query.
- **Documentation:** `areslib` likely uses a static documentation generator (like VitePress, Docusaurus, or TypeDoc). If ARESWEB is already a Next.js or Vite React app, we might need `nextra` or a markdown-to-React parser (`next-mdx-remote`) if not already present.

### Integrations
- If ARESWEB `dashboard/sponsors` handles image files directly, we need `busboy` or standard `FormData` parsing via Hono, and `@aws-sdk/client-s3` for uploading to Cloudflare R2.
- For docs, if we are parsing markdown or pulling from `areslib`, we may need Octokit (if pulling from GitHub) or just raw Git submodule integration.
