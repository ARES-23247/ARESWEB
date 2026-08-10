# Security Operations

This guide covers the production steps required by the repository's security
boundaries. Code changes alone do not rotate a leaked credential or reconcile a
deployed Firebase ruleset.

## Required secret migration

Before the next Functions deployment, create independent Secret Manager values:

```text
firebase functions:secrets:set GITHUB_PAT
firebase functions:secrets:set PROFILE_SYNC_SECRET
```

`GITHUB_PAT` should be a fine-grained token limited to the ARESWEB repository and
only the contents/gist permissions the simulation routes need. Rotate the prior
token, then delete the legacy `settings/GITHUB_PAT` Firestore document. Do not
reuse `ENCRYPTION_KEY` as an API credential.

Set a dedicated App Check reCAPTCHA Enterprise site key in the frontend build:

```text
NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY=your_site_key
```

Keep the public inquiry form's reCAPTCHA key separate. Confirm the App Check key,
allowed web origins, and Firebase App Check registration agree before enabling
enforcement; otherwise legitimate clients will receive 403 responses.

## Coordinated deployment

Deploy Functions and Firebase rules together so the public DTO endpoints and
their restrictive direct-read rules become active at the same time:

```text
firebase deploy --only firestore:rules,storage,functions,hosting
```

Before deployment, run the full gate in `AGENTS.md`. After deployment, verify:

1. Public finance totals load through `/api/finance` without receipt or user IDs.
2. Draft and deleted content cannot be read through client SDKs.
3. Inquiry records are limited to admin/coach roles and new metadata is encrypted.
4. Drive configuration/import/sync rejects non-admin accounts.
5. Simulation editing works with the Secret Manager token and no Firestore token.
6. App Check succeeds from production without repeated 403/throttle warnings.

## Incident and drift response

- If a secret may have been readable, rotate it; a rules fix is not revocation.
- Compare deployed Firestore/Storage rules with this repository after every rules
  incident. Treat mismatches as deployment drift and resolve them explicitly.
- Review Cloud Logging for `INTERNAL_ERROR`, App Check failures, rate-limit spikes,
  and repeated authorization denials. Logs must not contain raw PII or tokens.
- Use Firebase Emulator Suite integration tests before expanding public access.
