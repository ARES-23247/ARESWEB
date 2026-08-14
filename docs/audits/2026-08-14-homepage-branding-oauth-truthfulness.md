# Homepage Branding & OAuth Truthfulness Audit

- Date: August 14, 2026
- Audited baseline: `6962d78c4681490e57046d64cea7449b2cd3dc87` (`origin/master`)
- Branch: `codex/continuous-audit-cycle-2`
- Scope: Homepage title, OpenGraph metadata, prerendered static crawl shells, Google OAuth app verification disclosure, and team branding hierarchy
- Production mutation: none

---

## Confirmed Findings and Remediation

### HBO-01 — Homepage Title and Metadata Displaced Team Identity with Desktop Project Sub-brand

- **Severity**: medium
- **Confidence**: high
- **Evidence**: `index.html`, `scripts/prerender-static-routes.mjs`, and `src/app/page.tsx` previously used `<title>ARES Analytics</title>` as the root website title instead of identifying the organization and FIRST® Tech Challenge team.
- **Impact**: Public search engines, social media previews, and visitors saw the root homepage represented as a single software tool rather than the Appalachian Robotics & Engineering Society (ARES #23247).
- **Remediation**:
  - Updated `index.html` title to `ARES 23247 | Morgantown Robotics Team` and clarified the root semantic heading to `ARES 23247 | Appalachian Robotics & Engineering Society`.
  - Updated `scripts/prerender-static-routes.mjs` so static route prerendering outputs the team title for the root shell.
  - Retained a dedicated, prominently linked section for `ARES Analytics` containing local-first disclosures, privacy policy link, and terms of service link for OAuth verification compatibility.
- **Acceptance test**: `src/test/hostingConfig.test.ts` asserts on raw and prerendered titles, `src/test/HomeBranding.test.tsx` tests React UI hierarchy, and `e2e/navigation.spec.ts` verifies live DOM branding.
- **Status**: fixed.

### HBO-02 — Hero Background Radial Masking Improved Contrast for Text Legibility

- **Severity**: low
- **Confidence**: high
- **Evidence**: The watermark favicon in the hero section lacked a radial fade-out gradient mask, which could create contrast issues on small viewports when text wraps over the icon edges.
- **Impact**: On certain mobile screen aspect ratios, high-density SVG strokes could compete with sub-headings.
- **Remediation**: Applied radial gradient mask and refined linear dark overlays (`via-obsidian/95 to-obsidian/35`) across the hero backdrop.
- **Acceptance test**: `e2e/navigation.spec.ts` asserts radial mask styles on `hero-watermark`.
- **Status**: fixed.

---

## Verification Evidence

- `pnpm vitest run src/test/HomeBranding.test.tsx src/test/hostingConfig.test.ts`: 2/2 test files passed.
- `pnpm run test:e2e`: 56/56 cross-browser tests passed.
- Scoped ESLint & TypeScript: 0 warnings, 0 errors.
