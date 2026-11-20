# Academy source refresh for Studio 7.0.80

The November 20 website audit found that ARES Robotics Studio moved from `7.0.79` to `7.0.80`. This refresh resolves provenance strictly against the immutable public commits below. ARESLib, FTC Starter, and FRC Starter remain at `20.0.6`.

- Previous authority [1df7d080](https://github.com/ARES-23247/ARES-Robotics/commit/1df7d0805d82081d09119c0dad05ff059d1decaa)
- New authority [34b7b605](https://github.com/ARES-23247/ARES-Robotics/commit/34b7b605c128c0af9d0c991b144ebc80d51a7b32)

One of 140 referenced source paths changed: `release/ares-versions.properties` (`blob: 77bc5efc7eff6dbae2eabbaadfe681f714c52dac`) records the `studioVersion=7.0.80` bump. None of the 139 lesson-referenced robotics library, starter, or Studio UI/documentation source files changed, so existing lesson technical guidance remains accurate. Four stale `catalog.json` `appliesToVersion` badges (`FTC SDK 11.1.0`, `ARES-FRC 12.0.0`, and `ARES-FTC monorepo f3de343a`) and the duplicate `MotorIO.kt` `sourceRoots` entry in `robotics-curriculum-plan.json` were also aligned and guarded by `scripts/validate-learning-catalog.mjs`. [Upstream comparison](https://github.com/ARES-23247/ARES-Robotics/compare/1df7d0805d82081d09119c0dad05ff059d1decaa...34b7b605c128c0af9d0c991b144ebc80d51a7b32)

The catalog, source authorities, curriculum plan, and guarded release-candidate digests use the new authority and blob hashes. All three candidate batches retain their existing scope and `requiresHumanReview: true`.
