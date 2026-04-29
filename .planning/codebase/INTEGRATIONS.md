# INTEGRATIONS.md

**Date:** 2026-04-28

## Cloud Providers & Infrastructure
- **Cloudflare Pages:** Application hosting and static asset delivery.
- **Cloudflare Workers (Functions):** Serverless backend endpoints routing Hono APIs.
- **Cloudflare D1:** Primary relational SQLite database (`ares-db`).
- **Cloudflare R2:** Blob storage for media and file uploads (`ares-media`).
- **Cloudflare AI:** Bound via `@cloudflare/ai`, though noted as disabled in CI/CD environments.

## Third-Party APIs
- **Liveblocks (`@liveblocks/node`):** Real-time collaborative text editing and presence tracking.
- **Resend:** Transactional email service API.
- **GitHub GraphQL (`@octokit/graphql`):** Likely used for fetching project metrics or webhook processing.
- **AT Protocol (`@atproto/api`):** Bluesky API integration for social data or posting.

## Security & Auth
- **Better Auth:** Authentication lifecycle provider, persisting sessions to D1.
