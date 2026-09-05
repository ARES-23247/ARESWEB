# BUZZLE Word Help implementation plan

Status: implemented and verified locally on 2026-09-04. Not deployed. See
`BUZZLE_WORD_HELP.md` for the source decision, behavior and verification results.

## Intended experience

Add a Word Help area with an alphabetical two-letter reference, dictionary lookup,
and an optional Help Mode that finds legal two-letter placements for the current
player. Keep the board and rack usable while viewing suggestions.

Default product decisions:

- Help Mode is off initially. It is available in local, AI, and online games for
  human players, using only their own rack and the public board.
- "Possible" means a legal two-letter placement in the current position, not
  merely a word that can be spelled from the rack.
- The complete two-letter reference remains available regardless of turn.
- Suggestions preview a placement; they never place tiles or submit a move.
- Only words accepted by BUZZLE appear in dictionary results, word lists, and
  suggestions. Check the game's word list before fetching or displaying a
  definition. A missing definition does not make an accepted word unplayable.
- This work ends with verified local changes and screenshots. Deployment is a
  separate step.

## Current implementation to build on

- `src/lib/buzzleDictionary.ts` loads the accepted words from
  `public/data/buzzle-words.txt` and builds a set and trie. It contains spellings,
  not definitions.
- `src/lib/buzzle.ts` provides `analyzeBuzzlePlay`, including connectivity,
  opening-center, crossing-word, blank-tile, and scoring rules.
- `src/lib/buzzleAi.ts` already searches the three board axes, but returns one
  time-bounded AI choice. That result is not a complete two-letter reference or
  an exhaustive hint list.
- `src/app/buzzle/page.tsx` owns the rack, draft placements, handoff, and game UI.
  There is no structured played-word history in its current game state.
- `src/lib/buzzleOnline.ts` receives the public board and the requesting player's
  rack. Its current DTO does not contain a chronological move history.

## 1. Word Help shell and two-letter reference

Add a Word Help control near the existing game controls, with direct access to
"Two-letter words" and "Dictionary". Use a side panel on desktop and an accessible
sheet/dialog on phones. Help Mode suggestions use a compact nonmodal area near
the rack so they do not cover the board during play.

Derive the two-letter list from the loaded accepted-word set. Sort it
alphabetically, show its actual count, and support filtering by letter. Each word
has a definition action. Do not copy an external Scrabble list or introduce a
second validity list. Show loading and retry states if the word list is unavailable.

Acceptance: the displayed set exactly equals the game's accepted two-letter set;
opening and closing the panel preserves the rack, selection, and draft.

## 2. Dictionary lookup

First evaluate dictionary providers against this game's real two-letter list and
a representative sample of longer accepted words. Record coverage, license,
attribution, cache permissions, limits, availability, and cost. Select the provider
before implementing the integration; do not assume every accepted word has a
definition. Do not enroll in a paid service as part of research.

Implement one lookup interface shared by typed search and clicked words. Normalize
the query and check it against BUZZLE's accepted-word set before any provider
request or cached-definition display. If it is not accepted, show "Not accepted
in BUZZLE" without a definition or external lookup. If the game's word list is
loading or unavailable, show that state and wait or offer retry; do not bypass
the eligibility check. Any autocomplete or related-word suggestions must also
be filtered through the accepted-word set.

For an accepted word, show the word, available parts of speech, concise
definitions, source attribution, and pronunciation/examples when supplied by
the source. Do not substitute a provider's spelling correction or different
headword as an accepted result. If a legal word has no available definition,
show "Accepted in BUZZLE; definition unavailable." Dictionary sources supply
meanings; BUZZLE's word list remains the authority for which words are legal.

Use explicit states for loading, no definition, unavailable service, and retry.
Cancel or ignore stale responses when the selected word changes. Bound input,
response sizes, request duration, and cache size; deduplicate repeated lookups.
Render source content as text. Cache only as permitted by the provider. Keep any
credentials server-side in the existing secret-management system. If a backend
proxy is needed, follow the API and security skills, use explicit DTOs and the
existing error pipeline, and rate-limit it for both guests and signed-in players.
Send only the requested word to the provider, never racks or match credentials.

Acceptance: manual search and clicked words use identical results; illegal words
never produce definition results or provider requests, including through cached
results or spelling suggestions. Missing definitions and outages never block a
valid game move. Do not invent definitions.

## 3. Click words already on the board

