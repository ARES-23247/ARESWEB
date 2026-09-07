# Community implementation contract

Status: M6 in progress, 2026-09-06. The local game-service API now implements
verification, publication/review transactions, owner access, discovery, categorical
reports and resolution. Bounded retirement is implemented and emulator-tested;
its schedule is now wired locally, with operational verification still open.
The website injects the shared
authenticated transport into the package client. Guest browse, play and categorical
report interfaces are implemented inside the game window. Publishing, moderator
screens and remix authoring are saved locally with focused checks; final
verification and full milestone acceptance are unfinished. Nothing is deployed.
As of 2026-09-07 the [pixel-art slice](PIXEL_ART_PIVOT.md) takes priority over
additional community expansion. Preserve the confirmed policies below.

## Confirmed policy

Current authorized team members may submit; admin/coach review is required before
public publication. Guest play and local building stay available. Approved remixes
survive parent deletion; remove the deleted parent's content and public link while
retaining private moderation lineage. No open signup, public chat or free-text
profiles are added. These two publishing/remix policies were answered by the user.

## Ownership and transport

Follow `docs/GAME_ARCHITECTURE.md`: the package owns game contracts and UI; the
website injects an authenticated client. The existing bounded game service owns
`/api/waggle-way`. `apps/game.ts`, `API_ROUTE_GROUPS.game`, Hosting rewrites,
the game-service validator and deployment health contract now include this API.
Do not attach
game routes to `coreApp` just because existing profile moderation lives there.
No new service, credentials or broader production permissions are presumed.

Mount the community router after shared CORS, request ceilings and App Check, but
before the generic JSON parser. Each mutation must authenticate (where required),
apply durable quotas, then parse its own bounded body. The proof route accepts
UTF-8 JSON text capped at 768 KiB; the isolated verifier parses/replays it. Other
mutation bodies are bounded separately. Unknown media types fail explicitly.
Tests must prove an unauthenticated oversized proof is rejected before parsing.

Use existing `ensureTeamMember` and `ensureAdmin` current-record checks; never
cache authorization in a level record. Use `asyncHandler`, `ApiError` and the
shared error handler. Client errors stay visible and do not masquerade as an
empty catalog. All collections remain private to server APIs; emulator rules
must deny direct client reads and writes, including the public-looking metadata.

## Records and revision lifecycle

A private level head owns its creator UID, monotonic version, candidate pointer,
published pointer, deletion/removal state and optional parent lineage. Public IDs
identify levels, never users. Immutable revision records contain validated level
content, exact canonical hash, verification witnesses, supported rules version,
creator nickname and discovery metadata. Plain-text title/instructions/nickname
and every public metadata change require review along with gameplay changes.

Local drafts remain local. A submission creates a candidate with status pending;
a later submission supersedes that candidate. The previous published revision
remains playable during editing/review. Rejection leaves that published revision
intact and gives the owner an explicit review result. Approval atomically points
the head at the exact verified/reviewed revision. Removal or creator deletion
makes direct retrieval and discovery unavailable immediately.

Every mutation supplies the expected head version. Verification runs outside the
transaction; the transaction rechecks current ownership, head version, candidate,
removal state and any parent visibility before accepting its result. Review uses
the exact pending revision/hash. Stale writes return a conflict with reload/retry
instructions, never overwrite a newer revision. No client-supplied won flag,
rescue count, verification badge, owner UID or moderation role is authoritative.

Retain at most the current publication and latest candidate content for each
head; superseded content/proofs enter bounded cleanup. Preserve only compact
private revision hashes/status/lineage needed for moderation after content
purging. Deleting a head tombstones visibility first and clears its own authored
revision content; it never traverses and deletes approved descendants. Cleanup
must be idempotent and bounded even after partial failure. Default audit/tombstone
retention is 90 days; each surviving child retains its own immediate parent
ID/hash, so expired parent audit records do not erase private remix lineage.

Implementation defaults: at most 20 active heads per creator and 3 simultaneous
pending submissions. Enforce these transactionally using per-creator counters;
deletions and resolved reviews release the corresponding capacity exactly once.
These are engineering defaults, not additional user policy decisions.

## Verification and resource ceilings

`waggleProof.ts` canonicalizes versions 1–5 and accepts 1–3 distinct successful
recordings. Each must meet the rescue target. Separate successful witnesses may
prove pollen and tool goals, matching campaign alternatives. Hashes bind canonical
content, objectives and verifier/rules identity. The Node worker uses the same
staged pure rules as local play, never website/Firebase code.

The current adapter admits one worker per process, has a 5-second wall deadline,
and configures V8 heap/stack limits (64 MiB old, 16 MiB young, 4 MiB stack). These
are V8 limits, not a claim about total RSS. Capacity remains held after failed
termination until worker exit is confirmed. Late results, invalid packets, worker
errors and timeouts fail closed. Replay limits remain 54,000 ticks/10,000 actions.

