# Academy ARES 15.0.1 source-refresh candidate

Date: 2026-09-02

This change is a mechanical provenance refresh from ARES `15.0.0` / Studio
`5.0.1` at `152217d592a1e20e14c033382eca9726e255208f` to ARES `15.0.1` /
Studio `5.0.2` at `7ea1523105e7d8537daf77c975f6a9ffc7cc32c5`.

The guarded refresh script resolved all 142 distinct source paths, recomputed
their Git blob hashes, updated immutable GitHub source links, and changed only
version/provenance references in 25 lesson Markdown files plus the catalog,
curriculum plan, and source-authority manifest. The release candidate remains
`requiresHumanReview: true`.

## Review boundary

The three new candidate digests fingerprint the exact 68-document guarded
refresh scopes:

- construction and programming (25):
  `b0f2c99b5e5e6b4df213003d724a3b0048a81c7daf1faf7b13f967d8c4dd3f5c`
- controls, competition, and capstones (21):
  `491abd1a17e7fc66b135f4ee0e87b71849d7c396755640cef2fb6d98cf09621e`
- foundations (22):
  `0db174b058dc102eb4373b89a8efd82c353c3cb5ccdf0de39329ba258a421f97`

These values are review fingerprints, not approvals. A Lead Coach must inspect
the rendered current candidate before creating dated approval manifests. This
change does not publish Academy content, write Firestore data, or authorize a
production migration.

## Reproducible checks

```powershell
pnpm run content:validate
pnpm run content:readability
pnpm run content:verify
pnpm run content:release-validate
pnpm run test -- scripts/refresh-learning-source-authority.test.mjs scripts/validate-learning-release-candidate.test.mjs
```

Acceptance requires all 244 source references to use the single current source
authority, all 142 distinct blobs to match the pinned ARES commit, all three
release digests to recompute exactly, and the candidate to remain explicitly
unapproved.
