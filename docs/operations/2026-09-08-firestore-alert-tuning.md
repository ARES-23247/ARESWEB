# Firestore usage alert tuning — 2026-09-08

The owner explicitly approved replacing the two immediate 3x-baseline Firestore
usage alerts with sustained absolute thresholds. Both changes were applied to
the existing production policies through the Cloud Monitoring API, then read
back and structurally compared with the approved payloads.

| Policy | Policy ID | Rolling 15-minute threshold |
| --- | --- | --- |
| ARESWEB Firestore read surge | `18052674210547095819` | Greater than 5,000 reads |
| ARESWEB Firestore write surge | `18213457879185793999` | Greater than 1,000 writes |

Both policies are under `projects/aresfirst-portal/alertPolicies/`. Each condition
must remain true for `600s`, evaluated every `60s`. Policies remain enabled with
their existing warning severity, notification channel, and opened/resolved
notification behavior.

Exact read query:

```promql
sum(increase({"firestore.googleapis.com/document/read_count", monitored_resource="firestore_instance", project_id="aresfirst-portal"}[15m])) > 5000
```

Exact write query:

```promql
sum(increase({"firestore.googleapis.com/document/write_count", monitored_resource="firestore_instance", project_id="aresfirst-portal"}[15m])) > 1000
```

## Evidence and scope

- Before tuning, both live conditions had `duration: 0s`, a five-minute evaluation
  interval, and a 3x comparison with seven prior same-time windows, with no
  absolute volume floor.
- Seven days of aggregate 15-minute Monitoring buckets had maxima of 520 reads
  and 116 writes. Missing buckets were not treated as zero observations.
- The exact proposed PromQL queries were evaluated read-only over seven days at
  five-minute steps. The corresponding volume expressions returned data (maximum
  approximately 547 reads and 113 writes); neither threshold returned a breach.
  Rolling PromQL estimates and aligned Monitoring buckets are different
  measurements. This replay validates syntax and historical noise suppression,
  not future detection or notification delivery.
- PATCH requests changed only `conditions` and `documentation`. A subsequent
  full policy read verified those fields against the approved drafts and all
  other fields against their pre-change values, excluding the expected mutation
  record. All nine unrelated Monitoring policies were unchanged.
- Billing budgets, application quotas, security controls, notification channels,
  website releases, and production application data were not modified.
- No synthetic incident or extra application traffic was generated. Future
  policy tuning requires the normal owner approval; historical baselines alone
  must not reintroduce low-volume percentage alerts.

The observability JSON is a reviewed configuration description; CI validates it
but does not apply monitoring changes. This documentation records the already
applied operational change and does not require a website deployment.
