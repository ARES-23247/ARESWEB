# BIOBUZZ simulator

The website route is `/biobuzz/simulator`. The independent `@ares/biobuzz` package owns rules, Planck contacts, projectile height, bots, autos, the worker, and the game UI. The website injects authenticated HTTP transport. The existing calculator re-exports the same scoring module.

## Sources and coordinates

Rules are pinned to the owner-supplied Competition Manual V1, SHA-256 `2ee0ea8327da47deb871e33307898c13ee5310d5af260007dc11bb4471181f5a`. The static background and field geometry come from the ARES BIOBUZZ CAD-derived preset. The PDF and full CAD are not public assets.

Coordinates use meters, origin at field center, +X up, +Y left, heading zero along +X, CCW radians. Red occupies +Y and blue occupies -Y in this CAD orientation. Loading zones are the U-shaped tape regions; gardens are the narrow corner strips. ARES exports use explicit alliance coordinates and disable automatic mirroring.

Pollen: 0.07112 m, 0.055 lb. Nectar: 0.09144 m, 0.091 lb. Nominal hive detent load: 0.440 lb; a 0.9-second transition spills the old cell and scores only after the tipping motion completes. This calibrates the supplied eight-pollen/five-nectar observations, not measured pivot torque. Flower stacks include the base ring and score only elements overlapping the middle-to-top-ring volume.

## Practice interpretation

The match clock runs 30 seconds AUTO, eight seconds disabled transition, 120 seconds TELEOP, then settles for up to ten seconds. An unresolved settling or server scheduling fault marks the match incomplete. Local tab suspension pauses local time.

Automatic rules include scoring, release credits, early flower nectar penalties, and modeled contact interference/pinning. The fixed robot cannot intake a fifth ball, opponent nectar, airborne hive spills, or nectar through a flower bottom. Field-staff recovery returns pollen near its exit after two seconds when clear; nectar returns to its reserve.

AUTO opponent-side robot contact is the reproducible G402 interference predicate. A pin requires opponent contact, drive toward that opponent, and blocked opponent translation. The first major follows more than three seconds of pinning, then another for each further three seconds. Two-foot separation or movement from either robot’s own initial pin position held for more than three seconds clears the timer; reverse pinning ends the original count (G421.C). Intent-based judgments, strategic ejection, cards, and disqualification are excluded.

Solo defaults to one robot with four preloads; absent robots' preloads remain out of play. Full matches retain all 56 identities. Bots share the same drive/intake/shooter interface and use bounded A* and deterministic strategies.

## Autos

The visual editor supports drive, wait, intake, and shot steps. ZIP export contains schema-2 `.aresroutine` and schema-1 autonomous catalog documents. Mechanism macros lower to the existing RobotBuilder intake/flywheel/transfer voltage actions. Each translating waypoint exports native rotate/straight-drive/rotate steps. Studio uses heading as the path tangent, so this prevents an unwanted curved segment while preserving the requested final heading. Driving uses the selected native motion preset; the extra turns and native controller determine actual timing. Default autos start diagonally against the wall so the same pose satisfies Studio’s conservative circular sweep clearance. Native preflight may reject tighter custom paths that the rectangular browser robot can physically traverse; edit those paths before running them. Export preserves the authored coordinates.

Studio's auto editor imports the ZIP as a new draft with a fresh identity, validates the active project's capabilities, and preserves existing documents. Review and use the normal Save & Generate workflow. Importing does not arm or run hardware.

## Online service and release

The dedicated service contract is `infra/gcp/biobuzz-service.json`. Production is disabled until the service, exact-origin CSP, runtime identity/secrets, billing guardrail, and load test are verified. Local modes do not need this service. Set `VITE_BIOBUZZ_ORIGIN` to the verified HTTPS service origin to enable online controls.

The process owns rooms in memory. Clients authenticate their WebSocket with an in-memory random capability obtained through App-Checked HTTP admission. Tokens never appear in URLs or persistent browser storage. Inputs are leased, sequenced, bounded, and rate limited. Disconnect substitutes a bot after three seconds; the seat can be reclaimed for 30 seconds. Reloading the page loses the in-memory capability.

Only final results are written to Firestore. Live state is never written each tick. Process loss interrupts matches. Drain before deploying: close admission, allow active matches to finish, then replace the revision. A max-one-instance setting is not a distributed room-routing guarantee; unknown room ownership fails closed.

