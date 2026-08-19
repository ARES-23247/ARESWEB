# Photo derivative backfill

New portal uploads and Google Photos imports create two metadata-stripped WebP
derivatives:

- a thumbnail bounded to 480 by 480 pixels;
- a medium image bounded to 1280 by 1280 pixels.

The full-resolution image remains available for lightboxes and downloads, but
new ingestion normalizes orientation and strips EXIF, XMP, ICC, and related
source metadata before Storage and AI labeling (uploads no longer sync to Google Photos; imports use the picker route).
Public and team photo DTOs expose derivative URLs and dimensions, but return
`null` for legacy records that have not been processed. Clients must fall back
to `publicUrl` when a derivative is absent.

## Safety model

`scripts/backfill-photo-derivatives.mjs` is not run by CI, deployment, Functions,
or application startup. It defaults to a bounded read-only inspection of 25
documents. A write requires all of the following:

- `--apply`;
- an explicit `--project`;
- an explicit `--bucket`;
- `--confirm-project` exactly matching `--project`;
- `--confirm-bucket` exactly matching `--bucket`.

The script processes at most 100 documents per invocation and never loops to the
next page automatically. It accepts only active JPEG, PNG, and WebP records whose
private Storage path is under `gallery/`. It verifies object size, declared
content type, and magic bytes before decoding. A failed Firestore write removes
the newly generated derivatives; it never deletes or rewrites the original.

## Operator procedure

Do not run an apply command without explicit production-change approval. Use
Google Application Default Credentials; do not download or pass a service-account
JSON key.

1. Confirm the exact Firebase project ID and Storage bucket in the Firebase
   console or deployed `FIREBASE_CONFIG`.
2. Build the Functions package so the script can reuse the reviewed production
   decoder:

   ```text
   pnpm --filter functions build
   ```

3. Inspect one bounded page. Replace `YOUR_PROJECT_ID` and `YOUR_BUCKET_NAME`
   with exact values:

   ```text
   node scripts/backfill-photo-derivatives.mjs --project YOUR_PROJECT_ID --bucket YOUR_BUCKET_NAME --limit 25
   ```

4. Review `scanned`, `eligible`, and `nextCursor`. A dry run reports zero
   updates and performs no Storage or Firestore writes.
5. Only after approval, apply the same page with exact project confirmation:

   ```text
   node scripts/backfill-photo-derivatives.mjs --project YOUR_PROJECT_ID --bucket YOUR_BUCKET_NAME --limit 25 --apply --confirm-project YOUR_PROJECT_ID --confirm-bucket YOUR_BUCKET_NAME
   ```

6. Verify generated objects and a sample gallery page. Continue with a new,
   separately reviewed invocation using the returned cursor:

   ```text
   node scripts/backfill-photo-derivatives.mjs --project YOUR_PROJECT_ID --bucket YOUR_BUCKET_NAME --limit 25 --after NEXT_CURSOR
   ```

   Run the matching apply command only after reviewing that dry-run page.

Records without a valid original `storagePath`, unsupported legacy formats, and
archived photos are intentionally skipped. Re-import or manually reconcile them
instead of broadening the script's trust boundary.

## Media lifecycle and residual cleanup

Photo deletion in the portal is an archive operation. It intentionally keeps the
original and both derivatives so an administrator can restore the record without
data loss. There is currently no replacement or irreversible purge endpoint. Any
future purge must remove `storagePath`, `thumbnailPath`, and `mediumPath` only
after verifying they are bounded gallery paths, and must update the main photo
record and album mirror together.

Storage and Firestore do not provide a cross-service transaction. The upload and
import routes clean unique Storage targets after detected write failures, but a
process termination at the exact boundary between Storage completion and the
Firestore commit can still leave unreferenced objects. Before adding a hard-purge
workflow, implement a separate dry-run reconciliation report that compares
bounded `gallery/` objects with active and archived photo records. Do not infer
orphans from filenames alone and do not delete objects automatically.
