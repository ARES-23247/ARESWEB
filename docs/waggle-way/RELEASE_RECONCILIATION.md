# September 2026 release reconciliation

The user requested integration of the Waggle Way beta and the remaining open
PRs, with a clean master checkout. All changes must pass the existing protected
release checks. Existing uncommitted work in the original checkout must be
preserved locally before updating it.

## Already shipped changes

These PRs were closed as superseded, not newly merged:

- #238: Functions already locks qs to 6.16.0 on master; its resolved package
  entry matches the proposed update.
- #257: the flower, game and Ranger Dave behavior already exists in the renamed
  `packages/pollinator` package. Source comparison matches after the product
  name change from Pollenator to Pollinator.
- #258: master already includes the BUZZLE and BUZZELLO Printables links and
  the subsequent BUZZHEX link. Current browser tests cover all three links.

Comparison baseline: master `328e7abf`, merged into the Waggle branch in
`d5b74bda`. Newer Arcade releases and package ownership were preserved.

## Dependency PRs

The production group (#263) and development group (#264) are integrated together
with the beta. Both failed the deployment lock check because their Functions
manifest updates were not reflected in `functions/package-lock.json`. The pnpm
workspace lock and Functions npm lock were regenerated from the combined
manifests. Waggle's shared icon dependency follows the updated Arcade packages.
Monaco 0.56 also requires its supported ESM entry points; the editor imports are
updated, with a narrow compatibility alias for monaco-vim's old editor import.

Fresh frozen installation, deployment lock validation, lint, TypeScript and
Functions build pass locally. Full release CI is required for the combined
artifact; historical beta results do not substitute for it.

## Release evidence

The PR and protected master workflow retain the authoritative automated test,
container, deployment and live verification results. The container smoke check
exercises the compiled Waggle worker under the declared Cloud Run CPU and memory
limits, including malformed-proof rejection and successful subsequent reuse.
Docker Desktop's Linux engine is unavailable locally, so that resource check
must run in CI. Physical-phone and screen-reader reviews remain unrecorded.

Industrial machinery, scrolling maps and the replacement thirty-level campaign
remain later work. See BETA_RELEASE.md for the actual shipping scope.