Budget target: under $100/month for the whole website, with owner-reported existing spend of $0. The $100 project budget and its 50%, 75%, 90%, 100%, and forecast-100% alerts were verified read-only through the Billing API on 2026-09-13. The recorded $35 Cloud Run category guardrail is shared with the existing game service and requires billing-console verification; Preview spend caps do not appear in the legacy Budget API. The available browser identity was denied access to the billing budget page on 2026-09-13. Alerts cannot guarantee an exact ceiling due to reporting delay. Start at five rooms; raise only after a target-runtime benchmark with 30% CPU headroom.

## Verification

Run the complete ARESWEB handoff gates. Focused commands:

```text
pnpm test packages/biobuzz/src/core/engine.test.ts src/lib/biobuzzScoring.test.ts
pnpm --filter functions test src/lib/biobuzzRooms.test.ts
pnpm --filter functions build
node scripts/benchmark-biobuzz.mjs
```

The benchmark runs 1, 5, 10, and 25 simultaneous four-bot matches and records CPU, frame latency, memory, and compressed traffic under `build/biobuzz/`. Local CPU measurements are not Cloud Run capacity evidence. Browser tests must use actual controls and verify intake, scoring, clock synchronization, final results, and export; native verification must import, generate, and run the exported routine.

## Deployment identity setup (operator approval required)

The deployment account remains `aresweb-github-deployer@aresfirst-portal.iam.gserviceaccount.com`. Its verified immutable Google principal subject is `100713596623775501367`. The service verifies a Google-signed ID token with its own audience and that subject before accepting `POST /internal/admission`. This narrow endpoint updates the durable admission switch through the runtime account. The deployer does not receive Firestore document access.

Before enabling the service, an authorized operator provisions the dedicated runtime identity, its two declared project roles, access to the one declared secret, and permission for the existing deployer to act as that runtime account. These are separate from the existing game service’s grants:

```sh
gcloud iam service-accounts create aresweb-biobuzz-runtime --project aresfirst-portal --display-name 'ARESWEB BIOBUZZ runtime'
gcloud projects add-iam-policy-binding aresfirst-portal --member serviceAccount:aresweb-biobuzz-runtime@aresfirst-portal.iam.gserviceaccount.com --role roles/datastore.user
gcloud projects add-iam-policy-binding aresfirst-portal --member serviceAccount:aresweb-biobuzz-runtime@aresfirst-portal.iam.gserviceaccount.com --role roles/firebaseappcheck.tokenVerifier
gcloud secrets add-iam-policy-binding ABUSE_HMAC_SECRET --project aresfirst-portal --member serviceAccount:aresweb-biobuzz-runtime@aresfirst-portal.iam.gserviceaccount.com --role roles/secretmanager.secretAccessor
gcloud iam service-accounts add-iam-policy-binding aresweb-biobuzz-runtime@aresfirst-portal.iam.gserviceaccount.com --project aresfirst-portal --member serviceAccount:aresweb-github-deployer@aresfirst-portal.iam.gserviceaccount.com --role roles/iam.serviceAccountUser
```

Use the existing Artifact Registry repository and WIF deployer. No service-account key is created. After verifying the shared spend cap and target capacity, enable the reviewed service contract and merge through the protected release workflow. The release drains existing rooms, builds an immutable image, verifies resource/secret/traffic/invoker state, and resumes admission only after health verification. Failed deployment leaves admission closed.

## Local four-browser integration test

Use the existing test-only E2E authentication mode and an isolated Firestore emulator on 8095, with project `aresweb-ci`. Seed `internal_biobuzz_control/service` with `admissionOpen: true` through the emulator administrator interface. Build Functions, then run `functions/lib/biobuzzServer.js` with `NODE_ENV=test`, `PORT=8087`, `GCLOUD_PROJECT=aresweb-ci`, `FIRESTORE_EMULATOR_HOST=127.0.0.1:8095`, a test-only `ABUSE_HMAC_SECRET`, `ENFORCE_APP_CHECK=false`, and `BIOBUZZ_PUBLIC_ORIGIN=http://127.0.0.1:3032`. Production requires App Check; this local workflow separately verifies enforcement in the HTTP service tests.

