# Academy ARES 15.0.2 source-refresh candidate

Date: 2026-09-02

This change is a mechanical provenance refresh from ARES `15.0.1` / Studio
`5.0.2` at `7ea1523105e7d8537daf77c975f6a9ffc7cc32c5` to ARES `15.0.2` /
Studio `5.0.3` at `9c9631632ea7969bece6f8e99d3acdbdb4e25cd7`.

The guarded refresh script resolved all 142 distinct source paths, recomputed
their Git blob hashes, updated immutable GitHub source links, and changed only
version/provenance references in 25 lesson Markdown files plus the catalog,
curriculum plan, and source-authority manifest. The release candidate remains
`requiresHumanReview: true`.

## Source-delta review

The source-worktree audit found three changed pinned paths. The release manifest
advances the ARES, Studio, FTC Starter, FRC Starter, and Lightbot example
versions. `AresDriveController.kt` delegates the existing deadband and curve
math to `InputMath` and names the unchanged `0.4`/`0.6` EMA constants.
`AresTelemetryHelper.kt` extracts locale-independent low-voltage formatting
while retaining its cadence, fields, invalid threshold, low-voltage threshold,
and 150-character bound. The two lessons that cite these implementation files
remain consistent with the reviewed source behavior.

## Review boundary

The three new candidate digests fingerprint the exact 68-document guarded
refresh scopes:

- construction and programming (25):
  `f082086239643598b2dc015616186deba8eee848762bdc3a1f5d5c993bf47615`
- controls, competition, and capstones (21):
  `fadcfc6da7ab0085bba1da34c0ca61b6f321eb9aaf4edf910fd0be162c091938`
- foundations (22):
  `4010ad8b26e4ad16304f8c3b74f08a6aa0dd9b518133fe575004bf6f401e4cf8`

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
