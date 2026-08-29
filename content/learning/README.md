# ARES learning content sources

This directory contains reviewable source drafts for ARES Academy and ARESLib documentation. The website does not load these files at runtime. Published content continues to come from approved Firestore records through the public DTO API.

`catalog.json` is the canonical import manifest. Every entry is a draft until a human reviewer approves it in the protected editorial workflow. `source-authorities.json` separately records the current and reviewed historical source identities. Source links are pinned to an exact clean repository commit and include the corresponding Git blob hash. `published-refresh-plan.json` lists existing public lessons eligible for a reviewed in-place refresh; its old-content hashes prevent overwriting a lesson that changed after the plan was prepared.

`robotics-curriculum-plan.json` is the reviewable expansion contract. It defines seven robotics tracks, a 48-lesson minimum, authentic-media requirements, and proposed interactive upgrades for both new and existing tutorials. An interaction name is a proposal, not permission to expose an arbitrary simulation component. Each component still needs a learning purpose, a fidelity statement, keyboard and touch operation, narrow-screen behavior, screen-reader output, reduced-motion behavior, deterministic reset, automated tests, and manual accessibility review before it can appear in a staged lesson.

`curriculum-source-requests.json` tracks every known gap that cannot be filled truthfully from current source. Requests distinguish authentic media, official references, team-process review, and physical evidence. A request stays `requested` until the relevant evidence is supplied and reviewed; the validator rejects silent removal or unsupported claims of completion.

Run `pnpm run content:validate` to validate metadata, approved historical/current commit identities, unique path order, refresh preconditions, and Markdown files without network access. It also enforces the middle-school writing contract: at least 200 prose words, an estimated reading grade no higher than 8.9, bounded sentence length, clear sections, and at least one Mermaid diagram with a concise `%% aria:` summary. `pnpm run content:readability` prints the per-lesson measurements for editorial review. These estimates are a warning system, not a substitute for a student read-through.

Run `pnpm run content:verify` to download the exact public source files, independently recompute their Git blob hashes, and verify that the declared ARES, Studio, and starter version line still matches `ARES-Robotics/main`; CI uses this stronger check. Run `pnpm run content:prepare` to create a Firestore-ready JSON artifact under `build/`; that command does not connect to Firebase or change production data.

Publishing requires a separate, explicitly approved production migration. Students may verify robot functionality by following the team's safety procedure. Simulation exercises do not establish that a physical robot is wired, calibrated, safe, or ready to enable. Mentor approval is reserved for publishing website content.

The human review sequence, direct protected-preview links, exact replacement
files, cross-link proposals, and approval checklist are collected in
[`docs/ACADEMY_HUMAN_REVIEW.md`](../../docs/ACADEMY_HUMAN_REVIEW.md). Reviewing
does not itself publish anything.
