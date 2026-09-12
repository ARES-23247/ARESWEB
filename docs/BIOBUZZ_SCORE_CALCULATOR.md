# BIOBUZZ score calculator

The public practice calculator is at `/biobuzz/score-calculator`, linked from
Resources in desktop/mobile navigation and the footer. It requires no sign-in.
Entries are held in React state only and are cleared on navigation or reload.
Reset has a one-step undo; event settings are preserved on reset.

## Source and scope

Implemented from the owner-supplied `BIOBUZZ_Competition_Manual_V1.pdf`, inspected
on 2026-09-12. SHA-256:
`2ee0ea8327da47deb871e33307898c13ee5310d5af260007dc11bb4471181f5a`.
The supplied filename resolved in Downloads, rather than the nested path in the
request. The PDF is not copied into public assets or committed to this repository.
This implementation pins V1; it does not claim to include subsequent Team Updates.

| Achievement | Value | Source |
| --- | --- | --- |
| AUTO LEAVE | 3 per robot | §10.5.4–10.5.5, pp. 90–91 |
| AUTO / TELEOP PARK | 5 per robot, each period independently | §10.5.4–10.5.5 |
| HIVE TIP | 20 in either period | §10.5.1, §10.5.5 |
| Elements remaining in upward CELL | 2 each at match end | §10.5.1, §10.5.5 |
| FLOWER bottom NECTAR | 5 to the bottom-most scoring NECTAR's alliance | §10.5.2, §10.5.5 |
| FLOWER elements | 2 each to the top-most scoring NECTAR's alliance | §10.5.2, §10.5.5 |
| GARDEN elements | 1 each to the GARDEN's alliance | §10.5.3, §10.5.5 |
| Minor / major fouls | 5 / 20 credited to the opponent | §10.6, p. 92 |
| SWARM | 1 RP at 16 combined LEAVE + both PARK periods' points | Table 10-3, p. 91 |
| POLLINATOR 1 / 2 | 1 RP each at 4 / 7 combined AUTO + TELEOP tips | Table 10-3 |
| Win / tie / loss | 3 / 1 / 0 RP | Table 10-2 |

There are four shared FLOWERS (§9.7, p. 72). Each editor represents only the
scoring volume between the top and middle rings, ordered bottom to top. POLLEN
above the highest NECTAR does not change ownership. Bottom bonus and ownership
may go to different alliances. Removing an element recomputes both.
Empty FLOWERS and POLLEN-only FLOWERS have no owner or bonus.

The initial form is an empty score sheet, not a simulated starting field. Enter
the observed scoring achievements and final scoring locations. Cell and garden
counts combine element colors as allowed by the scoring rules. The calculator
rejects negative, fractional, missing and out-of-range counts, more than two
robots per robot achievement, more than 40 FLOWER POLLEN or eight FLOWER NECTAR
of either color, and more than 56 elements across all final scoring locations
(§9.8, p. 74). It cannot validate colors in the combined cell/garden counts or
geometric stack feasibility. Tips and foul counters have an input bound of 9999,
which is an application bound, not a rule-defined maximum.

RP defaults are for "All Other Events" in V1. Regional and FIRST Championship
thresholds are TBA in that version; selecting Championship withholds bonus/total
RP while retaining match scores and result RP. Custom thresholds support announced
event values and Premier events. Positive integer thresholds are required, with
POLLINATOR 2 at least POLLINATOR 1. Playoff mode hides all RP.

This is a practice estimator, not the official scoring system. It does not infer
timing violations or referee adjustments, model cards/disqualifications, or compute
individual team rankings/surrogate eligibility. In particular, qualification DQ
is team-specific (§13.6.3/T601); an alliance-wide zero would incorrectly penalize
an eligible partner. Users are told these limitations in the scoring notes.

## Ownership and verification

- Pure scoring and validation: `src/lib/biobuzzScoring.ts`.
- Website UI: `src/app/biobuzz/score-calculator/page.tsx`.
- Focused unit checks: `pnpm test src/lib/biobuzzScoring.test.ts`.
- Browser flow, keyboard navigation and 320px reflow: `e2e/biobuzz.spec.ts`.
- New scoring utility has explicit 85% line / 100% function coverage gates.
- Public delivery includes the lazy React route, prerender metadata, Firebase
  Hosting rewrite and sitemap inventory. No new backend endpoint is needed.

Follow the complete root verification gate and normal pull-request workflow.
Production deployment requires separate authorization.
