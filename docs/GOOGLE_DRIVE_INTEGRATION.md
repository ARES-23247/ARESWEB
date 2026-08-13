# Google Drive integration

ARESWEB uses a dedicated Google account for team storage. The website hosting
account does not need to own the Drive files.

The integration has two intentionally separate credentials:

- Google Picker obtains a short-lived `drive.file` token in an administrator's
  browser. The token stays in memory and is discarded after folder selection.
- Cloud Functions use `GOOGLE_DRIVE_REFRESH_TOKEN` from Google Secret Manager
  for read-only folder previews, selected draft imports, and change checks.

The Google Photos refresh token is never reused for Drive.

## One-time Google Cloud setup

Use the same Google Cloud project and OAuth web client already configured for
ARESWEB.

1. Enable **Google Drive API** and **Google Picker API**.
2. Add these production JavaScript origins to the OAuth web client:
   - `https://aresfirst.org`
   - `https://aresfirst-portal.web.app`
   - `https://aresfirst-portal.firebaseapp.com`
3. Add `https://developers.google.com/oauthplayground` as an authorized
   redirect URI for the operator-only refresh-token grant.
4. Create a separate browser API key for Picker. Restrict its website referrers
   to `https://aresfirst.org/*`, `https://aresfirst-portal.web.app/*`, and
   `https://aresfirst-portal.firebaseapp.com/*`; restrict its API access to
   **Google Picker API** only.
5. Add that public restricted key as the GitHub repository variable
   `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY`. It is a browser identifier, not a
   server secret. CI refuses to build a production artifact without it.

## Create the dedicated Drive refresh token

Open Google OAuth 2.0 Playground while signed into the dedicated storage
account—not the website hosting account and never a student's account.

1. Open Playground settings, enable **Use your own OAuth credentials**, and
   enter the ARESWEB OAuth client ID and client secret.
2. Request only `https://www.googleapis.com/auth/drive.readonly`.
3. Authorize using the dedicated storage account.
4. Exchange the code for tokens.
5. Copy the refresh token directly into the Firebase prompt:

   ```powershell
   pnpm exec firebase functions:secrets:set GOOGLE_DRIVE_REFRESH_TOKEN --project aresfirst-portal
   ```

Do not put the refresh token in chat, source, Firestore, a URL, browser storage,
or a GitHub secret. The restricted Drive scope may trigger Google's OAuth
verification requirements; follow the Cloud Console's consent-screen guidance
instead of broadening or bypassing the scope review.

## Connect the root folder

After the new code and secret are deployed:

1. Sign into ARESWEB as an admin or coach.
2. Open **Dashboard → Cloud Resources → Configure**.
3. Choose **Choose with Google Drive** and sign into the dedicated storage
   account. Manual folder-link entry remains available as a recovery path.
4. Select the team root folder and save it.

Saving validates that the item is an active folder and initializes a Drive
change cursor. It does not import or publish any file.

## Runtime behavior

- The browser lists at most 25 direct children per page and supports nested
  folder navigation with opaque cursor pagination.
- Every requested folder is verified server-side as the configured root or a
  descendant of it.
- Administrators select at most 10 files per import. New records are always
  `draft`; existing linked records receive source-metadata refreshes without
  overwriting their website content or publication state.
- Google Docs may contribute up to 256 KiB of plain text. Other file types stay
  canonical in Drive and are represented by metadata and a Drive link.
- `syncGoogleDriveChanges` checks the Drive change feed every six hours. It
  marks linked records `changed` or `removed` for review; it never publishes,
  archives, or deletes website records automatically.
- Firestore rules prevent browser clients from creating or changing
  server-owned Drive identity and sync fields.

## Revocation and recovery

To disconnect Drive, revoke the ARESWEB OAuth grant in the dedicated Google
account and destroy the active `GOOGLE_DRIVE_REFRESH_TOKEN` secret version.
Linked website drafts remain available for review. A removed or renamed Drive
file is shown as needing review; no automated hard deletion occurs.

If the root folder changes, choose and save the new root. This initializes a
new change cursor. Previously imported records remain linked to their original
Drive file IDs until an administrator archives or replaces them.

Official references:

- <https://developers.google.com/workspace/drive/api/guides/api-specific-auth>
- <https://developers.google.com/workspace/drive/api/guides/picker>
- <https://developers.google.com/workspace/drive/api/guides/enable-shareddrives>
- <https://developers.google.com/workspace/drive/api/guides/push>
