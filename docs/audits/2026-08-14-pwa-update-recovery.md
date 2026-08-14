# PWA Update Recovery Audit

- Date: August 14, 2026
- Audited baseline: `aa6dad6edf1abf96482db9cbfe42bc83a2b7530f`
- Branch: `codex/pwa-update-recovery`
- Scope: production service-worker update prompt and recovery behavior
- Production mutation: none in this branch

## Confirmed finding

| ID     | Severity | Confidence | Evidence                                                                                                                                                                                                                                                                  | Impact                                                                                                                                | Remediation                                                                                                                                                                                                                                                                                                                    | Acceptance evidence                                                                                                                                                                                                                                                                          |
| ------ | -------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PWA-01 | Medium   | High       | An authenticated production browser displayed “Portal update ready.” After selecting “Reload and update,” the notice remained indefinitely on disabled “Updating…” state. The component had no activation deadline, and its close button did not clear `updateAvailable`. | A client could remain on the previous application shell with no usable retry control, and the visible dismiss action was ineffective. | `src/components/PwaUpdatePrompt.tsx:9-200` now waits directly for service-worker controller takeover, reloads once, and returns to a retryable error state after eight seconds. “Later” and dismiss are disabled only during activation; dismiss now clears the update notice at `src/components/PwaUpdatePrompt.tsx:276-283`. | `src/test/PwaUpdatePrompt.test.tsx:27-135` covers controller takeover, duplicate reload suppression, timeout recovery, dismissal, deferral, activation rejection, update-check failure, and online re-registration. Full coverage measures the component at 97.36% lines and 100% functions. |

## Residual behavior

The timeout does not claim that the worker failed permanently. It preserves
online browsing, explains that activation timed out, and re-enables the update
button so the user can retry or reload. The generated worker remains configured
for prompt-based activation; this change does not enable automatic takeover or
discard unsaved form data.

The complete supported-runtime gate and protected deployment workflow remain
required before this remediation is considered released.

## Production follow-up

The remediation was merged and deployed through protected CI in pull request
52. During the next release validation, an older background dashboard tab kept
its already-rendered prompt while a fresh active tab installed the waiting
worker successfully. Reloading the older tab then cleared the prompt with no
activation or registration error. A fresh active tab therefore did not
reproduce the original indefinite disabled state; the observed residual was a
stale background-tab view, not evidence of another failed worker activation.
