# Media delivery migration for Storage App Check

Status: gateway, write-path, and bounded migration tooling implemented; production apply pending
Inventory date: 2026-08-23
Production project: `aresfirst-portal`

## Why this migration exists

Firebase Storage App Check enforcement would reject the website's remaining
direct browser reads. Public team media therefore needs to cross an
authorization and publication-aware same-origin API boundary before Storage is
enforced. The migration must preserve archived records and revision history,
must not make draft media public, and must not copy or re-encode source files
unnecessarily.

## Read-only production inventory

Run:

```powershell
node scripts/inventory-media-references.mjs `
  --project aresfirst-portal `
  --bucket aresfirst-portal.firebasestorage.app `
  --max-docs 2000 `
  --max-objects 20000
```

The 2026-08-23 inventory was not truncated and reported:

| Area | Records scanned | Direct Storage references | Managed-path coverage |
| --- | ---: | ---: | ---: |
| Blog posts | 12 | 3 across 2 posts | 3/3 |
| Events | 83 | 0 | n/a |
| Albums | 1 | 0 | n/a |
| Managed photos | 10 | 28 legacy URL fields | 10/10 originals, 9/10 derivative sets |
| Docs | 36 | 0 | n/a |
| Documents | 0 | 0 | n/a |
| Nested photo mirrors | 3 | 9 | 9/9 |
| Revisions | 38 | 13 | 13/13 |

Storage contained one `blog/` object (66,271 bytes) and 27 `gallery/`
objects (8,479,388 bytes). There were no objects under `events/` or
`editor/uploads/`. Every consumer-side direct URL resolved to one of the ten
managed photo records. The inventory intentionally emits aggregate counts only;
it never prints document content, object names, download tokens, or user data.

## Target contract

`imported_photos` remains the authoritative media-asset registry. Its opaque
document ID and server-owned `storagePath`, `thumbnailPath`, and `mediumPath`
fields identify bytes. Browser-facing DTOs never return those paths or direct
Storage URLs.

Same-origin delivery is split by publication context:

- authenticated preview: `/api/photos/admin/media/:photoId/:variant`;
- public gallery: `/api/photos/public/media/:photoId/:variant`, authorized by
  an active public album;
- public content: `/api/photos/public/content/:collection/:contentId/:photoId/:variant`,
  authorized by an active published owner record and its explicit media IDs;
- public event attachment: `/api/calendar/events/:eventId/photos/:photoId/media/:variant`,
  authorized by the published event and published attachment record;
- event cover: resolved from an opaque `coverPhotoId` on a published event.
- occurrence-specific event cover: resolved from the occurrence override's
  opaque `coverPhotoId`, with the series cover as the default;
- album management cover: resolved from an opaque `coverPhotoId` for
  authenticated previews.

Allowed variants are `original`, `medium`, and `thumbnail`. Gateways validate
the selected path, object MIME type, publication state, archive state, and
conditional cache headers before streaming bytes. Public responses may cache
for five minutes; authenticated previews use private/no-store caching.

External HTTPS images remain supported when they are not objects in the ARES
Storage bucket. New editor and API writes reject direct ARES Storage URLs.

## Data migration

The backfill is idempotent and page-bounded. For each source URL it:

1. parses only canonical Google Storage URL forms;
2. requires the expected production bucket;
3. resolves the object path to exactly one `imported_photos` record;
4. writes an opaque ID or owner-qualified same-origin gateway URL;
5. records the migration version and timestamp;
6. removes legacy direct URL fields only after all references on the page are
   resolvable.

External HTTPS media is retained. Managed-photo legacy fields are deleted only
when their URL targets the explicitly selected bucket and the URL object path
matches the record's server-owned path metadata. Missing or conflicting path
metadata blocks the entire page instead of discarding a usable reference.

Dry-run is the default. Apply mode requires the project and bucket to be
repeated as confirmations. A rollback manifest contains only document paths,
field paths, managed photo IDs, variants, original object paths, original
opaque-ID fields, and SHA-256 integrity hashes—never download-token query
strings or document content. The manifest is ignored by Git when placed under
`media-migration-backups/`. Production apply requires explicit operator
approval immediately before the command is run.

Example dry-run page:

```powershell
pnpm media:migrate -- `
  --project aresfirst-portal `
  --bucket aresfirst-portal.firebasestorage.app `
  --scope content `
  --collection posts `
  --limit 50
```

Apply uses the same scope and adds `--apply`, matching `--confirm-project` and
`--confirm-bucket` values, plus a new `--backup-file` path. Never reuse a
backup path. Continue a bounded page with the aggregate `nextCursor` as
`--after-path` only after the previous page is verified.

## Release order

1. Deploy gateways, opaque DTOs, and dual-read compatibility.
2. Verify authenticated previews, public blogs, events, gallery, mobile image
   rendering, caching, archive behavior, and 404 behavior. The protected
   deployment health gate also requires the live public gallery DTO to contain
   only opaque same-origin media URLs and streams one non-empty image while
   checking its MIME type, public cache policy, and `nosniff` header.
3. Run the full dry-run and retain its aggregate report.
4. With explicit approval, run bounded apply pages and verify each checkpoint.
5. Deploy Storage rules that deny the migrated legacy prefixes.
6. Observe Storage App Check until legitimate direct browser requests reach
   zero for a representative usage window.
7. Only then recommend enabling Storage App Check enforcement.

## Rollback

Keep the old public Storage read rules until post-backfill verification passes.
If a migrated page fails, stop at the current checkpoint. First dry-run the
matching rollback manifest:

```powershell
pnpm media:rollback -- `
  --project aresfirst-portal `
  --bucket aresfirst-portal.firebasestorage.app `
  --manifest media-migration-backups/<page>.json
```

Rollback apply additionally requires `--apply`, `--confirm-project`, and
`--confirm-bucket`. It refuses the whole page when any field integrity hash no
longer matches, preventing a rollback from overwriting later edits. It restores
token-free canonical Storage URLs, restores previous opaque-ID lists, and
removes migration markers. Keep the old public Storage rules until post-
backfill verification passes. Do not delete source objects as part of this
migration. Object cleanup is a separate, explicitly approved retention
operation.

## Verification evidence

On 2026-08-23, the release candidate passed the repository gate with Node
24.19.0 and pnpm 11.21.0: agent configuration, both ESLint scopes, TypeScript,
734 frontend tests with coverage, 754 Cloud Functions tests with coverage, 29
Firestore/Storage emulator-rule tests, the production build and 25-route
prerender, every bundle budget, and the production dependency audit (no known
vulnerabilities). The 106-flow Playwright desktop/mobile/PWA matrix passed; a
later repeat had one external Google Fonts `ERR_NETWORK_CHANGED` failure, and
that exact Chromium media flow passed immediately when rerun in isolation.

The final read-only production inventory remained untruncated, and every direct
consumer reference was resolvable. Final dry-runs reported zero blocked records
in every scope. No production documents, Storage objects, rules, functions, or
hosting files were changed by this verification.
