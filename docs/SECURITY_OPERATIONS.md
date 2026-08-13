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

Store both browser security keys as GitHub repository variables:

- `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY`
- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`

These keys are public site identifiers. They are not secret credentials. The CI
build stops when either variable is empty. Never use this rule for server keys,
OAuth client secrets, refresh tokens, or bot tokens.

The web client must initialize this key with `ReCaptchaEnterpriseProvider`, and
the same site key must be registered on the Firebase web app's reCAPTCHA
Enterprise App Check configuration.

Keep the public inquiry form's reCAPTCHA key separate. Confirm the App Check key,
allowed web origins, and Firebase App Check registration agree before enabling
enforcement; otherwise legitimate clients will receive 403 responses.

## App Check monitoring and enforcement

Firestore and Storage use `UNENFORCED` mode during the monitoring stage. This
mode records App Check metrics but does not block requests. Authentication stays
`OFF` until the team tests every sign-in flow.

The API also records App Check results for mutation requests. Each event has a
`valid`, `missing`, or `invalid` status. Logs include only the method and route
group. They never include tokens, user IDs, query strings, or document IDs.

Two server integrations do not use Firebase App Check:

- `POST /api/profiles/sync` uses `PROFILE_SYNC_SECRET`.
- `POST /api/webhooks/zulip` uses `ZULIP_WEBHOOK_TOKEN`.

The Zulip bot credential must come from `ZULIP_BOT_EMAIL` and `ZULIP_API_KEY`
in Google Secret Manager. No source fallback is permitted. Rotate any key that
has ever appeared in repository history before the next deployment, then verify
the bot can only access the streams and actions it needs.

The team media integrations use `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`GOOGLE_PHOTOS_REFRESH_TOKEN`, and `YOUTUBE_API_KEY` from Google Secret Manager.
The OAuth client may live in the Google Cloud project used by the website. The
refresh token may belong to a different, dedicated storage account. Sign in to
that storage account when you grant consent. Do not connect a student's account.

Use this Cloud Logging filter to review custom API results:

```text
resource.type="cloud_run_revision"
resource.labels.service_name=("publicapi" OR "coreapi" OR "mediaapi" OR "communicationsapi")
textPayload:"[app-check] App Check observation"
```

Verify all of these checks before each release:

1. Collect at least 72 hours of production data.
2. Test inquiry, admin edit, upload, simulation, and checkout flows.
3. Confirm at least 99% verified traffic in Firebase App Check metrics.
4. Find the cause of every `missing` or `invalid` API mutation.
5. Confirm each protected route group has a recent `valid` result.

Production enforcement is the default. Set the non-secret Functions environment
variable `ENFORCE_APP_CHECK=false` only as a temporary incident override. While
that override exists, the API records observations without rejecting requests.
Remove the override as soon as the supported browser flow is repaired.

Enable Storage first. Watch errors for 24 hours. Enable Firestore next, then
watch for another 24 hours. Return a service to `UNENFORCED` at once if valid
users receive new 401, 403, or permission errors.

## Coordinated deployment

The HTTP API is split into four processes so a compromised public endpoint does
not inherit unrelated credentials:

- `publicApi`: public and administrative data routes, with no Secret Manager values.
- `coreApi`: inquiry/profile routes, with encryption, reCAPTCHA, and profile-sync secrets.
- `mediaApi`: photo, Drive, video, and AI routes, with only their six media secrets.
- `communicationsApi`: task, Zulip, webhook, and simulation routes, with only their four integration secrets.

Hosting routes are the boundary between these functions. Keep the rewrite tests
and `FUNCTION_SECRET_BINDINGS` in sync whenever a route moves. Never add a
catch-all secret list to any function.

Deploy the contracted Functions before switching Hosting. The production
workflow derives its Firebase target list from
`infra/gcp/production-deployment.json`, then rejects any missing or unexpected
Function after the release. It never deletes unexpected infrastructure
automatically; investigate and remove it through an explicitly reviewed
operation.

