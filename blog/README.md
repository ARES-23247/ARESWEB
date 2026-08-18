# Blog post package — "The Program Is a Document"

Drafted 2026-08-17 against the current `main` of all four repos (`ARESLib-Kotlin`, `ARES-FTC`, `ARES-FRC`, `ARES-Analytics`). Facts were verified in-source at draft time — re-check the numbers before publishing if the repos have moved. Audience: interested team members and mentors — technical terms are used but explained in a clause; deep implementation names are avoided.

## Contents

| File | Purpose |
|---|---|
| `the-program-is-a-document.md` | The post, Markdown with six ```mermaid diagram fences (4 flowcharts, 1 store-loop flowchart, 1 `stateDiagram-v2` subsystem lifecycle). Metadata (slug/title/snippet) is in the leading HTML comment. |
| `check-mermaid.js` | Node script that runs all six diagrams through the real mermaid parser (`npm i mermaid jsdom` in a scratch dir, then `node check-mermaid.js`). All six passed with mermaid 11. |
| `assets/*.svg` + `assets/*.png` | Original hand-built diagrams from the first (deep-technical) draft. Not referenced by the current post — kept as fallback and as thumbnail/social assets. |

## Publishing to ARESWEB

Blog posts live in the Firestore `posts` collection, authored through the dashboard's blog editor. **Before publishing, confirm mermaid rendering works in the live editor/blog page** — see the caveat below.

1. Verify mermaid fences render in the editor preview (type `/mermaid` or paste a ``` ```mermaid ``` fence). If they show as plain code blocks, restore renderer support first (caveat below) or swap the fences back to the SVG images in `assets/`.
2. Create the post using the metadata in the comment block: slug `the-program-is-a-document`, title, date `2026-08-17`, snippet; upload `assets/architecture-four-repos.svg` (or its PNG) as the thumbnail.
3. Paste the Markdown body. The four mermaid fences should render as diagrams; the one small JSON snippet stays a code block (intended).

### ⚠ Mermaid support caveat (verified 2026-08-17)

Mermaid support in the shared editor **existed and was removed**:

- Added ~2026-04: `1530163c` (Mermaid slash command for Blog/Docs/Event editors, `tiptap-extension-mermaid`), `67c1ba18` (crash fix + config sync), `cf30ad87` (mermaid 11.15.0 CVE bump).
- Deleted 2026-06-18 in `75d46d8b` ("transition codebase to root-level Firebase setup and delete legacy Cloudflare code").
- Today there are **no mermaid references** in `ARESWEB` HEAD, `master`, or the working tree (`git grep -i mermaid` is empty; no mermaid package in `package.json` or `node_modules`).

So the current post's fences follow the standard ``` ```mermaid ``` convention and will render once support is restored — the April commits show exactly how (Tiptap `MermaidBlock` extension + slash command + renderer wiring), and mermaid 11.15.0 is the last audited version.

## Accuracy notes (per workspace AGENTS.md §9)

- The post deliberately qualifies "zero-code": plans and standard-device subsystems are data-authored; vendor hardware, novel control strategies, and new menu actions are still hand-written Kotlin. Do not soften this in edits.
- Claims verified in the current tree: ~132,900 LOC shared library (921 Kotlin files, 10 Gradle modules); FTC TeamCode 46 files / 7,830 LOC; FRC 65 files / 9,731 LOC; Analytics ~102,000 LOC, 22 screens; 39 catalog actions; 10 step kinds; 12 CI SysId routines; 30 s autonomous with a 29.5 s internal deadline; robot serves its own logs and the laptop owns all cloud sync.
- Subsystems nuance (verified 2026-08-17): `GENERATED_STARTER` (the default) emits a complete stack — state, IO contract, PID/anti-windup controller with feedforward, FTC/FRC hardware adapter, optional mock + contract tests, registry action wiring — so standard-device subsystems need no hand Kotlin. `HAND_AUTHORED` is an opt-out for vendor hardware / teaching examples; both subsystems currently in the FTC repo use it, so the generated path is proven by tests (`SubsystemKotlinGeneratorTest`, `GeneratedSubsystemSimulatorParityTest`, `GeneratedSubsystemInstallationTest`), not by a shipped season subsystem. Generator: `ARESLib-Kotlin/core/.../codegen/SubsystemKotlinGenerator.kt`.
- Teleop/controller editor (verified 2026-08-17): `.arescontrols` documents are schema v2 (`ARESLib-Kotlin/core/.../controls/ControlSchemeDocument.kt`) — controller assignments (slot + DS device port), sources (BUTTON/CHORD/AXIS_THRESHOLD/AXIS_VALUE/AXIS_ZONE), 9 event types, targets (ACTION/ROUTINE/CANCEL_ROUTINE with invocation policies), axis transforms, timing/hysteresis, suppression. Authored in the TeleOp Controls screen (`viewmodel/controls/ControlsEditorViewModel.kt` — visual layout via `ControllerAnchorDocument`, live gamepad preview via `GamepadState`, saved via `ControlSchemeProjectRepository`). CI tests: ControlSchemeValidationTest, ControllerProfileDocumentTest, DigitalBindingTest, AnalogBindingTest, ButtonSuppressionTest. Honest status in the post: no `.arescontrols` is checked in; FTC `GeneratedAresProject.createControllerRuntimes` currently `require`s `schemeId == null` ("This project has no generated control scheme"), so the season's teleop bindings are still programmatic Kotlin.
- Version history: deep-technical draft → novice draft → current intermediate draft (this one). The underlying facts above are what must survive any further re-leveling; subsystem generation, the teleop controller editor, the state-machine architecture, and a block-coding comparison each have their own sections.
- Known stale claims to avoid reintroducing: a `VFHPlanner` class (reactive avoidance is `DetourGenerator`), an FRC `PathLoader.kt` (routines are compiled in; loading is `DynamicPathLoader` in the lib), "16 screens" (it is 22), and the deleted FTC console `SubsystemGenerator.kt` (the Analytics Subsystem Builder screen is the current tool).