Add a "Words on board" list derived from complete contiguous words along all
three axes of the authoritative board. Keep coordinate references so selecting
a word can identify its cells and open its definition. This supports existing
online matches without reconstructing an invented move history.

Provide an explicit word-inspection action for board interaction. If a selected
occupied cell belongs to multiple crossing words, let the player choose which
word to define. Preserve normal tile placement and keyboard board navigation.
Expose the same choices in the word list for screen-reader and touch users.

Label this list "Words on board," not "Move history": extended words on the board
do not establish when or by whom each complete word was originally played.
Permanent match history is outside this feature's scope.

Acceptance: a word crossing another can be looked up independently; opening a
definition does not alter any tiles, scores, or the active turn.

## 4. Help Mode: possible two-letter placements

Add a clearly labeled toggle with a visible on/off state. When enabled during a
human player's active turn:

1. Enumerate complete two-cell word spans on each of the three axes, using
   existing board letters and one or two available rack tiles. Account for repeated
   letters, blanks, board edges, and boundaries that would make the span longer
   than two letters.
2. Validate every candidate through `analyzeBuzzlePlay`. All words formed by the
   placement, including longer crossing words, must be valid. Respect the opening
   center and board connectivity rules.
3. Group valid placements by two-letter word and sort words alphabetically. Show
   the number of placements and the score of the currently selected placement.
   Offer separate "Preview placement" and "Definition" actions.
4. Preview the target cells and letters without modifying the actual draft. Allow
   cycling through placements for the same word. Give equivalent textual
   numbered board markers with matching letter and blank instructions. Keep
   remaining markers visible as the player completes compatible draft placements.

Recompute when the board, rack, or draft changes. Existing draft placements must
be fixed constraints on a suggestion, with each rack tile used at most once. If
the draft cannot fit a two-letter placement, explain that and offer the existing
Recall action; do not silently clear it. This feature finds complete two-letter
placements, not arbitrary longer plays that happen to create a two-letter crossing.

Use a dedicated worker or cancellable search based on the existing worker pattern.
Tag requests with the position/draft revision and discard stale results. Keep the
UI responsive and distinguish searching, complete-empty, error, and partial results.
Never say "No possible words" after an incomplete search. Paginate long result
lists without silently truncating the underlying search.

Clear previews on turn changes, reset, exchange mode, finish, and online updates.
Hide rack-derived suggestions during local handoff, AI turns, and opponents'
online turns. Make the same assistance available to both online participants;
do not fetch or infer an opponent's hidden rack. Server validation remains
authoritative when a player eventually submits their own move.

Acceptance: every shown placement passes the game validator; no valid candidate
in the defined two-letter scope is omitted after a completed search. Disabling
Help Mode removes previews without changing the game.

## 5. Verification and delivery

Physical-play extension: add a standalone `/buzzle/word-tools` page reachable
from the game chooser and header. Provide a local-only legal-word checker,
the complete accepted two-letter list, and the existing legal-only dictionary.
Precache the page's static dependencies and versioned accepted list, and prove
that both checker and reference survive an offline reload. New definitions
require internet. Display loading, retry, and offline-setup status truthfully.

- Unit tests: exact reference-list membership; exhaustive small-position hint
  comparisons; all axes; one- and two-tile placements; repeated letters; blanks;
  center opening; edges; invalid crossings; constrained drafts; no available plays;
  stale worker responses; dictionary cache and failure states; rejected queries
  making no provider request; accepted-word filtering of cached results,
  autocomplete, and provider spelling suggestions.
- Interaction tests: typed and clicked definitions, intersecting words, Help Mode
  toggling and previews, recall, handoff privacy, online updates, and game-state
  preservation. Use controlled fixtures in tests only.
- Browser checks: desktop and phone layouts, 320px reflow, keyboard operation,
  dialog focus/Escape restoration, screen-reader labels and announcements, and
  responsive play while searching. Show useful offline states: the reference and
  hints can work once the word list is loaded; definitions depend on available
  permitted cache entries or a connection.
- Run the full `AGENTS.md` verification gate. Meet the required coverage floors for
  new utilities and any API routes; document any reproducible unrelated failures.
- Supply desktop and mobile screenshots showing the two-letter reference, a
  definition, and Help Mode with a placement preview.

Implement in the numbered order above, with dictionary source selection early.
Likely additions are focused Word Help components, dictionary/hint utilities,
and a hint worker; avoid enlarging the page with all search and lookup logic.
Keep the existing BUZZELLO turn-indicator changes and unrelated work intact.
