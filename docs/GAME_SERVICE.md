# ARESWEB game service

The game backend is a reusable match boundary. BUZZELLO is the first adapter;
future game rules must plug into the same service instead of creating separate
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

BUZZELLO's adapter is `functions/src/lib/buzzelloGameDefinition.ts`. It fixes the
room size at two, uses sequential actions, maps player indexes to Yellow and
Black, and exposes no hidden state.

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
   inside that adapter or its engine. The Scrabble-like and Bananagrams-like
   specifications are intentionally deferred until their approved requirements
   exist.

## Operational controls

All mutations depend on production App Check enforcement in the shared API app.
The route layer adds in-memory smoothing plus HMAC-pseudonymized IP and global
Firestore quotas. Matchmaking, creation, joining, moves, and sync use separate
limits. Cloud Functions `maxInstances`, match expiry, invite/search expiry,
per-player sync budgets, and Firestore TTL cleanup provide independent cost
bounds.

Do not enable, deploy, or relax these controls without the normal protected
release process. Billing alerts are detection, not a hard spending cap.
