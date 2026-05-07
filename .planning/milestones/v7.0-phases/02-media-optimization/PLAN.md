---
phase: 02
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [
  "scripts/optimize-images.mjs",
  "src/components/LazyImage.tsx",
  "package.json"
]
autonomous: true
requirements: ["IMG-01", "IMG-02", "IMG-03"]
user_setup: []

must_haves:
  truths:
    - "All images in public/ have WebP counterparts"
    - "Responsive image variants exist (640w, 1024w, 1920w)"
    - "LazyImage supports srcset for responsive loading"
    - "Fonts use font-display: swap (no FOIT)"
    - "League Spartan font is preloaded in index.html"
  artifacts:
    - path: "scripts/optimize-images.mjs"
      provides: "Build-time WebP conversion and responsive variant generation"
      exports: ["optimizeImages"]
    - path: "src/components/LazyImage.tsx"
      provides: "Extended with srcset prop for responsive images"
      contains: "srcset, sizes props"
    - path: "index.html"
      provides: "Font preload for League Spartan"
      contains: "link rel=\"preload\" as=\"font\""
  key_links:
    - from: "package.json scripts.prebuild"
      to: "scripts/optimize-images.mjs"
      via: "npm run optimize-images"
      pattern: "prebuild.*optimize-images"
    - from: "src/components/LazyImage.tsx"
      to: "public/**/*.webp"
      via: "picture element with source type=\"image/webp\""
      pattern: "source.*type=\"image/webp\""
---

<objective>
Reduce image payload by 30%+ through WebP conversion, responsive images, and improved font loading.

Purpose: Media optimization is high ROI for performance — WebP + responsive images reduce payload 30%+, faster font loading eliminates FOIT (Flash of Invisible Text).
Output: Build pipeline that auto-converts images to WebP, generates responsive variants, extended LazyImage with srcset support, preloaded fonts.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

# Existing contracts from src/components/LazyImage.tsx
```typescript
interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
}
```

# Existing patterns
- ARES brand colors: marble, obsidian, ares-red, ares-gold, ares-bronze
- Motion animations: duration 0.5-0.8s, easeOut
- Skeleton: backdrop-blur-xl, animate-pulse
- Fonts: Inter (body), League Spartan (headings), Orbitron (tutorial)
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create build-time image optimization script</name>
  <files>scripts/optimize-images.mjs, package.json</files>
  <behavior>
    - Script finds all PNG/JPG/JPEG files in public/
    - Generates WebP version at 85% quality alongside original
    - Generates 3 responsive variants: 640w, 1024w, 1920w (all WebP)
    - Preserves original images for fallback
    - Logs conversion summary (files processed, size savings)
  </behavior>
  <action>
Create scripts/optimize-images.mjs:

1. Import sharp and glob (already in package.json as devDependencies)
2. Glob all {png,jpg,jpeg} files in public/
3. For each image:
   - Generate WebP at 85% quality: sharp(image).webp({ quality: 85 })
   - Generate 3 responsive sizes: 640w, 1024w, 1920w
   - Name pattern: original-640w.webp, original-1024w.webp, original-1920w.webp
4. Keep originals untouched (fallback support)
5. Log: "{count} images converted, saved {total_kb}KB"

Ensure package.json has:
```json
"scripts": {
  "optimize-images": "node scripts/optimize-images.mjs",
  "prebuild": "npm run optimize-images"
}
```

