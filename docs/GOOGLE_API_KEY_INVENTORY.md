# Google API Key Inventory and Least-Privilege Plan

Audited 2026-08-26 for project `aresfirst-portal`. This document records key
purpose and restriction posture, never key values. Firebase browser API keys are
public project identifiers; they are not authentication credentials. Firebase
rules, App Check, OAuth, and server authorization remain the security boundary.

| Console label | Intended caller | Observed application restriction | Observed API restriction | Decision |
| --- | --- | --- | --- | --- |
| ARES Portal Google Picker | Browser on approved ARES origins | Canonical/Firebase Hosting origins and approved localhost development origins | Google Picker API | Keep. Re-test Picker, Drive, and Photos after any origin change. |
| Youtube | Cloud Functions server runtime | None; the managed runtime does not have a stable dedicated egress address | YouTube Data API only | Keep API restriction. Do not copy it into browser code or add broad Google API access. |
| Firebase browser key | Firebase web SDK | Canonical/Firebase Hosting and approved localhost origins | Broad Firebase/Google API target list | Narrow incrementally only after the login, App Check, Firestore, Storage gateway, and OAuth regression matrix passes. |
| ares-desktop-key | Historical desktop/identity caller | None | Identity Toolkit and Secure Token APIs | Identify the current desktop owner. Delete if unused; otherwise record the executable/distribution boundary and retain only required identity APIs. |

## Safe review procedure

1. List key metadata and restrictions in Google Cloud Console or with
   `gcloud services api-keys list --project aresfirst-portal`. Never paste
   `keyString` output into a terminal transcript, issue, chat, or repository.
2. Search active frontend configuration, Functions secret bindings, desktop
   repositories, CI variables, and Google API usage before declaring a key
   unused. A filename search alone is insufficient.
3. Change one key at a time. Use a preview deployment and exercise canonical,
   Firebase Hosting, mobile, incognito, and approved localhost flows.
4. For the Firebase browser key, verify sign-in popup and redirect, Auth App
   Check, Firestore reads, the same-origin media gateway, reCAPTCHA Enterprise,
   Picker, Photos, Drive, and YouTube. Restore the prior restriction if any
   legitimate flow fails.
5. Disable an apparently unused key before deletion and observe for at least
   seven days. Delete it only after logs and owner review show no legitimate use.

## Acceptance record

When restrictions are changed, append the date, operator, key label, old and new
restriction categories (not values), preview URL, tested browsers/flows, and
rollback outcome. Production key changes require explicit owner approval and are
not performed by repository CI.

