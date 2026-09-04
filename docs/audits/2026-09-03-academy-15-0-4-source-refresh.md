# Academy ARES 15.0.4 source-refresh candidate

Date: 2026-09-03

This change is a mechanical provenance refresh from ARES `15.0.3` / Studio
`5.0.5` at `9306cfade7b5d2934d9eea612b2be249a070b507` to ARES `15.0.4` /
Studio `5.0.6` at `bf87251aa9bef26105024371ab4bf7696d9e685e`.

The guarded refresh script resolved all 142 distinct source paths, recomputed
their Git blob hashes, updated immutable GitHub source links, and changed only
version/provenance references in 25 lesson Markdown files plus the catalog,
curriculum plan, and source-authority manifest. The release candidate remains
`requiresHumanReview: true`.

## Source-delta review

Seven pinned source paths changed. The release manifest advances ARES, Studio,
the FTC and FRC starters, and the Lightbot example. The subsystem schema,
scaffolding, validation, and generated-test renderer add XRP as a supported
platform without changing the documented FTC/FRC ownership and safety
contracts. `PoseEstimator.activeTags` adds volatile visibility without changing
the documented fusion math. The architecture reference removes VFH from its
current pathing inventory; none of the affected lessons claims VFH support.
The cited lesson statements remain consistent with the reviewed source delta.

## Review boundary

The three new candidate digests fingerprint the exact 68-document guarded
refresh scopes:

- construction and programming (25):
  `7062507658c0a45cb860c6c941d1d35dcce8f53af2ec3029887f5473acfed605`
- controls, competition, and capstones (21):
  `15ad8408139b185fec1c34cf2f8fa8ace7387ad408e0062d76070ef1f661374a`
- foundations (22):
  `3f8ace3a8bde52394897a9edb4f37e1b0296f02343d8bf8b49299dffd5d17975`

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
