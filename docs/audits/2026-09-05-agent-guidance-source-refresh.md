# Shared agent guidance and Studio source refresh

The instruction cleanup was based on website commit
`9f3fd7fd5f6310c3a47876c41b0b608c8e8ddbc5` in an isolated clean worktree.
The root checkout's unrelated edits were preserved. The six workspace skills,
client entry points, package scripts, API app composition, frontend router,
content renderers, and protected deployment workflow were inspected.

The API skill now describes isolated Express apps and the separate Cloud Run
game process. The content migration skill reflects Markdown plus legacy AST
rendering. Shared skill routing is in AGENTS.md, and all client entry points
lead there. The validator checks Git tracking and effective ignores as well as
discovery wiring; 20 isolated Git fixture tests cover those behaviors. This
validates repository configuration, not another contributor's running client.

## Source refresh required by PR #253 CI

The remote provenance gate detected a newly published Studio patch release.
The owner's standing ARES refresh approval applies to this requested maintenance.

- Previous authority: `0f9e2e5dc35f35e506bd70ad89705f6ccc1a7d62`.
- Reviewed official authority: `0975b30e65f20998030eb091c8cd82142feb7fb9`.
- ARES and FTC/FRC starters remain 17.0.1; Studio changes from 7.0.1 to 7.0.2.
- All 142 referenced paths exist. 141 referenced blobs are identical; only
  `release/ares-versions.properties` changes, on its `studioVersion` line.
- Evidence came from a separately fetched bare clone of the official public
  repository. No unrelated local monorepo edits were used.

Update current version text, immutable links, catalog hashes, source authority,
curriculum provenance, and the three unapproved candidate digests together.
Referenced implementation behavior is unchanged, so no lesson behavior rewrite
is warranted. Historical screenshot identities and captured evidence remain intact.

Remote verification recomputed all 142 pinned blob hashes and checked the current
version manifest. Catalog preparation, all three candidate batches, and 55
content/migration tests passed. Human-review flags, batch membership, and production preconditions remain
unchanged. This is source maintenance; no Academy publication/migration or robot
deployment was performed. Comparison artifacts are in local
`scratch/agent-validation/source-review.json` and `source-changes.patch`.