Deploy Functions, indexes, and Firebase rules together. This keeps API queries
and their access rules in sync:

```text
firebase deploy --only firestore:rules,firestore:indexes,storage,functions,hosting
```

Before deployment, run the full gate in `AGENTS.md`. After deployment, verify:

1. Public finance totals load through `/api/finance` without receipt or user IDs.
2. Draft and deleted content cannot be read through client SDKs.
3. Inquiry records are limited to admin/coach roles and new metadata is encrypted.
4. Drive configuration/import/sync rejects non-admin accounts.
5. Simulation editing works with the Secret Manager token and no Firestore token.
6. App Check succeeds from production without repeated 403/throttle warnings.
7. The Robots page loads through `/api/robots` without an index error.
8. The Video Hub loads through `/api/videos/public` without an index error.

## Photo derivative operations

New image ingestion generates bounded WebP thumbnail and medium variants. The
legacy-media backfill is deliberately separate from deployment and defaults to
read-only inspection. Follow
[`MEDIA_DERIVATIVE_BACKFILL.md`](./MEDIA_DERIVATIVE_BACKFILL.md); never add its
apply command to CI, Hosting deployment, or Functions startup.

## GitHub Actions deployment controls

- Pull-request jobs must not receive Firebase or Google Cloud credentials.
- Production deploys must reference the protected GitHub `production`
  environment and run only from `master` after the required test gate.
- Probe both the canonical domain and Firebase Hosting origin after a deploy.
  The source-controlled production contract checks success routes, raw metadata,
  genuine page/API 404s, sitemap caching, and critical security headers with
  bounded retries.
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
- Grant that service account `roles/datastore.indexAdmin` so CI can deploy the
  source-controlled Firestore indexes. This role manages index definitions. It
  does not grant access to read or change Firestore documents.
- Keep the project custom role `areswebDeploymentAuxiliary` bound to that
  service account with only `firebaseauth.configs.get`,
  `firebaseauth.configs.update`, `firebasestorage.defaultBucket.get`,
  `storage.buckets.get`, `cloudfunctions.functions.getIamPolicy`,
  `cloudfunctions.functions.setIamPolicy`, `run.services.getIamPolicy`, and
  `run.services.setIamPolicy`. Firebase needs the Function and Cloud Run IAM
  permissions to apply the source-declared public invoker policy to HTTPS
  entry points; application authentication and authorization still run inside
  the split API services.
- Keep that role synchronized from
  `infra/gcp/aresweb-deployment-auxiliary-role.json`. Applying role changes is an
  explicit operator action; the deployment workflow verifies Cloud Run invoker
  policy but does not grant itself broader IAM administration.
- Pin the Google Cloud CLI version used by the deploy job and its immutable
  setup action revision. Upgrade both through normal dependency review so a
  mutable runner image cannot silently change drift-check behavior.
- Keep `id-token: write` limited to the production deploy job. Do not create
  `FIREBASE_SERVICE_ACCOUNT_KEY`, `FIREBASE_TOKEN`, or equivalent long-lived
  repository secrets.
- Ignore `gha-creds-*.json`; the Google authentication action creates this
  short-lived ADC file during a job and removes it in post-job cleanup.

## Incident and drift response

- If a secret may have been readable, rotate it; a rules fix is not revocation.
- Treat `infra/gcp/production-deployment.json` as the expected Function
  inventory. The deployment job fails on unexpected functions, secret-binding
  expansion, resource-bound changes, runtime/region changes, inactive services,
  or public/private Cloud Run invoker drift.
- Compare deployed Firestore/Storage rules with this repository after every rules
  incident. Treat mismatches as deployment drift and resolve them explicitly.
- Review Cloud Logging for `INTERNAL_ERROR`, App Check failures, rate-limit spikes,
  and repeated authorization denials. Logs must not contain raw PII or tokens.
- Use Firebase Emulator Suite integration tests before expanding public access.
