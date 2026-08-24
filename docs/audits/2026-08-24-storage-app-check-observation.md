# Storage App Check observation

## Scope and boundary

- Production release: `ad2a40f055809a8cecea0e15106b3bb3bb6e36bc`
- Deployment completed: `2026-08-24T06:25:12Z`
- Observation begins: `2026-08-24T06:29:00Z`
- Earliest 72-hour review: `2026-08-27T06:29:00Z`
- Firebase project: `aresfirst-portal`
- Service: `firebasestorage.googleapis.com`

This is an operational observation, not a claim that Storage App Check is ready
for enforcement. No enforcement mode, production record, Storage object, secret,
or IAM binding was changed while establishing the baseline.

## Deployment evidence

GitHub Actions run `32696652673` passed the rules emulator, frontend and Functions
coverage, Playwright, required-test, least-privilege deployment, deployed-surface,
and production browser App Check gates. Independent production health passed all
15 checks, including same-origin public media. Token-free direct requests to
retained `blog/**` and `gallery/**` objects returned HTTP 403 after deployment.

The production backfill updated 27 documents and left zero known direct Storage
URL references. The source objects and four ignored local rollback manifests
were retained for recovery.

## Initial metric baseline

The GA Cloud Monitoring metric
`firebaseappcheck.googleapis.com/resources/verification_count` was queried with
the monitored service restricted to `firebasestorage.googleapis.com`.

- The four-hour interval ending `2026-08-24T06:51:44Z` contained three
  `MISSING_UNKNOWN_ORIGIN` / `ALLOW` verifications. That interval included time
  before the hardened release and cannot be used as post-migration evidence.
- The release-to-observation interval contained three
  `MISSING_UNKNOWN_ORIGIN` / `ALLOW` verifications in the point ending
  `2026-08-24T06:28:24Z`. These are the three controlled direct-denial probes
  run immediately after deployment: two retained gallery objects and one
  retained blog object, all of which returned HTTP 403.
- The delayed post-probe sample from `2026-08-24T06:29:11Z` through
  `2026-08-24T06:49:11Z` contained zero verifications. The clean observation
  boundary is therefore fixed at `2026-08-24T06:29:00Z`.

The short clean sample establishes only the starting baseline. It does not meet
the 72-hour requirement.

## Acceptance procedure

1. Exercise public blog, gallery, event, and editor media on desktop, narrow
   mobile, and an incognito session.
2. Exercise authenticated upload, preview, edit, publish, archive, and restore
   paths without adding student PII to test content.
3. Run the observation command through at least `2026-08-27T06:29:00Z` with
   `--require-ready`.
4. Investigate every observed direct Storage verification. Zero requests is the
   expected architecture; a valid token is still evidence of an unexpected
   direct client path.
5. Rerun the live media inventory and require zero direct Storage URL references
   with no truncated scans.
6. Rerun production health and direct-denial probes for retained blog and gallery
   objects.
7. Only then request explicit approval to enable Storage App Check enforcement.
   After enabling it, allow up to 15 minutes for propagation and immediately
   repeat the production media, upload, and browser security checks.
