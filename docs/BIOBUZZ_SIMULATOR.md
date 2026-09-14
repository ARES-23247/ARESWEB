# BIOBUZZ simulator

The website route is `/biobuzz/simulator`. The independent `@ares/biobuzz` package owns rules, Planck contacts, projectile height, bots, autos, the worker, and the game UI. The website injects authenticated HTTP transport. The existing calculator re-exports the same scoring module.

## Sources and coordinates

Rules are pinned to the owner-supplied Competition Manual V1, SHA-256 `2ee0ea8327da47deb871e33307898c13ee5310d5af260007dc11bb4471181f5a`. The static background and field geometry come from the ARES BIOBUZZ CAD-derived preset. The PDF and full CAD are not public assets.

Coordinates use meters, origin at field center, +X up, +Y left, heading zero along +X, CCW radians. Red occupies +Y and blue occupies -Y in this CAD orientation. Loading zones are the U-shaped tape regions; gardens are the narrow corner strips. ARES exports use explicit alliance coordinates and disable automatic mirroring.

Pollen: 0.07112 m, 0.055 lb. Nectar: 0.09144 m, 0.091 lb. Nominal hive detent load: 0.440 lb; a 0.9-second transition spills the old cell and scores only after the tipping motion completes. This calibrates the supplied eight-pollen/five-nectar observations, not measured pivot torque. Flower stacks include the base ring and score only elements overlapping the middle-to-top-ring volume.

Hive collision geometry follows V1 figures 9-9 through 9-11 and the supplied STEP's `am-5888`, `am-5871`, and `am-5869` skins. Each cell is a pentagonal prism, 0.508 m wide, 0.3556 m tall with 0.193294 m shoulders, and 0.3058 m deep. Its outward opening tilts with the hive around the 1.11633 m pivot. In a stable upward position the lip and apex are approximately 1.356 m and 1.664 m above the tiles, within the manual's rounded dimensions. The shared geometry drives the renderer, bot target, and swept sphere collision checks. Inward entry through the complete opening scores regardless of whether the ball is rising or descending. The back, floor, side walls, roof slopes, and rim deflect impacts; over/under misses remain misses. Moving/downward cells cannot receive valid scoring captures. Wall envelopes use a conservative 12.7 mm frame allowance and 0.25 restitution as simulation approximations, not measured impact calibration.

Airborne sprites stay at their actual planar coordinates; height rings and elevation ordering distinguish flight and overhead cells. Older autos aimed at the former horizontal capture plane may need their headings and launch speeds retuned. Their native export schemas and coordinates are unchanged.

Human driving defaults to assisted hive shots. One press queues one shot, rotates the robot toward its alliance's open cell, and selects a clear ballistic trajectory with 2–5.8 m/s speed and 30–80 degree elevation. It releases only after alignment, low chassis speed, and a final swept collision check. A blocked shot keeps its ball and asks the player to reposition. Shoot again, driving, switching to manual power, stale input, disconnect, and period deadlines cancel the queue; an unaligned request expires after five seconds. The server computes online solutions; clients send only a validated optional `aimHive` boolean. Searches are bounded and cached across repeated requests. Manual flower shots and authored auto actions retain the RobotBuilder-compatible 60-degree launch and explicit speed.

J, gamepad A, the Intake button, and the Run intake checkbox toggle continuous intake. Releasing the key/button leaves intake enabled until toggled off; a full four-ball magazine resumes collecting after a shot creates space. Reset switches intake off. Paused/stale/disabled controls remain neutral.

Red/Blue driver view buttons rotate the complete field so the selected station is at the bottom. Keyboard, touch, and gamepad translation follow that view regardless of robot heading. Selecting a robot or joining a seat defaults to its alliance's view. The toggle changes presentation and human inputs only: simulation poses, online messages, authored waypoints, and native auto exports retain field-centered meters and CCW radians. Field clicks invert the selected view before creating a waypoint.

## Practice interpretation

The match clock runs 30 seconds AUTO, eight seconds disabled transition, 120 seconds TELEOP, then settles for up to ten seconds. An unresolved settling or server scheduling fault marks the match incomplete. Local tab suspension pauses local time.

Automatic rules include scoring, release credits, early flower nectar penalties, and modeled contact interference/pinning. The fixed robot cannot intake a fifth ball, opponent nectar, airborne hive spills, or nectar through a flower bottom. Field-staff recovery returns pollen near its exit after two seconds when clear; nectar returns to its reserve.

AUTO opponent-side robot contact is the reproducible G402 interference predicate. A pin requires opponent contact, drive toward that opponent, and blocked opponent translation. The first major follows more than three seconds of pinning, then another for each further three seconds. Two-foot separation or movement from either robot’s own initial pin position held for more than three seconds clears the timer; reverse pinning ends the original count (G421.C). Intent-based judgments, strategic ejection, cards, and disqualification are excluded.

