# Requirements

## Milestone: v5.3 GitHub Indexing Rate Limits

### Phase 72: Environment Variable Configurations
- [ ] Add `GITHUB_PAT` optional string binding to Cloudflare API context.
- [ ] Instruct developer to add `GITHUB_PAT="<token>"` to `.dev.vars`.
- [ ] Instruct developer to execute `npx wrangler secret put GITHUB_PAT` for production.

### Phase 73: Vectorize RAG Integration Verification
- [ ] Provide terminal verification script or instructions to execute the manual external indexing endpoint (`POST /api/ai/reindex-external`).
- [ ] Verify that `pmndrs/react-three-fiber` and `ARES-23247/ARESLIB` index successfully without `403 Forbidden` limits.
