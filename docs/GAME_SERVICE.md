# ARESWEB game service

The game backend is a reusable match boundary used by BUZZELLO and BUZZLE;
future game rules plug into the same service instead of creating separate
identity, invitation, matchmaking, persistence, or polling systems.

## Security and youth-safety contract

- A match exposes no chat, free-text profile, display name, friend list, public
  lobby, spectator feed, email address, or Firebase UID.
- Guests receive a random match-scoped capability. The browser keeps it only in
  memory and sends it in `X-Game-Player`; it is never placed in a URL or browser
  storage. Closing or refreshing the tab intentionally loses that capability.
- Firestore stores only HMAC hashes of player capabilities. `game_matches`,
  `game_invites`, and `game_matchmaking` deny every browser read and write.
- Every response is a player-specific DTO. An adapter may return a player's own
  hidden rack or hand, but must never return another player's private state.
- Friend links use `#join=CODE`. URL fragments are not sent in HTTP requests or
  referrer headers, and the client removes the fragment immediately after use.
- Guest and team matchmaking use distinct queue buckets. Team matchmaking also
  runs the normal `ensureTeamMember` authorization check.

## Reusable service boundary

`functions/src/lib/gameMatches.ts` owns:

- match-scoped capabilities and constant-time hash comparison;
- configurable 2–8 player rooms;
- short-lived friend invites;
- bounded guest and team matchmaking buckets;
- match lifecycle, hard expiry, TTL fields, and per-player sync budgets;
- player-count validation and private player-specific DTO projection;
- global match versions and per-player action sequences;
- sequential and simultaneous action concurrency policies.

A game adapter implements `GameDefinition` and owns only game semantics:

- stable `gameType` and player-count bounds;
- default matchmaking size and maximum action count;
- initial-state construction and strict persisted-state parsing;
- current player selection for sequential games;
- action application and finish detection;
- player labels; and
- the player-specific view of public and hidden state.

Sequential games require the caller's global `expectedVersion` and verify the
active player. Simultaneous games use `expectedActionSequence` per player, so an
unrelated player's accepted action does not make another player's action stale.
Firestore transactions still serialize authoritative state updates.

Clients synchronize conservatively. During a sequential game, only the player
waiting for remote state polls; the active player already owns the only action
that can change the match. Polling begins promptly, backs off from four to
twelve seconds while the opponent is thinking, and stops in hidden tabs and
finished games. Clients send their last observed version, status, and player
count. When those fields are unchanged, the API returns only the remaining sync
budget and expiry instead of repeating the board, history, and player view.
Older clients that omit the cursor continue to receive the full DTO.

BUZZELLO's adapter is `functions/src/lib/buzzelloGameDefinition.ts`. It fixes the
room size at two, uses sequential actions, maps player indexes to Yellow and
Black, and exposes no hidden state.

BUZZLE's adapter is `functions/src/lib/buzzleGameDefinition.ts`. It reuses the
same two-player invitation, guest matchmaking, team matchmaking, expiry,
capability, and synchronization boundary. The adapter owns the shuffled
100-tile distribution, server-side dictionary validation, three-axis scoring,
turn actions, and endgame penalties. Its player DTO exposes the caller's rack,
opponent rack counts, scores, public board, and bag count; the bag order and
opponent rack contents never leave the service.

## Match flows

Friend match:

1. Create a match and a ten-minute invite.
2. Return the creator's capability once.
3. Allow the invite to add players until the adapter's configured room size is
   reached; then remove the invite and activate the match.

Matchmaking:

1. Select the definition-controlled game type, audience, and player count.
2. Join the single short-lived bucket for that exact combination.
3. Keep the match waiting while the room fills; remove the bucket when full.
4. Expire an unfilled search after 90 seconds.

The single bucket per combination deliberately avoids a browsable lobby and
bounds queued records. Future skill ratings or variants must be finite,
server-validated bucket identifiers—not user-provided Firestore paths.

## Adding another game

1. Add a strict engine and `GameDefinition` adapter. Do not add route-owned game
   rules.
2. Decide whether actions are sequential or simultaneous and specify supported
   player counts. Do not infer this from client input.
3. Parse every persisted field and construct an explicit player view. Add tests
   proving hidden hands/racks cannot cross player boundaries.
4. Mount a thin route that validates the action DTO and applies feature-specific
   distributed quotas before calling `GameMatchService`.
5. Add Firestore/API, malformed-state, replay, stale-action, expiry, sync-budget,
   guest/team matchmaking, accessibility, touch, and multi-browser tests.
6. Keep dictionaries, tile distributions, scoring, timers, and other game rules
   inside that adapter or its engine. The Bananagrams-like specification remains
   deferred until its approved requirements exist.

## Operational and cost controls

All mutations depend on production App Check enforcement in the dedicated game
API process. The route layer adds per-address smoothing, a service-wide
in-memory ceiling, and HMAC-pseudonymized IP and global Firestore quotas.
Matchmaking, creation, joining, moves, and sync use separate limits.

Every accepted route also reserves weighted units from the single
`games-monthly-resource-project` calendar-month budget. The ceiling is 500,000
units: creation, joining, and matchmaking cost 8; BUZZELLO moves cost 6;
BUZZLE actions cost 8; and sync costs 5. Quotas are reserved together in one
Firestore transaction. When a global
quota is exhausted, the active instance caches the cutoff until the next
window, so repeated rejected requests do not keep reading Firestore. This
application budget is intentionally a resource ceiling, not a fabricated
dollar conversion.

The backend runs as the `aresweb-game-api` Cloud Run service, separate from
Cloud Run functions used by the rest of the website. Its reviewed contract is:

- request-based billing with scale-to-zero;
- one maximum instance, `0.08 vCPU`, `256 MiB`, and concurrency `1`;
- a 10-second request timeout and no startup CPU boost;
- only the game runtime identity and two game secrets;
- immutable container images from the reviewed Artifact Registry repository;
- a `$35 USD` monthly Cloud Billing spend cap scoped to the `Cloud Run`
  service category.

The spend cap is defense in depth, not a literal guarantee: Google documents
that enforcement is not instantaneous and any overage is billed. Firestore is
not currently eligible for spend-cap budgets. The large margin below `$50`,
the fractional single-instance ceiling, monthly resource budget, App Check,
short match/invite/search expiry, per-player sync limits, compact unchanged
responses, and Firestore TTL cleanup must remain enabled together.

Do not restore unconditional fixed-interval polling or full-state responses for
unchanged matches; both increase bandwidth without improving turn-based
responsiveness. Do not enable, deploy, or relax these controls outside the
protected release process.