Solo defaults to one robot with four preloads; absent robots' preloads remain out of play. Full matches retain all 56 identities. Bots share the same drive/intake/shooter interface and use bounded A* and deterministic strategies.

## Autos

The visual editor supports drive, wait, intake, and shot steps. ZIP export contains schema-2 `.aresroutine` and schema-1 autonomous catalog documents. Mechanism macros lower to the existing RobotBuilder intake/flywheel/transfer voltage actions. Each translating waypoint exports native rotate/straight-drive/rotate steps. Studio uses heading as the path tangent, so this prevents an unwanted curved segment while preserving the requested final heading. Driving uses the selected native motion preset; the extra turns and native controller determine actual timing. Default autos start diagonally against the wall so the same pose satisfies Studio’s conservative circular sweep clearance. Native preflight may reject tighter custom paths that the rectangular browser robot can physically traverse; edit those paths before running them. Export preserves the authored coordinates.

Studio's auto editor imports the ZIP as a new draft with a fresh identity, validates the active project's capabilities, and preserves existing documents. Review and use the normal Save & Generate workflow. Importing does not arm or run hardware.

## Online service and release

The dedicated service contract is `infra/gcp/biobuzz-service.json`. Production is enabled in the reviewed contract with an initial admission limit of one room, following the verified billing and target-capacity evidence below. The protected workflow must verify the deployed service before reopening admission. Local modes do not need this service. Set `VITE_BIOBUZZ_ORIGIN` to the verified HTTPS service origin to enable online controls.

The process owns rooms in memory. Clients authenticate their WebSocket with an in-memory random capability obtained through App-Checked HTTP admission. Tokens never appear in URLs or persistent browser storage. Inputs are leased, sequenced, bounded, and rate limited. Disconnect substitutes a bot after three seconds; the seat can be reclaimed for 30 seconds. Reloading the page loses the in-memory capability.

Only final results are written to Firestore. Live state is never written each tick. Process loss interrupts matches. Drain before deploying: close admission, allow active matches to finish, then replace the revision. A max-one-instance setting is not a distributed room-routing guarantee; unknown room ownership fails closed.

Budget target: under $100/month for the whole website, with owner-reported existing spend of $0. The $100 project budget and its 50%, 75%, 90%, 100%, and forecast-100% alerts were verified read-only through the Billing API on 2026-09-13. The shared $35 Cloud Run category spend cap was verified in the billing console on 2026-09-13 under the already signed-in billing owner: monthly, project aresfirst-portal, service Cloud Run, status Configured, with 50%, 80%, and 100% alerts. Preview spend caps do not appear in the legacy Budget API. The initial access failure used the team account rather than the billing owner. Alerts cannot guarantee an exact ceiling due to reporting delay. Start at one room, the largest tested target-runtime batch that passed the timing criteria; raise only after another target-runtime benchmark and live multi-client verification.

## Verification

Run the complete ARESWEB handoff gates. Focused commands:

```text
pnpm test packages/biobuzz/src/core/engine.test.ts src/lib/biobuzzScoring.test.ts
pnpm --filter functions test src/lib/biobuzzRooms.test.ts
pnpm --filter functions build
node scripts/benchmark-biobuzz.mjs
```

The benchmark runs 1, 5, 10, and 25 simultaneous four-bot matches, plus a one-room workload with four humans repeatedly requesting assisted shots at the normal input rate. It records CPU, frame latency, memory, and compressed traffic under `build/biobuzz/`. Local CPU measurements are not Cloud Run capacity evidence. Browser tests must use actual controls and verify intake, scoring, clock synchronization, final results, and export; native verification must import, generate, and run the exported routine.

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

Use the existing Artifact Registry repository and WIF deployer. No service-account key is created. After verifying the shared spend cap and target capacity, enable the reviewed service contract and merge through the protected release workflow. The release drains existing rooms, builds an immutable image, verifies resource/secret/traffic/invoker state, and leaves admission closed. A separate resume step obtains a fresh audience-bound ID token through the existing Google WIF action and verifies the exact revision again before reopening admission. The drain token is also minted by that action; the gcloud identity-token command does not accept the federated credential file as a service-account ID-token credential. Fresh resume authentication avoids relying on a ten-minute token surviving the build and rollout. No additional identity grants or long-lived keys are needed. Failed deployment leaves admission closed.

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

The owner authorized deployment and the exact online IAM setup on 2026-09-13. Both dedicated identities and their declared grants were provisioned and read back. The $35 guardrail and $100 project alerts are verified. The protected target-capacity workflow completed successfully. The local Docker daemon did not respond, so no local container result is claimed.

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

