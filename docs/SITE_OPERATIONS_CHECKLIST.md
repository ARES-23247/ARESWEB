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
- `GOOGLE_DRIVE_REFRESH_TOKEN`
- `GOOGLE_PHOTOS_REFRESH_TOKEN`
- `YOUTUBE_API_KEY`

Grant only the Google scopes used by the photo picker, Drive read-only library,
team photo uploads, and YouTube playlist sync. Keep the recovery email and multi-factor authentication
under team leadership control. Record account ownership in the team's private
operations handbook, not in this repository.

Confirm these GitHub repository variables before the release:

- `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY`
- `NEXT_PUBLIC_GOOGLE_PICKER_API_KEY`

Both are public browser identifiers. Keep the Google integration secrets in Secret
Manager. Never copy those secret values into GitHub variables.

Create a dedicated random `ABUSE_HMAC_SECRET` (at least 32 characters) in
Secret Manager before deploying the denial-of-wallet hardening release. It is
not an API credential; public and communications runtimes use it only to derive
non-reversible anonymous quota IDs. Do not reuse `ENCRYPTION_SECRET`. Confirm
the deployment contract binds it only to those two runtimes.

Follow `docs/GOOGLE_DRIVE_INTEGRATION.md` for the separate Drive token, Picker
key restrictions, OAuth redirect, and root-folder validation steps.

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

For Bluesky blog announcements, create a dedicated app password on the team
Bluesky account and store it in Google Secret Manager:

- `BLUESKY_APP_PASSWORD`

Use an app password, never the account's primary password. The production
deployment contract will fail closed until the Secret Manager value exists.
The public team handle, `ares23247.bsky.social`, is intentionally kept in source
instead of being misclassified as a secret.

For Facebook, Instagram, and Twitter/X blog announcements, store a Buffer API
key in Google Secret Manager:

- `BUFFER_API_KEY`

The Buffer account must have the intended team Facebook, Instagram, and
Twitter/X channels connected. The backend uses an explicit service allowlist;
it ignores Bluesky and every other Buffer channel. Bluesky remains on the
direct AT Protocol integration above so it cannot receive duplicate posts.
Buffer posts include a public HTTPS image because Instagram requires image
media. If a blog thumbnail is absent or unsafe, the team-generated social card
is used instead. A publication request uses Buffer's immediate `shareNow` mode,
not its queue. The dashboard reports Buffer API acceptance as **submitted**;
that status is not proof that the downstream platform has already rendered the
post. It also identifies missing channel connections and per-channel failures so
coaches can retry without republishing the website post. Never put the Buffer
key in GitHub, Firestore, browser storage, logs, or source code.

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

## 4. Verify App Check enforcement

App Check fails closed for protected production browser mutations. Confirm valid
tokens for inquiry, task, admin editing, photo, simulation, and checkout flows.
The three secret-authenticated server integrations (profiles/sync, Zulip webhook, Onshape webhook) remain narrowly exempt.

The production workflow automatically runs `scripts/check-production-browser.mjs`
after a successful deploy. The check uses a synthetic Join application that is
intercepted in the browser, so it must never create an inquiry record or contain
student PII. It then presents the generated token to the read/write-free
`/api/app-check/canary` endpoint. Treat a failed check as a release incident even
though deployment has already completed, and roll back Hosting if the browser
client itself is broken.

Use `ENFORCE_APP_CHECK=false` only as a time-limited incident response override.
Record why it was needed, monitor affected traffic, fix the client path, and
remove the override before closing the incident.

Cloud Storage is intentionally in monitoring during the 72-hour window that
started after the controlled post-release denial probes at
`2026-08-24T06:29:00Z`. Check the redacted, project-wide Storage verification
metric with:

```text
pnpm run appcheck:storage-observe -- --project aresfirst-portal --start 2026-08-24T06:29:00Z
```

Do not interpret a short zero-traffic interval as approval to enforce. At the
end of the window, rerun with `--require-ready`, then repeat the media inventory,
production health check, public thumbnail/original checks, authenticated upload
and editor flows, and direct Storage denial probes. Any observed verification
requires classification before enforcement.

## 5. Run the release gate

Use Node 24.15 or newer in the Node 24 line, pnpm 11.21.0, and Java 21 or newer.
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
