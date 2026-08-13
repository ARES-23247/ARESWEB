# Post-release operational verification — 2026-08-12

## Scope and snapshot

- Production commit: `847070fe75fc78113aa4b8ec1db2e01a94d07d15`
- Production project: `aresfirst-portal`
- Verification scope: distributed-quota TTL, direct portal media ingestion,
  derivative selection, metadata minimization, archive behavior, independent
  audit reconciliation, and repository-skill pruning.
- Production changes: one Firestore field TTL policy and one synthetic photo
  record. The record was archived after verification. No secrets, rules, user
  records, or existing media were changed.

## Results

### Firestore TTL

`internal_api_quotas.expiresAt` reached state `ACTIVE`. The policy only removes
expired internal fixed-window quota records; quota correctness does not depend
on deletion timing.

### Media ingestion

A synthetic 1600 by 900 JPEG was uploaded through the authenticated production
portal with AI labeling and Google Photos copy disabled. Production created:

| Asset | Format | Dimensions | Embedded EXIF/ICC/XMP/profile |
| --- | --- | ---: | --- |
| Sanitized full image | JPEG | 1600 by 900 | none |
| Medium derivative | WebP | 1280 by 720 | none |
| Thumbnail derivative | WebP | 480 by 270 | none |

The active gallery card loaded the thumbnail URL and the details dialog loaded
the medium URL. Storage listed exactly one full object and two derivative
objects for the test record. The active gallery count returned to its original
value after archival, and the archived view exposed exactly one restorable test
record. Archive intentionally preserves all three objects for restoration; the
application has no irreversible purge endpoint.

A pre-existing 16 by 16 repository favicon was rejected with HTTP 400. Local
Sharp decoding reproduced a libpng read error, confirming that the hardened
pipeline rejected malformed image data rather than creating a partial record.

### Independent-audit reconciliation

The earlier read-only report in `scratch/2026-08-12-post-hardening-independent.md`
was recorded against a materially dirty pre-merge worktree. Revalidation against
the deployed commit confirmed that its release defects are already addressed:

- public event DTOs omit legacy location and location identifiers unless the
  narrow public venue opt-in contract applies;
- Google Photos import has verified-admin authorization, a distributed quota,
  a 20-second download timeout, bounded image decoding, and cleanup coverage;
- both editor copilots preserve drafts and show explicit errors instead of
  fabricated offline results;
- the API declares 1 GiB memory, a 300-second timeout, and concurrency 10, while
  image decoding is capped at 20 million pixels;
- Event JSON-LD uses `PostalAddress.streetAddress`;
- `/store` and `/leaderboard` are included in the sitemap; and
- the simulation filesystem test ignores directories without `index.tsx`, with
  the complete release gate already green on the deployed merge.

The monolithic API split and metadata/404 architecture moved from this accepted
backlog into the subsequent architecture-hardening branch. Remaining work is
manual or operational: the dated accessibility checklist, optional bounded
legacy derivative backfill, and ongoing production monitoring.

### Initial production telemetry

An aggregate-only Cloud Run log query from `2026-08-12T23:00:00Z` through the
verification window returned 100 entries: 52 HTTP 200, one HTTP 201 from the
successful smoke upload, one HTTP 400 from the malformed-image rejection, one
HTTP 401, and 13 HTTP 404 responses. There were no HTTP 429, 502, or other 5xx
responses. Only status and severity counts were inspected; request URLs,
identities, and log-message bodies were not emitted. Monitoring remains an
ongoing operational responsibility rather than a one-time release gate.

## Skills decision

No further skill pruning is warranted. The six canonical skills total 221 lines
and each protects a distinct live boundary: backend DTOs, AST migrations,
delivery, comprehensive audits, accessible UI, and zero-trust security. The
validator rejects missing, duplicated, or vendor-specific skill copies, while
Codex, Gemini CLI, and Antigravity all consume `.agents/skills/` directly.

## Evidence commands

```text
gcloud firestore fields ttls list --project=aresfirst-portal --database=(default)
gcloud storage ls --long gs://aresfirst-portal.firebasestorage.app/gallery/...
aggregate-only Cloud Run status/severity query from 2026-08-12T23:00:00Z
Sharp metadata inspection of the three downloaded test objects
Authenticated portal upload, card/detail inspection, archive, and restore-list check
git status --short
rg/source inspection of the reconciled independent-audit findings
```

## Repository verification

The repository gate was repeated with Node 22.22.2, pnpm 11.21.0, and Java
21.0.8 after the documentation and test-config maintenance change:

- frozen install and supply-chain lockfile policy: passed;
- shared-agent validation: six skills plus Gemini, Antigravity, and Copilot
  discovery passed;
- root and Functions ESLint: passed with zero warnings;
- TypeScript: passed;
- frontend coverage: 71 files, 388 tests, 71.98% lines and 67.53% functions;
- Functions build and coverage: 37 files, 495 tests, 93.78% lines and 98.63%
  functions;
- Firestore and Storage rules: 17 tests passed;
- production build, PWA generation, and all bundle budgets: passed;
- Playwright: 52 tests passed across Chromium, mobile Chromium, Firefox, and
  WebKit; and
- production dependency audit at high severity: no known vulnerabilities.

`functions/vitest.config.ts` was renamed to `functions/vitest.config.mts` so its
ES-module syntax is explicit without changing the CommonJS Cloud Functions
runtime. This removes Vite's impending native-config-loader warning. Remaining
`punycode` and color-environment notices originate in development tools and were
not suppressed; the production audit is clean and no application runtime source
imports `punycode`.

No WCAG-conformance, complete-security, or zero-defect claim is made. Manual
assistive-technology validation and the documented architectural backlog remain
open.
