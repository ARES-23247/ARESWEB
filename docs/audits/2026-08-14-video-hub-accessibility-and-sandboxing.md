# Video Hub Sandbox Security & Keyboard Navigation Audit

- Date: August 14, 2026
- Audited baseline: `27ea18eb53e828bd797ae502663c57085ce4d04a` (`origin/master`)
- Branch: `codex/continuous-audit-cycle-7`
- Scope: Video hub page (`src/app/videos/page.tsx`), media player iframe sandboxing, modal keyboard cycling, and automated test coverage
- Production mutation: none

---

## Confirmed Findings and Remediation

### VHB-01 — Missing Safe Iframe Sandbox on YouTube Video Player Modal

- **Severity**: medium
- **Confidence**: high
- **Evidence**: `src/app/videos/page.tsx` embedded the YouTube video player inside a Radix Dialog modal without explicit `sandbox` boundaries. Per our security requirements, third-party and user-authored media embeds must be securely isolated with least-privilege sandbox flags (`sandbox="allow-scripts allow-presentation allow-popups"`) without `allow-same-origin`.
- **Impact**: Embedded third-party iframes operated without standard sandbox isolation constraints.
- **Remediation**: Added `sandbox="allow-scripts allow-presentation allow-popups"` to the YouTube iframe player in `src/app/videos/page.tsx`.
- **Acceptance test**: `src/test/VideosPageNav.test.tsx` checks the iframe `sandbox` attribute.
- **Status**: fixed.

### VHB-02 — Lack of Keyboard Cycling and Item Position Indicator in Video Lightbox

- **Severity**: low
- **Confidence**: high
- **Evidence**: `src/app/videos/page.tsx` had compressed formatting and lacked `ArrowLeft` / `ArrowRight` keyboard listener support to cycle through videos matching the current active filter ("All media", "Videos", "Shorts"). Additionally, the dialog lacked an active video counter (`Video X of Y`).
- **Impact**: Poor keyboard accessibility when viewing multiple robot reveals, match recordings, and learning videos sequentially.
- **Remediation**: Structured `src/app/videos/page.tsx` with clean formatting, added keyboard event listeners for `ArrowLeft` / `ArrowRight` navigation, and rendered a counter badge (`${currentIndex + 1} of ${visibleVideos.length}`) in the dialog title.
- **Acceptance test**: `src/test/VideosPageNav.test.tsx` (2 tests) passes.
- **Status**: fixed.

---

## Verification Evidence

- `pnpm vitest run src/test/VideosPageNav.test.tsx`: 2/2 tests passed.
- Scoped ESLint & TypeScript: 0 warnings, 0 errors.

## Follow-up correction

The page's “Team YouTube” link used the nonexistent `@ares23247WV` handle. It now targets the team's verified existing `@ARESFTC` channel, and the focused test protects the canonical link.