Proof admission enforces 6 requests/hour and 20/day per current member,
plus a service-wide 500/day verification ceiling through distributed quotas.
Those ceilings allow at most 2,500 worker wall-seconds/day; they do not account
for authentication, Firestore, main-process overhead or idle hosting. No dollar
cost or reference-device performance claim is inferred. Profile accepted-size
adversarial layouts and concurrent existing games before deployment approval.
Store compact witness summaries/hashes after verification rather than retaining
all replay payloads in published revisions; byte-check every persisted document.

The mounted API applies those ceilings and the existing shared 500,000 monthly
game resource-unit budget, without increasing runtime resources or permissions.
Proof requests cost 100 units; management and read requests cost 30; reports cost
10. These are admission weights, not dollar estimates or measured CPU costs.
Guest reports allow 10/IP/hour and 500 globally/day. Management allows 100/member/
hour and 2,000 globally/day; public reads allow 120/IP/hour and 10,000 globally/day;
private reads allow 180/member/hour and 5,000 globally/day. All durable budgets
precede their route's body parser. Proofs use a 768 KiB text parser; other writes
use an 8 KiB JSON parser. Only UTF-8 JSON with no compression is accepted. Unknown
community paths terminate before the shared JSON parser.

## Public DTOs, browsing and attribution

List pages return at most 12 cards with opaque validated cursors. Cards contain
public level ID, approved title/nickname, built-in theme, supported mechanics,
creator-estimated difficulty/length and verified optional objectives. Label those
estimates as creator estimates. Do not invent ratings, popularity or play counts.
The detail endpoint returns only the published, non-deleted revision's allowlisted
level fields and approved attribution. No raw Firestore snapshots, UIDs, review
notes, pending content, reporter identities or operational metadata reach guests.

Define and test the Firestore indexes for supported filter combinations before
shipping filters. Bound both record scans and attribution lookups; do not fetch
an unbounded collection and filter it in memory. Unsupported rules must produce
an explicit unavailable state and must not appear as currently verified.

The server creates remix lineage from the currently available parent revision,
then the child follows its own verification/review lifecycle. Public parent
attribution is derived from current parent visibility on every response, with
`Cache-Control: no-store`; omit the deleted/removed parent's title, nickname and
link. Already-approved children remain visible independently. Prevent new remixes
from unavailable parents and test deletion racing remix submission. Private
lineage stores IDs/hashes and the parent's creation timestamp, not a retained
public snapshot of deleted content. The creation timestamp prevents a later reuse
of an expired parent's identifier from restoring attribution or reviving an
unapproved child.

## Reports and moderation

Provide a guest-accessible, App-Check-protected categorical report endpoint with
IP/global quotas and no free-text field. Deduplicate repeated reports without
exposing reporter data. Admins/coaches get a bounded queue and explicit resolve,
reject, approve and remove actions. Owners get only their own candidate/review
state. Removing a derivative is a separate explicit moderation action; parent
removal never silently approves or removes descendants.

Implemented reports deduplicate a category across the exact publication and
level creation generation. They store no reporter UID/IP, free text or vote count.
Resolving a report does not remove a garden; removal is a separate, version-checked
moderation action. Repeated reports of the same retained category do not reopen a
resolved item. Queue DTOs omit content when the reported publication has changed,
disappeared or been removed. Reports expire after 90 days, including unresolved
ones; the moderator queue excludes expired items.

`cleanupWaggleCommunity` performs one bounded pass: at most 12 expired tombstones,
25 leftover revisions per tombstone, 25 expired reports and 25 expired audit
events. Each transaction rechecks the current record. A tombstone remains until
its last revision batch is purged; interrupted passes can resume safely. The
cleanup never scans descendants. Index configuration includes retirement and
report-queue queries; audit expiry retains TTL plus an ascending cleanup index.
`cleanupWaggleGardens` is now wired locally for one pass every 15 minutes in UTC,
with no immediate retries, 256 MiB, a 60-second timeout, concurrency/max instances
of one, and the existing game runtime service account. Its declaration is included
in the production deployment contract. Deployment-contract validation, resource/
IAM and monitoring ownership review, and operational verification remain required
before M6 acceptance or an explicitly approved deployment. No production schedule
has been activated by this local work.

## Local HTTP surface

All paths below are relative to `/api/waggle-way`. Responses use `private,
no-store`; unexpected storage failures remain explicit generic errors.