Ten is the largest local sample with every measured batch below the 16.67 ms simulation period and more than 30% CPU headroom. Twenty-five misses that deadline despite acceptable average CPU. This historical local result does not set production capacity; the target-runtime measurement below selects one room. This benchmark includes compression CPU but does not measure real socket/TLS overhead or deployment scheduling jitter.

## Protected target-capacity measurement

`Measure BIOBUZZ Cloud Run Capacity` is a manually dispatched, protected-master workflow using the existing production environment and WIF provider. It builds the same engine and compression workload as a dedicated Docker target, then runs one Cloud Run task in us-central1 with 1 CPU, 1 GiB, a 600-second deadline, and zero retries. No server, public endpoint, schedule, secrets, or application data access is added by this measurement. The job's service account is `aresweb-biobuzz-benchmark@aresfirst-portal.iam.gserviceaccount.com` and has no project roles.

The existing deployer needs a narrowly scoped `areswebBiobuzzCapacity` custom role containing `run.jobs.create`, `run.jobs.get`, `run.jobs.update`, `run.jobs.run`, `run.executions.get`, and `run.operations.get`, plus Service Account User on that benchmark identity. These operator-provisioned grants support this reviewed workflow; no long-lived key is used. Job creation is a project-level permission. Keep this role separate from existing deployment roles so it can be removed independently.

The workflow retains the exact job/execution description as an artifact. A billing-authorized operator reads the matching execution's JSON `biobuzz-capacity` log record, verifies the resource limits, and records the result before enabling online admission. Passing means at least 30% one-core CPU headroom, p99 batches within 16.67 ms, and no consecutive missed batch deadlines. An isolated scheduling pause is reported separately. This CPU/compression benchmark does not substitute for the four-client protocol tests or a live service smoke test.


### Cloud Run result and initial admission — 2026-09-13

[Protected workflow 34784074463](https://github.com/ARES-23247/ARESWEB/actions/runs/34784074463) completed execution `aresweb-biobuzz-capacity-h5slw` successfully. The [recorded evidence](biobuzz-cloud-capacity-2026-09-13.json) pins source commit `cb64163ddb5c654f9ea5198fa282a6381a46fcd3`, the resolved image digest, exact execution resources, completion time, and original structured measurement. Read-back confirmed one CPU, 1 GiB, one task, one-way parallelism, 600-second timeout, zero retries, and no environment variables or secrets. The benchmark identity has no application-data permissions.

| Matches | One-core CPU demand | p99 batch | Worst batch | Missed batches / longest run | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| 1 | 1.67% | 1.07 ms | 76.26 ms | 36 / 1 | Pass |
| 5 | 5.36% | 24.27 ms | 59.98 ms | 113 / 1 | Fail p99 |
| 10 | 9.61% | 28.52 ms | 59.26 ms | 202 / 1 | Fail p99 |
| 25 | 26.73% | 39.18 ms | 71.53 ms | 656 / 2 | Fail p99 and consecutive deadlines |

All simulated matches finished, with four tips per alliance. One room is the largest passing sampled capacity and becomes the initial production admission limit. It retains more than 30% CPU headroom. The isolated pauses remain visible in this report; no claim of zero missed deadlines is made. The compressed output remains 15.077 MiB per four-client match, consistent with the cost scenarios above. This accelerated engine/compression measurement excludes actual WebSocket/TLS overhead; live service testing remains necessary after protected deployment. Local practice, bot matches, and auto editing remain available when the single online room is occupied.

The first website release, [PR 277](https://github.com/ARES-23247/ARESWEB/pull/277), passed the complete protected test gate before merge. Its [production rollout and browser security smoke](https://github.com/ARES-23247/ARESWEB/actions/runs/34784051396) both passed. The online activation follows through a separate protected release with fresh WIF admission tokens.

Live-site testing of the first release exposed a local worker terminal-snapshot defect: a match finishing on tick 9509 (between regular snapshot slots) left the UI at SETTLING. The worker now publishes terminal snapshots explicitly and avoids repeating an unchanged terminal tick. A regression test runs the actual three-bot simulation through completion; it fails on the released worker and passes after the fix at Red 83 / Blue 100. Pause/reset/input handling also passes. The worker is now included in the coverage ratchet and measures 100% lines/functions with 96.15% branches.

The online handoff also clears the local pause state when a player seat is accepted. Previously a player joining from paused practice retained neutral controls while the online pause button was disabled. The four-browser test now pauses every client before create/join, checks the resumed online control state, and drives/shoots after AUTO. The regression reproduced against the previous build; the corrected full match is verified separately from production admission.
