# Waggle Way beta release candidate

Prepared 2026-09-07 after the user accepted preparation of a beta PR and release
checks. Production deployment remains the final approval step. Nothing in this
record claims that the full redesign goal is complete.

## Included behavior

- `/waggle-way` opens the pixel-art title screen and five version-7 practice
  gardens, with a shared fullscreen game window and direct guide controls.
- Guides require dry ground; flying bees cross ordinary water. Relative dancers
  follow the last bee guided when released. Pointing guides retain their arrows.
- `/waggle-way/builder` supports local authoring, supply editing, test flights,
  saving, reopening, file import/export and explicit recoverable rule upgrades.
- The original thirty-garden campaign remains available separately. It is not
  the planned industrial/urban replacement campaign.
- Existing community work is included: authorized team submissions, admin/coach
  review, approved remixes, reporting and bounded maintenance. Public server
  verification remains capped at rules 1–5. New dancer gardens remain local/file
  sharing only; this release does not enable server publication of version 7.

## Verification and release boundary

Local evidence before integration: 1,564 frontend tests, 1,008 Functions tests,
34 database/storage rule tests, ten Functions emulator tests and all 378 browser
cases pass. Build, lint, type, bundle, dependency and deployment-contract evidence
is recorded in IMPLEMENTATION_PROGRESS.md. Integration with current `master`
requires fresh CI; earlier test results are not evidence for the merged artifact.

Docker Desktop's Linux engine is unavailable on the development host. CI must
build and check the deployed container and its Waggle verification worker. A
physical-phone touch/fullscreen check and screen-reader review remain unrecorded;
browser device emulation does not establish either.

Use the repository's normal reviewed PR and protected CI workflow. After checks
and final deployment approval, merge through the normal protected path, follow
the deployment run to completion, then verify the live game, builder, route
headers and community error/authorization behavior. Do not bypass the workflow
with a direct Functions or Hosting deployment.

Industrial machinery, lift dancers, scrolling maps and the redesigned thirty-level
honey-recovery campaign remain in REDESIGN_GOALS.md for later development.