| Endpoint | Access / behavior |
| --- | --- |
| `GET /gardens`, `GET /gardens/:id` | Guest approved discovery/detail |
| `GET /mine`, `GET /mine/:id` | Current member, own head/latest revision only |
| `PUT /mine/:id` | Current member, exact version and replay proof submission |
| `DELETE /mine/:id` | Current owner, exact-version deletion |
| `GET /review`, `GET /review/:id` | Admin/coach pending queue and review evidence |
| `POST /review/:id` | Admin/coach exact version/digest approve or reject |
| `POST /gardens/:id/remove` | Admin/coach exact-version publication removal |
| `POST /gardens/:id/report` | Guest App Check, categorical report |
| `GET /reports`, `POST /reports/:id/resolve` | Admin/coach queue and resolution |

## Resource observations

Reproduce with `pnpm --filter functions build`, then
`node scripts/profile-waggle-community.mjs`. On this Windows / Node 24.19.0 host,
the winning blank garden verified in 133 ms at 74.3 MiB sampled process RSS.
Accepted-size stress inputs with 512 objects and 100 bees, requesting 54,000
ticks, hit the 5-second verifier deadline: 5,007 ms for one witness (245,661 bytes)
and 5,010 ms for three witnesses (571,571 bytes). Sampled whole-process RSS peaked
at 102.2 MiB. These are bounded rejection measurements, not successful solutions.
Concurrent local BUZZELLO rule calculations continued with a maximum sampled
move time of 4.45 ms and maximum 25 ms timer gap of 39.62 ms. This is not a live
HTTP load test or a Cloud Run fractional-CPU measurement. Profiling the deployed
runtime limits and reference mobile rendering remains required before release.
The configured game service admits one HTTP request at a time, so a verifier
request can delay other game requests even though its worker leaves the Node
event loop responsive. The rule-calculation sample does not measure that queue.

## Workshop implementation status

The local workshop now records bounded successful flights for the exact authored
level, invalidates them after edits/imports/load/Undo/Redo, and exposes submission
and owner status in a game dialog. Ownership stays outside exported level files;
account changes discard private bindings and responses. Uncertain requests retain
their publication ID and require checking the saved revision before retrying.
Loading and deletion are explicit, with draft export available before replacement.
The request deadline covers delayed authentication startup and body parsing.

Moderator queues and public remix authoring are connected locally. Focused tests
cover fresh revision confirmation, candidate playtest, exact-head review/removal
and separate report resolution. Full verification and human review remain open;
see [implementation progress](IMPLEMENTATION_PROGRESS.md). The following
boundaries apply to these interfaces and the workshop.

## Interface requirements

Interface work follows these boundaries:

- The site derives submission/review affordances from its current authorization
  context and injects them with the client. The server remains authoritative.
  Private owner/review panels must clear their cached responses when the account
  changes, and ignore requests completed for an earlier account or closed panel.
- Builder test flights collect bounded successful recordings tied to the exact
  authored level. Capture witnesses for rescue, pollen and tool objectives; edits,
  imports, loading another draft, undo and redo invalidate the current submission
  evidence. Cover the direct asynchronous import path as well as the editor's
  ordinary `commit` helper. In-run commands never mutate the authored draft.
- Publication identity/version and remix parent identity/revision are separate
  from imported/local level IDs. Importing a file must never claim ownership of
  a public head. Preserve a new submission's generated ID after an uncertain
  request so the player can reload its status before retrying.
- Owners see their own status and current rejection/removal reason, can reopen
  a revision for editing, and explicitly confirm published deletion. Reviewers
  inspect/play the fetched candidate and submit its exact version and review
  digest. Conflicts require reloading the candidate before another decision.
- Remix authoring starts from a freshly fetched public revision and follows the
  same proof/review workflow. If a parent link later returns unavailable, remove
  its stale attribution while preserving the approved child's playable content.
  Guest browsing already implements this last behavior.
- Keep publishing, ownership, review and report queues in game/workshop overlays
  with bounded pages, keyboard focus restoration, and explicit errors. Keep
  report resolution separate from removing the reported publication.

## Required evidence before calling M6 complete

- Current/archived/unknown member authorization, owner isolation, admin/coach-only
  review and direct Firestore denial, including forged roles and ownership.
- Auth/quota-before-parser order; bounded query/cursor/body behavior; cancellation,
  worker capacity, deadline, malformed packet, replay forgery and stale revision.
- Public list/detail visibility parity; explicit DTO field exclusion; unapproved
  text and unsupported rules never labelled as verified.
- Submit/edit/reject/approve/remove/delete transactions, capacity accounting and
  bounded cleanup recovery; two concurrent edits cannot publish stale evidence.
- Approved remix survival and immediate parent attribution removal; unavailable
  parent remix rejection and independent derivative moderation.
- Browser flows for authenticated submission, owner review status, admin approval,
  guest discovery/play/remix, reports, empty catalog, errors and keyboard/touch use.
- Required repository gate, documented resource measurements and separate explicit
  production deployment approval. Local tests do not authorize production writes.