Build Vite with mode `e2e`, output `scratch/biobuzz/online-dist`, and `VITE_BIOBUZZ_ORIGIN=http://127.0.0.1:3032`. Preview that directory on 3032 with `BIOBUZZ_DEV_PROXY_TARGET=http://127.0.0.1:8088`. Run `pnpm exec playwright test --config playwright.biobuzz-online.config.ts`. The test owns a transparent TCP proxy on 8088, cuts one actual connection, observes bot takeover, restores that connection, finishes a full match, and verifies saved scores through the emulator administrator interface. It never sends emulator administrator credentials to production.

## Recorded validation — 2026-09-13

- Full website suite: 1,849 tests passed, 91.07% line coverage; final coverage is recorded in `scratch/biobuzz/frontend-coverage-final.log`.
- Full Functions suite: 1,027 tests passed, 95.71% line coverage; new BIOBUZZ utilities and routes meet their 85% lines / 100% functions gates. Release tooling also passes its gate.
- Firestore/Storage rules: 35 tests passed, including denial of direct client access to admission controls and stored results.
- Full browser suite: 575 passed initially; the three existing Waggle WebKit failures passed an explicit retry. All five browser profiles passed the final BIOBUZZ drive/export/hive-tip/flower-intake test after the export fix.
- Four independent browser clients completed one full authoritative match at Red 29 / Blue 10. The test cut a real TCP connection, observed bot takeover and seat recovery, compared all final scores, and verified the saved result in the Firestore emulator.
- Studio imported the actual downloaded ZIP through its auto editor, preserved existing routines, generated code, and ran the selected 32-step routine to `Complete`. Native codecs and editor tests passed. The desktop controller showed positional/heading drift and missed the browser's scoring positions. Native physical parity remains unverified; editable format and action execution compatibility are established. The final season frame was disabled. Retained motor telemetry is not a fresh measurement of shutdown outputs.
- Production build, per-entry/aggregate bundle budgets, frozen dependency install, dependency audit, lint, and type checks passed. Generated artifacts and detailed logs remain under the owned worktrees' build/scratch directories.

The deployment is intentionally gated: the shared $35 guardrail cannot be inspected with the available billing identity; the declared Cloud Run CPU still needs a capacity benchmark. Local Docker daemon commands did not respond, so no container-runtime result is claimed. Provisioning and production rollout require separate operator approval. No production service, permissions, or data were changed.

## Cost estimate

As checked on 2026-09-13, us-central1 instance billing is $0.000018/vCPU-second plus $0.000002/GiB-second. The declared 1 CPU / 1 GiB therefore costs $0.072 per allocated hour before the shared free tier. See [Cloud Run pricing](https://cloud.google.com/run/pricing).

Measured compressed snapshots total about 15.1 MiB per four-client match. At 1,000 matches/month that is about 14.7 GiB, or $1.77 before allowances using North America's $0.12/GiB rate. At 100 allocated instance-hours, compute plus that traffic is about $8.97 before free allowances, lobby/idle overhead, HTTP/TLS framing, database operations, logging, and storage. At 400 allocated hours and 4,000 matches it is about $35.9 on the same basis. This is a usage scenario, not a spending guarantee; shared matches overlap compute time and usage limits bound admission requests rather than billable hours. See [network pricing](https://cloud.google.com/vpc/network-pricing).

### Shared local capacity

The final [benchmark record](biobuzz-benchmark-2026-09-13.json) runs complete 160-second four-bot matches, including four independent compressed snapshot streams at 10 Hz. CPU is normalized against one core over simulated match time; it is not a Cloud Run utilization reading.

| Matches | One-core CPU demand | p99 batch | Worst batch | RSS |
| --- | ---: | ---: | ---: | ---: |
| 1 | 1.34% | 1.01 ms | 10.35 ms | 119 MiB |
| 5 | 5.26% | 4.19 ms | 10.98 ms | 163 MiB |
| 10 | 11.17% | 8.28 ms | 13.21 ms | 254 MiB |
| 25 | 29.88% | 18.98 ms | 39.25 ms | 278 MiB |

Ten is the largest local sample with every measured batch below the 16.67 ms simulation period and more than 30% CPU headroom. Twenty-five misses that deadline despite acceptable average CPU. Production remains provisionally bounded to five rooms until the target instance passes. This benchmark includes compression CPU but does not measure real socket/TLS overhead or deployment scheduling jitter.
