# Academy source refresh for Studio 7.0.79

The November 17 website audit found that Studio moved from `7.0.75` to `7.0.79`. The refresh uses the official public commits below. ARES and both starters remain at `20.0.6`.

- Previous authority [0134e485](https://github.com/ARES-23247/ARES-Robotics/commit/0134e4858ceb555556a70c08ada33251e1714e3a)
- New authority [1df7d080](https://github.com/ARES-23247/ARES-Robotics/commit/1df7d0805d82081d09119c0dad05ff059d1decaa)

Two of 140 referenced source paths changed. `release/ares-versions.properties` records the Studio version bump. `MatchStrategyScreen.kt` now hosts four tabs covering session debrief, scouting, matchup briefing, and alliance picklist. The debrief still uses recorded sessions and telemetry. The competition strategy lesson now explains which evidence comes from the debrief and which comes from other tabs. [Upstream comparison](https://github.com/ARES-23247/ARES-Robotics/compare/0134e4858ceb555556a70c08ada33251e1714e3a...1df7d0805d82081d09119c0dad05ff059d1decaa)

The catalog, curriculum plan, and guarded candidate use the new authority and blob hashes. The three candidate batches retain their existing scope and `requiresHumanReview: true`.
