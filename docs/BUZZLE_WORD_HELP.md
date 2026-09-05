# BUZZLE Word Help

Implemented and verified on 2026-09-04. The owner approved deployment on
2026-09-04 through the protected pull-request and production release workflow.

## Player behavior

- Physical play tools opens `/buzzle/word-tools` from the game chooser or header,
  without starting a digital match or signing in. Its three sections are Check
  a word, Two-letter words, and Dictionary. Check a word uses the exact BUZZLE
  accepted set locally and makes no definition request. A legal spelling does
  not certify a physical board placement or its crossings.
- The physical-play checker and complete two-letter list reopen offline after
  the production service worker finishes setup. The page reports readiness;
  an offered app update must be accepted first. Browser storage must remain
  available and must not be cleared. New definitions require internet.
- Two-letter words lists the 128 currently accepted spellings, derived from
  BUZZLE's own lexicon. The count updates with the lexicon.
- Dictionary accepts typed queries and selections from the reference or board.
  Illegal words produce "Not accepted in BUZZLE" before either a cache lookup
  or a network request. Accepted spellings remain playable without definitions.
- Select an occupied board cell to choose among its crossing words. The separate
  Words on board list provides the same dictionary access without board tapping.
- Help Mode starts off. It searches complete two-cell spans on all three axes,
  using the current player's rack and retaining draft placements as constraints.
  It validates every crossing with the existing game engine. Previews show numbered
  markers directly on the target cells, with matching letter/blank instructions
  and total score. Compatible draft placements retain the remaining markers;
  completed steps are marked as placed. Previews do not change tiles.
- Results are grouped by word and paginated eight words at a time. The search is
  exhaustive within its two-letter scope and runs in a worker. Position changes
  remount the search and terminate the old worker; previews are position-bound.
- Rack-derived suggestions are absent during handoff, AI and online opponent
  turns, exchange mode, and finished matches. Public word references remain usable.

## Definition source decision

Use the English definitions from Wiktionary's
[`/api/rest_v1/page/definition/{word}` endpoint](https://www.mediawiki.org/wiki/Wikimedia_REST_API).
Its documentation describes this endpoint as experimental, so the adapter is
isolated and failures have an explicit retry state. There is no paid enrollment
or API key. Browser requests omit credentials and referrer and identify the
application with `Api-User-Agent` under the
[Wikimedia API usage guidelines](https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_API_Usage_Guidelines).
Only the exact accepted spelling is requested; redirects are rejected and
non-English senses are omitted. No provider suggestions change the game lexicon.

Comparison performed during implementation:

| Source | Decision |
| --- | --- |
| [Wiktionary](https://en.wiktionary.org/) | Selected. Live browser definitions verified, no account/key needed, source attribution available. Experimental endpoint and external availability remain dependencies. |
| [Free Dictionary API](https://dictionaryapi.dev/) | Evaluated first. No key required, but initial live browser checks timed out. Not used by the final app. |
| [Merriam-Webster](https://dictionaryapi.com/) | Requires registration/API key; its published free tier is limited to non-commercial use and 1,000 queries/day per key. No account was created. |

The coverage sample uses all accepted two-letter words and eight accepted longer
words. Command-line network errors are recorded separately from missing entries;
they do not establish that a definition does not exist. Reproducible probe
artifacts and the final browser sample are under `scratch/buzzle-word-help/`.
The completed browser sample returned English senses for 126 of 128 two-letter
words and all eight longer words. `sj` and `ua` returned entries without English
senses; the UI reports their definitions unavailable and keeps them playable.

Definition text is attributed to Wiktionary contributors under
[CC BY-SA 4.0](https://en.wiktionary.org/wiki/Wiktionary:Copyrights). The UI links
the source entry and license and discloses formatting/sense selection. HTML is
stripped with DOMPurify and rendered as React text; no source HTML, audio,
synonyms or arbitrary source links are embedded. Up to 12 senses are shown.

Requests have a 10-second timeout, 256 KiB response limit, at most three in-flight
lookups and a 500ms spacing limit for new words. In-flight requests deduplicate.
Results use a 100-entry, 15-minute memory cache scoped to the open Word Help panel
or standalone Word Tools page.
There is no persistent definition storage or service-worker API cache. The
reference and hints run locally after the word list loads; uncached definitions
need connectivity. The privacy page describes direct-provider connection data.

## Operations and verification

Firebase Hosting's `connect-src` adds only `https://en.wiktionary.org`. No Cloud
Function, secret, authorization rule, or production data change is needed.

The service worker precaches the public 2.76 MB accepted-word file with its
SHA-256 revision and the standalone page's static import graph from Vite's
build manifest. This keeps the offline page and list on the same release.
Only `/buzzle/word-tools` is added to the navigation fallback allowlist.
Definition, API and Firebase responses are never cached by the worker.
The PWA browser test enforces a 4.5 MB aggregate precache ceiling and a 3 MB
individual asset ceiling against actual cached response bodies.

New unit tests cover accepted-list filtering, hint legality and completeness on
controlled positions, crossing words, blanks, draft tile identities, response
sanitization, bounded caching, unavailable results and stale requests/workers.
Browser tests cover legal-only dictionary results, draft preservation, focus
restoration, preview-only hints, 320px reflow and handoff privacy. Test data stays
in tests. Screenshots use real local games and live definitions.

The full repository gate and final results for the physical-play extension are
recorded in `scratch/buzzle-physical/gate-summary.txt`. Desktop and phone
screenshots, with real offline reloads and live definitions, are in the same
directory; `screenshots.json` records the observed results.

Final verification: all required gates passed; 1,240 frontend tests, 893 backend
tests, 33 rules tests and 233 browser tests passed. Both new utilities meet their
85% line / 100% function coverage requirements. Physical-play browser tests
exercise the checker, reference and dictionary, including 320px reflow. The
production worker test reloads the page offline before checking accepted and
rejected words and all 128 two-letter words. The production
dependency audit found no known vulnerabilities. Browser tests run in desktop
Chrome, Android Chrome, iPhone Safari, Firefox, desktop Safari and the PWA project.
The final precache size and asset-boundary assertions also passed a focused
three-test PWA rerun, lint, and type checking.
