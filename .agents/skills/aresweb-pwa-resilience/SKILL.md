---
name: aresweb-pwa-resilience
description: Enforces self-healing PWA deployment patterns for ARESWEB, ensuring that stale service worker caches never permanently break the user experience after a new Firebase Hosting deployment.
---

# ARES 23247 PWA Cache Resilience Protocol

ARESWEB uses Vite's PWA plugin (`vite-plugin-pwa` in `generateSW` mode) to precache all static assets for offline capability. This creates a critical deployment hazard: when new builds produce different chunk hashes, users with stale service workers will attempt to load old chunk filenames that no longer exist on the CDN, causing `TypeError: Failed to fetch dynamically imported module` crashes.

## 1. The Stale Chunk Problem

### Root Cause
Vite produces content-hashed chunks (e.g., `DocsEditor-C_2sAjjQ.js`). Each build generates new hashes. The PWA service worker caches the HTML entry point which contains `<script>` tags referencing specific chunk hashes. After a new deployment:

1. Firebase Hosting serves new chunks with new hashes.
2. The old service worker serves cached HTML referencing old hashes.
3. The browser tries to load `DocsEditor-C_2sAjjQ.js` (old) from the CDN which only has `DocsEditor-DUchFPcu.js` (new).
4. The dynamic `import()` fails with a `TypeError`.
5. React's ErrorBoundary catches it and shows the "Telemetry Fault Detected" screen.

---

## 2. The Self-Healing Solution

The `ErrorBoundary` component (`src/components/ErrorBoundary.tsx`) implements automatic recovery in `getDerivedStateFromError`:

### Detection
```typescript
const isStaleChunk =
  errorStr.includes("Failed to fetch dynamically imported module") ||
  errorStr.includes("Importing a module script failed") ||
  errorStr.includes("error loading dynamically imported module");
```

### Recovery
1. **Throttle check**: Uses `sessionStorage` with key `ares-stale-chunk-reload` and a 60-second cooldown to prevent infinite reload loops if the real issue is a broken build (not a stale cache).
2. **Service worker cleanup**: Unregisters all service worker registrations so the next page load fetches fresh HTML from the network.
3. **Force reload**: Calls `window.location.reload()` to load the new HTML with correct chunk references.

---

## 3. Deployment Best Practices

To deploy frontend updates:
```bash
npm run build
firebase deploy --only hosting
```

Always verify that lazy-loaded routes still resolve correctly in staging or preview environments after a deployment.

---

## 4. Caching Strategy (firebase.json)

Vite compiled assets are cached based on rules defined in `firebase.json`:
- **HTML & Service Workers**: Served with `Cache-Control: no-cache, no-store, must-revalidate` to ensure immediate updates are detected.
- **Assets (`/assets/**`)**: Content-hashed JS/CSS and media chunks are cached with `Cache-Control: public, max-age=31536000, immutable` for peak loading performance.
