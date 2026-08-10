# Security Operations

This guide covers the production steps required by the repository's security
boundaries. Code changes alone do not rotate a leaked credential or reconcile a
deployed Firebase ruleset.

## Required secret controls

Production Functions depend on independent Secret Manager values. Verify that
both values are active before a deployment, and use the same commands when either
credential must be rotated:

```text
firebase functions:secrets:set GITHUB_PAT
firebase functions:secrets:set PROFILE_SYNC_SECRET
```

`GITHUB_PAT` should be a fine-grained token limited to the ARESWEB repository and
only the contents/gist permissions the simulation routes need. The legacy
`settings/GITHUB_PAT` Firestore document must remain deleted. Do not reuse
`ENCRYPTION_KEY` as an API credential.

Set a dedicated App Check reCAPTCHA Enterprise site key in the frontend build:

```text
NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY=your_site_key
```

The web client must initialize this key with `ReCaptchaEnterpriseProvider`, and
the same site key must be registered on the Firebase web app's reCAPTCHA
Enterprise App Check configuration.

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

## GitHub Actions deployment controls

- Pull-request jobs must not receive Firebase or Google Cloud credentials.
- Production deploys must reference the protected GitHub `production`
  environment and run only from `master` after the required test gate.
- Probe the Firebase Hosting origin after a deploy. Monitor the canonical domain
  separately so CDN bot policy does not turn a healthy release into a false CI
  failure.
- Keep repository Actions permissions read-only by default. Grant write scopes
  only to the production deployment job.
- Disable force pushes to `master`, apply protection to administrators, and
  require the CI test gate and CodeQL before merge.
- Pin third-party actions to immutable commit SHAs.
- Authenticate production deploys with GitHub OIDC and Google Workload Identity
  Federation. The provider accepts only repository ID `1213635409`, owner ID
  `228356285`, `refs/heads/master`, and the `production` environment.
- Impersonate only
  `aresweb-github-deployer@aresfirst-portal.iam.gserviceaccount.com`. This
  service account must have no user-managed keys and no permission to read
  Secret Manager values.
- Keep `id-token: write` limited to the production deploy job. Do not create
  `FIREBASE_SERVICE_ACCOUNT_KEY`, `FIREBASE_TOKEN`, or equivalent long-lived
  repository secrets.
- Ignore `gha-creds-*.json`; the Google authentication action creates this
  short-lived ADC file during a job and removes it in post-job cleanup.

## Incident and drift response

- If a secret may have been readable, rotate it; a rules fix is not revocation.
- Compare deployed Firestore/Storage rules with this repository after every rules
  incident. Treat mismatches as deployment drift and resolve them explicitly.
- Review Cloud Logging for `INTERNAL_ERROR`, App Check failures, rate-limit spikes,
  and repeated authorization denials. Logs must not contain raw PII or tokens.
- Use Firebase Emulator Suite integration tests before expanding public access.
