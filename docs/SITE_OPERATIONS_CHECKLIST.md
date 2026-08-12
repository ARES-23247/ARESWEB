# Site Operations Checklist

Use this checklist before the next production release. Do not put secret values
in this file, GitHub, Firestore, browser storage, logs, or URLs.

## 1. Use a dedicated storage account

The website host and media storage accounts may be separate Google accounts.
Use the dedicated storage account when the OAuth Playground asks you to sign in.
Do not connect a student or volunteer account.

Create or confirm these values in Google Secret Manager:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_PHOTOS_REFRESH_TOKEN`
- `YOUTUBE_API_KEY`

Grant only the Google scopes used by the photo picker, team photo uploads, and
YouTube playlist sync. Keep the recovery email and multi-factor authentication
under team leadership control. Record account ownership in the team's private
operations handbook, not in this repository.

Confirm these GitHub repository variables before the release:

- `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY`
- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`

Both are public browser keys. Keep all four Google integration values in Secret
Manager. Never copy those secret values into GitHub variables.

## 2. Rotate the Zulip bot key

A Zulip bot key previously appeared in source code. Removing it from the current
code does not make the old key safe. Revoke that key in Zulip before deployment,
create a new least-privilege bot key, and store these values in Google Secret
Manager:

- `ZULIP_BOT_EMAIL`
- `ZULIP_API_KEY`
- `ZULIP_WEBHOOK_TOKEN`

Confirm that the bot can access only the streams and actions it needs. Never
publish or hard-code a Zulip join link.

## 3. Confirm encryption and profile privacy

- Confirm `ENCRYPTION_SECRET` is a strong Secret Manager value and has not
  changed unexpectedly. Changing it without a migration will make existing
  encrypted records unreadable.
- Test one student profile and one adult profile in the emulator.
- Confirm student contact visibility remains off.
- Confirm public roster responses contain only an approved nickname, avatar,
  team role, and approved public biography fields.
- Legacy plaintext profile fields migrate when that member or an authorized
  administrator reads or saves the profile. Do not run an unreviewed bulk data
  rewrite.

## 4. Stage App Check enforcement

Keep App Check in observation mode until the checks in
`docs/SECURITY_OPERATIONS.md` pass. Review at least 72 hours of results and
resolve every missing or invalid token from a supported browser flow.

Only then set the Functions environment flag `ENFORCE_APP_CHECK=true` and deploy
Functions. Roll the flag back to `false` if valid users receive new 401, 403, or
permission errors.

## 5. Run the release gate

Use Node 22.13 or newer in the Node 22 line, pnpm 11.21.0, and Java 21 or newer.
Run every command in the repository `AGENTS.md` verification gate. Do not skip
coverage, rules, browser tests, the bundle budget, or the production dependency
audit.

Review these workflows by keyboard and on a narrow mobile screen:

- Join and sponsor forms
- Calendar browsing, RSVP, event editing, archive, and restore
- Photo picker, upload, archive, and restore
- Video sync, editing, archive, and restore
- Student profile privacy and failed-save recovery
- User access revoke and restore
- Kanban drag, task editing, and failure recovery

## 6. Release in a recoverable order

After approval, deploy rules and Functions before Hosting when the new browser
code depends on new DTO APIs. Keep the previous Hosting release and Functions
revision available for rollback. Do not delete old records as part of release;
the new workflows use archive and restore.

Watch Cloud Logging for authorization failures, upstream Google/Zulip failures,
App Check classifications, and migration errors. Logs must contain status codes
and internal request context, but not names, email addresses, tokens, provider
payloads, or student contact details.

## 7. Preserve the team mission

The portal should help ARES 23247 students learn, collaborate, and serve the
community through FIRST. Operational convenience never outweighs student
privacy, gracious professionalism, or honest public information.
