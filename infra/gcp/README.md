# Production deployment contract

`production-deployment.json` is the reviewed source of truth for the production
Cloud Build identity, Cloud Functions inventory, runtime service accounts,
resource bounds, secret bindings, Cloud Run invoker policy, and post-deployment health checks. The
production workflow rejects any missing or unexpected Function instead of
deleting unknown infrastructure.

`aresweb-deployment-auxiliary-role.json` is the source-controlled definition of
the narrow custom role bound to the GitHub deployment service account. Updating
the live role is an explicit operator action, not a CI side effect:

```text
gcloud iam roles update areswebDeploymentAuxiliary \
  --project aresfirst-portal \
  --file infra/gcp/aresweb-deployment-auxiliary-role.json
```

Review the proposed diff before applying it. Do not add Secret Manager payload
access, Firestore document access, service-account key creation, or broad IAM
administration to this role.

To compare the live role without changing it:

```text
gcloud iam roles describe areswebDeploymentAuxiliary \
  --project aresfirst-portal \
  --format=json
```

The deploy job authenticates with Workload Identity Federation, installs the
Google Cloud CLI, deploys the reviewed release, and then:

1. verifies the build account has exactly its contracted project, repository,
   and managed source-bucket roles before starting a build;
2. compares `firebase functions:list` with the exact contract;
3. verifies every Function runs as the dedicated account in its contract;
4. verifies `allUsers` has `roles/run.invoker` only where `public` is true;
5. verifies private scheduled services do not grant `allUsers` any role; and
6. probes the Firebase Hosting origin for success routes, raw metadata, true
   page/API 404s, sitemap behavior, and security headers; and
7. reports canonical-domain reachability without allowing Cloudflare's
   treatment of a GitHub-hosted runner IP to override that strict deployment
   gate. The multi-region Google Cloud Monitoring uptime check remains the
   authoritative continuous canonical-domain check.

Unexpected infrastructure fails the deployment job for operator review. It is
never automatically removed.