Per CONTEXT.md decision: Build-time conversion (not runtime), 85% quality, convert all images, keep originals.
  </action>
  <verify>
    <automated>node scripts/optimize-images.mjs && ls public/*.webp | grep -c ".webp" | grep -v "^0$"</automated>
  </verify>
  <done>Script runs without errors, WebP files generated alongside originals, responsive variants created with -{size}w.webp naming</done>
</task>

<task type="auto">
  <name>Task 2: Extend LazyImage with srcset support for responsive images</name>
  <files>src/components/LazyImage.tsx</files>
  <action>
Extend LazyImage component to support responsive images via optional srcset/sizes props:

1. Add optional props to interface:
```typescript
interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  srcset?: string;  // NEW: comma-separated srcset values
  sizes?: string;   // NEW: media query sizes
}
```

2. Update picture element to use srcset when provided:
```typescript
<picture className={`w-full h-full absolute inset-0 z-10 ${imgClassName}`}>
  {!isError && (
    <source
      srcSet={srcset ?? src.replace(/\.(png|jpg|jpeg)$/i, '.webp')}
      type="image/webp"
      sizes={sizes}
    />
  )}
  <motion.img
    src={isError ? fallbackSrc : src}
    srcSet={srcset}  // Pass through to img for fallback
    sizes={sizes}
    alt={alt}
    // ... existing props unchanged
  />
</picture>
```

3. Maintain existing behavior (fade-in, blur, skeleton, fallback)
4. Backward compatible: srcset/sizes optional, existing usage unchanged

Per CONTEXT.md decision: Extend LazyImage (not new component), mobile-first breakpoints 640w/1024w/1920w, keep existing animations.
  </action>
  <verify>
    <automated>grep -n "srcset\|sizes" src/components/LazyImage.tsx | grep -v "^#" | wc -l | grep -v "^0$"</automated>
  </verify>
  <done>LazyImage accepts optional srcset/sizes props, picture element uses srcset, existing fade-in/skeleton preserved</done>
</task>

<task type="auto">
  <name>Task 3: Add font-display: swap and preload League Spartan font</name>
  <files>src/index.css, index.html</files>
  <action>
Update font loading strategy per CONTEXT.md decisions:

1. src/index.css - Add font-display: swap to @font-face:
```css
@font-face {
  font-family: 'Inter';
  src: local('Inter'), local('Inter-Regular');
  font-display: swap;  /* ADD THIS */
  /* rest unchanged */
}

@font-face {
  font-family: 'League Spartan';
  src: local('League Spartan'), local('LeagueSpartan-Regular');
  font-display: swap;  /* ADD THIS */
  font-weight: 100..900;
  /* rest unchanged */
}
```
Note: Fonts are loaded via Google Fonts CSS, so font-display is controlled by their CSS. The Google Fonts URL already includes display=swap parameter:
https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=League+Spartan:wght@100..900&display=swap

2. index.html - Add preload for League Spartan (headings font):
```html
<link rel="preload" href="https://fonts.gstatic.com/s/leaguespartan/v15/...-latin.woff2" as="font" type="font/woff2" crossorigin />
```
Use the specific woff2 URL from Google Fonts for League Spartan (add after line 13, before the Google Fonts stylesheet link).

Per CONTEXT.md decision: font-display: swap for all fonts, preload League Spartan only, woff2 format, use <link rel="preload">.
  </action>
  <verify>
    <automated>grep -n "preload.*font" index.html | grep -v "^#" | wc -l | grep -v "^0$"</automated>
  </verify>
  <done>League Spartan preloaded via link tag, Google Fonts URL has display=swap, no FOIT observed on load</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| build->filesystem | Image optimization script writes to public/ |
| user->img srcset | User-controlled srcset values could point to external resources |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-01 | S | srcset injection | mitigate | srcset prop is typed string; component only uses it in img/picture elements (browser enforces URL validation). No arbitrary HTML injection. |
| T-02-02 | D | Image conversion DoS | accept | Build-time script runs in CI/build, not on user requests. No DoS vector. |
| T-02-03 | I | Path traversal in glob | mitigate | Use glob library with pattern restricted to public/**/*.{png,jpg,jpeg}. Sharp validates file types. |
| T-02-04 | T | Font preload exposure | accept | Preloading Google Fonts URL is public CDN. No sensitive data. |
| T-02-05 | E | Local file inclusion | accept | Images already in public/ are static assets meant to be served. |
| T-02-06 | R | Original file deletion | mitigate | Script does NOT delete originals; creates WebP alongside. Fallback preserved. |
</threat_model>

<verification>
1. Build script runs: npm run optimize-images completes without errors
2. WebP files exist: ls public/*.webp shows converted images
3. Responsive variants exist: ls public/*-640w.webp public/*-1024w.webp public/*-1920w.webp
4. LazyImage types check: npx tsc --noEmit on src/components/LazyImage.tsx
5. No regressions: npm test passes (all existing tests still passing)
6. Visual check: Open dev server, confirm images load with fade-in animation
7. Lighthouse: Run Lighthouse audit, verify "Efficiently encode images" score improved
</verification>

<success_criteria>
1. All images in public/ have WebP counterparts (build-generated)
2. Responsive variants (640w, 1024w, 1920w) exist for hero images
3. LazyImage supports srcset/sizes props (backward compatible)
4. Fonts use font-display: swap (no FOIT, text visible immediately)
5. League Spartan preloaded via <link> tag
6. Lighthouse "Efficiently encode images" score: 90+
7. Image payload reduced by 30%+ (compare before/after build output)
</success_criteria>

<output>
After completion, create `.planning/milestones/v7.0-phases/02-media-optimization/02-01-SUMMARY.md`
</output>
