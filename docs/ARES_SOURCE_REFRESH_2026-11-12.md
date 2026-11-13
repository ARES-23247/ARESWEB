# Academy source refresh during November 12 fresh site audit & remediation

During the November 12 site audit (`FA-16`), `pnpm run content:verify` reported that the official `ARES-Robotics` `main` branch advanced from `Studio 7.0.74` to `Studio 7.0.75` (`0134e4858ceb555556a70c08ada33251e1714e3a`). This refresh uses the standing maintenance approval in `AGENTS.md` to update repository source files and unapproved review-candidate digests without publishing or migrating production Academy documents.

- Previous official source: [`4c789f471cb7490f3d3995c2b449881543516a2e`](https://github.com/ARES-23247/ARES-Robotics/commit/4c789f471cb7490f3d3995c2b449881543516a2e), ARES 20.0.6 / Studio 7.0.74; FTC/FRC starters 20.0.6.
- New official source: [`0134e4858ceb555556a70c08ada33251e1714e3a`](https://github.com/ARES-23247/ARES-Robotics/commit/0134e4858ceb555556a70c08ada33251e1714e3a), ARES 20.0.6 / Studio 7.0.75; FTC/FRC starters 20.0.6.
- Release metadata and all 140 referenced Git blob hashes were resolved from a clean bare clone of `https://github.com/ARES-23247/ARES-Robotics.git` at `0134e4858ceb555556a70c08ada33251e1714e3a` and verified against GitHub via `pnpm run content:verify`. No local monorepo working-tree edits were used.

## Reviewed source changes (`4c789f47..0134e485`)

4 of the 140 referenced catalog source paths changed across upstream merge `#116`:

1. `release/ares-versions.properties` — bumps `studioVersion=7.0.75` while `aresVersion=20.0.6`, `ftcStarterVersion=20.0.6`, and `frcStarterVersion=20.0.6` remain unchanged.
2. `ARES-Analytics/app/src/main/kotlin/com/ares/analytics/ui/screens/MatchStrategyScreen.kt` — replaces the former developer-preview sample layout with deterministic session-backed analysis over DuckDB `Session`, `SessionSummary`, `ReplayPoseRepository`, `TelemetryFrame`, `AlertRecord`, and `SessionAnnotation` records.
3. `ARES-Analytics/app/src/main/kotlin/com/ares/analytics/service/ReplayEngineService.kt` — adds additive replay loop slice controls (`setSliceIn`, `setSliceOut`, and slice-bounded playback loops) while preserving existing replay fidelity and held/missing semantics.
4. `ARES-Analytics/app/src/main/kotlin/com/ares/analytics/service/RunComparisonService.kt` — uses `effectiveTimestampMs()` when normalizing annotation markers in `RunComparisonService`.

## Bounded lesson corrections

- **`content/learning/competition-operations/03-strategy-tradeoffs.md` & `content/learning/catalog.json` (`competition-strategy`):** Updated the Match Strategy reference description and prose so it accurately notes that ARES Match Strategy is now backed by recorded DuckDB session, summary, telemetry, alert, and annotation records (summarizing observed run evidence rather than predicting future matches), while keeping the hands-on lesson values invented and review gates intact.
- All other referenced lessons remained accurate and received automated `Studio 7.0.75` version-text and blob-hash updates across `catalog.json`, `robotics-curriculum-plan.json`, `source-authorities.json`, and `release-candidate.json`.
