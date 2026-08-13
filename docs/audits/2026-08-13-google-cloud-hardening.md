# Google Cloud hardening record — 2026-08-13

Project: `aresfirst-portal` (`205869391101`)

This record captures the live security changes approved and applied on
2026-08-13. It records configuration state, not secret values.

## Applied

- Created eight dedicated Cloud Functions runtime service accounts and deployed
  every HTTPS and scheduled workload with its contracted identity.
- Granted only the Firestore, App Check, Firebase Auth, Vertex AI, Storage, and
  per-secret access required by each workload.
- Removed Editor, application-data roles, and all fourteen direct secret-access
  grants from the Compute Engine default service account. It retains only build
  log writing at project scope, repository-scoped Artifact Registry write,
  object viewing on the two managed Functions source/upload buckets, and narrow
  Cloud Run invoker grants for scheduled OIDC calls.
- Removed anonymous invocation from the retired
  `ares-analytics-gateway-staging` Cloud Run service.
- Enabled Firestore database deletion protection; point-in-time recovery was
  already enabled.
- Enforced project policies that prohibit creation and upload of
  service-account keys.
- Enabled Secret Manager Admin Read, Data Read, and Data Write audit logging.
- Removed five expired Firebase preview channels from Authentication authorized
  domains. Production Hosting, Firebase Hosting, and localhost remain.
- Disabled superseded versions 1–3 of Google OAuth client ID/secret and Zulip
  email/API key. Version 4 remains enabled for each. Disabled the unreferenced
  `GCP_PROJECT_ID` version. No secret version was destroyed.
- Created the explicitly approved `david.huss@gmail.com` Cloud Monitoring email
  channel and attached it to a production availability/TLS policy.
- Added a 60-second HTTPS check for `https://aresfirst.org/`. The policy opens
  after at least two regions fail for one minute or the certificate has fewer
  than 15 days remaining, and notifies on both incident open and close.
- Enabled the Cloud Billing Budget API and linked the approved email channel to
  the existing `$50 Monthly budget alert` and `BigQuery` budgets. Existing
  Billing IAM recipients remain enabled.
- Confirmed that the project-wide Editor assignment for
  `jules.huss@gmail.com` is intentional. No identity access was changed.

## Verified

- All eight deployed Functions are active and report the expected runtime
  service account.
- Cloud Run public/private invoker policy matches the production contract.
- Ten production health probes pass after removal of default-account access.
- Signed-in photo library, Drive configuration, and user roster routes load
  without permission errors.
- Post-deployment Cloud Run logs contain no runtime permission denial. Two web
  503 responses occurred only during revision rollout and did not persist.
- No user-managed service-account key exists.
- The Monitoring email channel is enabled, the only alert policy references it,
  and both active budgets reference it. The live endpoint returned HTTP 200 and
  the new uptime check produced a `check_passed` metric point.
- A protected-workflow deployment demonstrated that Cloud Functions uses the
  default Compute account as its build identity. Removing all build permissions
  caused source download to fail before rollout. The corrected minimal scopes
  are now source-controlled and checked before deployment; no broad runtime or
  secret permission was restored.

## Deliberately deferred

- Firebase App Check enforcement remains off for Auth, Firestore, and Storage
  until at least 72 hours of valid production metrics and the manual flow matrix
  in `docs/SECURITY_OPERATIONS.md` are complete.
- OAuth consent verification and cleanup of the older Firebase-created OAuth
  client require a controlled credential rotation and user-facing consent review.
- Container vulnerability scanning can add cost and needs an explicit billing
  decision. Artifact cleanup should first run in dry-run mode.
- The old analytics dataset, bucket, and private staging service were not
  deleted because that would be destructive.

## Rollback notes

- Re-enable a disabled secret version only if a deployed revision still names
  that exact version; do not restore broad default-account access.
- A workload permission regression should be repaired on its dedicated runtime
  account. Treat adding Editor or project-wide Secret Manager access as an
  incident workaround requiring immediate follow-up and removal.
