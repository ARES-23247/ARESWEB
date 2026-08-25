# ARES learning content sources

This directory contains reviewable source drafts for ARES Academy and ARESLib documentation. The website does not load these files at runtime. Published content continues to come from approved Firestore records through the public DTO API.

`catalog.json` is the canonical import manifest. Every entry is a draft until a human reviewer approves it in the protected editorial workflow. Source links are pinned to a released tag or an exact clean repository commit and include the corresponding Git blob hash.

Run `pnpm run content:validate` to validate metadata, declared commit pinning, and Markdown files without network access. Run `pnpm run content:verify` to download the exact public source files and independently recompute their Git blob hashes; CI uses this stronger check. Run `pnpm run content:prepare` to create a Firestore-ready JSON artifact under `build/`; that command does not connect to Firebase or change production data.

Publishing requires a separate, explicitly approved production migration. Simulation exercises do not establish that a physical robot is wired, calibrated, safe, or ready to enable.
