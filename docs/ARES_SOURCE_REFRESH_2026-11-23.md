# Academy source refresh for ARES 20.0.8 and Studio 7.0.83

On November 23, `ARES-Robotics` advanced to `ARES 20.0.8` (FTC/FRC Starters `20.0.8`, XRP Starter `3.0.72`, Lightbot Example `3.0.77`, BIOBUZZ Example `1.1.15`) and `Studio 7.0.83`. This refresh pins provenance strictly against the immutable public commits below:

- Previous authority [e9344b3a](https://github.com/ARES-23247/ARES-Robotics/commit/e9344b3a224d3678eca90a88ed95de8bda92cbd6)
- New authority [46d7bb4b](https://github.com/ARES-23247/ARES-Robotics/commit/46d7bb4b412d3244a5bd35263ef9d9272c30c0e2)
- [Upstream comparison](https://github.com/ARES-23247/ARES-Robotics/compare/e9344b3a224d3678eca90a88ed95de8bda92cbd6...46d7bb4b412d3244a5bd35263ef9d9272c30c0e2)

Four of 140 referenced source paths changed and every changed file was reviewed:

- `release/ares-versions.properties`: bumped `aresVersion=20.0.8`, `studioVersion=7.0.83`, `ftcStarterVersion=20.0.8`, `frcStarterVersion=20.0.8`, `xrpStarterVersion=3.0.72`, `lightbotExampleVersion=3.0.77`, and `biobuzzExampleVersion=1.1.15`.
- `.github/workflows/monorepo-ci.yml`: SHA-pinned GitHub Actions, added explicit job timeouts and `persist-credentials: false`, and wired `:verifyProductionKotlinFileSizes` and `:koverVerify`.
- `ARES-FTC/TeamCode/build.gradle`: bumped `com.google.code.gson:gson` from `2.14.0` to `2.15.0`.
- `docs/milestones/RELEASE_TRANSITION.md`: noted that Studio releases bundle FTC/FRC/XRP starters, Lightbot/BIOBUZZ examples, checksums, and `windows-installer-trust.json`.

None of the lesson-referenced robotics library APIs, control algorithms, starter contracts, or Studio UI flows changed, so existing conceptual lesson guidance remains accurate. Version text across lessons, `src/components/dashboard/LearningMetadataFields.tsx`, `content/learning/catalog.json` (all 140 verified blob hashes), `content/learning/source-authorities.json`, `content/learning/robotics-curriculum-plan.json`, and unapproved `content/learning/release-candidate.json` digests were updated together while preserving all three batch scopes and `requiresHumanReview: true`.
