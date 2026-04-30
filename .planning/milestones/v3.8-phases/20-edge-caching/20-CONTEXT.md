# Phase 20: Edge Caching for Read Routes - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous)

<domain>
## Phase Boundary

Add cache headers or KV caching for heavy read routes (posts, events, seasons).
</domain>

<decisions>
## Implementation Decisions

### Agent Discretion
Since custom WAF rules and KV are severely limited on the free tier, we will rely on HTTP `Cache-Control` headers natively supported by Cloudflare edge nodes (CDN). This avoids burning KV write/read quotas while providing massive performance boosts for public read-only API endpoints.
</decisions>

<code_context>
## Existing Code Insights

We will modify `functions/api/routes/posts.ts`, `events/index.ts`, and `seasons.ts` to include standard `Cache-Control: public, max-age=60, s-maxage=300` headers on public GET requests.
</code_context>

<specifics>
## Specific Ideas

- Ensure `Cache-Control` is only applied to public `GET` lists.
- Avoid caching authenticated or draft views.
</specifics>
