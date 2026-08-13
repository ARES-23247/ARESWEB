# Google Drive Library Integration — 2026-08-13

## Scope and state

- Baseline commit: `e6b22e9dfd441bb5150ea7290b01b9f3d261fc33`
- Branch: `master`
- Worktree: dirty; this implementation was verified together with the other pending 2026-08-13 hardening and readability changes.
- Production state: not deployed. No Google credential, Drive file, Firebase secret, or production document was changed while implementing or testing this work.

This replaces the retired folder-wide automatic publisher with a review-first Drive library. Administrators and coaches can inspect the configured folder and its descendants, page through metadata, select at most ten files, and import them as unpublished website drafts. Existing website content is never overwritten by a Drive refresh.

## Security and privacy contract

- The Google Photos refresh token is never reused. Drive uses the dedicated `GOOGLE_DRIVE_REFRESH_TOKEN` Secret Manager value.
- Drive routes run in the isolated `driveApi` function. Its secret set is limited to the encryption key, OAuth client identifiers, and Drive refresh token.
- All Drive routes require an active administrator or coach authorization record. Per-instance throttling and transactional distributed quotas run after verified authorization.
- The configured root folder is enforced server-side for browsing, selected draft imports, and legacy single-link metadata imports. Client-provided IDs, cursors, URLs, and response fields are validated and bounded.
- Browser Picker authorization uses `drive.file`. Its short-lived token stays in memory and is not sent to ARESWEB or persisted in browser storage.
- The unattended server integration uses a separate dedicated-account `drive.readonly` grant. This enables nested browsing and incremental changes while prohibiting writes to Drive.
- New records are always `status: "draft"` and `approvalStatus: "draft"`. Only Google Docs can optionally contribute bounded plain text; other files remain explicit Drive links.
- Re-importing a linked record updates only its source metadata. It does not replace edited website content, change publication state, archive a document, or delete a document.
- Incremental change checks mark linked records `current`, `changed`, or `removed` for human review. They do not publish or delete content.
- Firestore rules prevent browser clients from creating or modifying Drive identity and synchronization fields.

## Architecture

- `functions/src/lib/googleDrive.ts`: bounded Google Drive v3 client, safe DTO parsing, folder pagination, ancestry validation, text export, and change cursors.
- `functions/src/lib/googleDriveLibrary.ts`: server-only configuration, preview, draft import, and incremental change-review workflow.
- `functions/src/routes/drive.ts`: authenticated, validated, quota-protected HTTP contract.
- `functions/src/apps/drive.ts`: isolated Express application.
- `functions/src/index.ts`: `driveApi` HTTPS function and six-hour `syncGoogleDriveChanges` schedule.
- `src/lib/googleDrivePicker.ts`: memory-only Google Identity Services and Picker flow.
- `src/components/dashboard/GoogleDriveLibraryBrowser.tsx`: accessible configuration, preview, pagination, selection, import, and change-review UI.
- `docs/GOOGLE_DRIVE_INTEGRATION.md`: operator setup, restrictions, rotation, and revocation procedure.

## Verification evidence

The following completed successfully on Node 22.13.1, pnpm 11.21.0, and Java 24.0.2:

- Frozen dependency install and shared-agent validation (six skills plus Gemini, Antigravity, and Copilot discovery).
- Root and Functions ESLint with zero warnings; root TypeScript and Functions build.
- Frontend Vitest coverage: 77 files, 428 tests; 71.98% lines and 67.53% functions.
- Functions Vitest coverage: 43 files, 539 tests; 94.69% lines and 98.24% functions. Drive client/library line coverage was 93.22%/94.06%, with 100% function coverage for both.
- Firestore and Storage emulator rules: 18 tests.
- Production deployment contract: eight Functions and ten health checks.
- Hosting/Functions emulator checks: static route 200, unknown page 404, unknown API 404, and all eight function exports loaded.
- Production build: 22 public route shells prerendered; PWA precache 17 entries / 935.96 KiB.
- Bundle budgets: all passed; initial JavaScript 223,296 gzip bytes and total route JavaScript 1,308,998 gzip bytes.
- Playwright: 52 tests across Chromium, mobile Chromium, Firefox, and WebKit. A WebKit form-initialization race found during this gate was fixed and then passed ten concurrent stress repetitions.
- Root and Functions production dependency audits: no known vulnerabilities.
- Changed-file token/private-key scan and `git diff --check`: passed (only expected Windows line-ending notices).

## Deployment prerequisites

Deployment is deliberately blocked until an operator completes the steps in `docs/GOOGLE_DRIVE_INTEGRATION.md`:

1. Add the production JavaScript origins and OAuth Playground redirect URI to the OAuth web client.
2. Create a Google Picker API key restricted to the Picker API and the approved HTTPS referrers.
3. Add `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY` as a GitHub repository variable.
4. Sign into OAuth Playground with the dedicated storage account, grant only `drive.readonly`, and set the resulting refresh token as the Firebase `GOOGLE_DRIVE_REFRESH_TOKEN` secret.
5. Deploy Functions and Hosting, configure the root from `/dashboard/documents`, and smoke-test preview, one draft import, and change detection.

## Intentional limitations

- Drive is a source library, not a live collaborative editor. Imported website content is reviewed and edited in ARESWEB.
- A Drive move, deletion, or source edit creates a review state; it never silently alters a published website page.
- The first production connection requires human OAuth consent and secret entry. ARESWEB never asks an administrator to paste a refresh token into the browser UI.
- Google classifies `drive.readonly` as a restricted scope. External/public OAuth distribution may require Google verification; keeping the server credential on the dedicated account minimizes exposure but does not remove that platform requirement.
