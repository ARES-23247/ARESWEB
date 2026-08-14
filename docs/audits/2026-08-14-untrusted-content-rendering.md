# Untrusted Content Rendering Review

- Date: 2026-08-14
- Baseline: `e272b46dc72110eb946c960eb6331aa8b538db12` (`origin/master`)
- Branch: `codex/workflow-truthfulness`
- Scope: public Tiptap and Markdown links, images, headings, and malformed attributes
- Production data mutation: none

## Finding

### CONTENT-01 — Rich-document URLs bypassed the explicit client validation boundary

- Severity: medium
- Confidence: high
- Evidence: `src/components/TiptapRenderer.tsx` previously assigned
  `mark.attrs.href` and `node.attrs.src` directly to DOM link and image
  attributes. The renderer is used for Firestore-backed Academy and event
  content. Heading levels and several text attributes were also trusted as
  correctly typed at runtime.
- Impact: browser, React, sanitizer, and CSP defenses reduced exploitability,
  but the component itself did not fail closed. Malformed records could also
  crash or produce invalid heading semantics on a public page.

## Remediation

- Added one environment-independent URL boundary for both Markdown and Tiptap
  content. Links allow bounded relative paths plus `http`, `https`, `mailto`,
  and `tel`; executable schemes, protocol-relative ambiguity, credentials,
  control characters, backslashes, malformed URLs, and oversized values are
  rejected.
- Images allow bounded relative paths or credential-free HTTPS only. Rejected
  images render a neutral unavailable notice rather than an active resource.
- Safe images now use lazy loading and asynchronous decoding.
- Tiptap heading levels are converted to finite integers and clamped to
  `h1`–`h6`.
- Text, captions, simulation identifiers, and mark objects are checked at the
  runtime boundary so malformed JSON cannot render objects or invoke string
  methods on unexpected values.

## Acceptance tests

- Executable, data, credentialed, protocol-relative, malformed, control-
  character, backslash, and oversized URLs remain inactive.
- Safe relative, HTTPS, mail, telephone, and legacy HTTP links retain their
  intended semantics.
- Unsafe Tiptap links render as ordinary text; unsafe Tiptap and Markdown
  images do not create image elements.
- Oversized and invalid heading levels render as valid `h6` and `h1` elements,
  respectively.
- Malformed rich attributes do not throw or display `[object Object]`.

## Verification

- Supported tools: Node 22.22.2, pnpm 11.21.0, and Java 21.0.12.
- Frozen install and shared-agent validation: passed; all six workspace skills
  and the Gemini, Antigravity, and Copilot discovery surfaces were validated.
- Root and Functions ESLint: passed with zero warnings; root and Functions
  TypeScript builds passed.
- Focused rendering regression suite: 3 files / 17 tests passed.
- Frontend coverage: 89 files / 509 tests passed; the new URL utility reports
  100% lines and 100% functions and is protected by explicit 85%/100% ratchets.
- Functions coverage: 45 files / 569 tests passed at 94.75% lines and 98.31%
  functions.
- Firestore and Storage rules: 20/20 emulator tests passed.
- Production build: 4,161 modules, 22 prerendered public shells, and 17 PWA
  precache entries totaling 874.90 KiB.
- Bundle budgets: all six enforced initial, route, lazy, and editor budgets
  passed.
- Playwright: 52/52 desktop and mobile flows passed across Chromium, Firefox,
  and WebKit.
- Production dependency audit: no known high-severity vulnerabilities.
- Diff check: clean apart from Windows line-ending notices.

Protected review, deployment, and read-only live validation remain release
steps. This is bounded defense-in-depth evidence, not a claim that all stored
content or the website is completely secure.
