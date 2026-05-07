# Phase 02: Media Optimization - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Reduce image payload by 30%+ through WebP conversion (build-time with sharp, 85% quality), responsive images (mobile-first breakpoints: 640w, 1024w, 1920w), and improved font loading (font-display: swap, preload League Spartan headings). Existing LazyImage component will be extended with srcset support while maintaining its current API.

</domain>

<decisions>
## Implementation Decisions

### Image Optimization
- Build-time WebP conversion using sharp script — faster runtime, better quality control
- WebP quality: 85% — balance of size vs visual quality
- Convert all images in public/ directory — comprehensive optimization
- Keep original PNG/JPG alongside WebP — fallback support for older browsers

### Responsive Images
- Mobile-first breakpoints: 640w, 1024w, 1920w — covers 95%+ of devices
- Generate 3 sizes per image using sharp script
- Extend LazyImage component with srcset prop — maintains existing API
- Preload critical hero images only — above-the-fold optimization

### Font Loading
- Use font-display: swap for all fonts — eliminates FOIT, shows fallback immediately
- Preload League Spartan (headings) only — most visible font
- Use `<link rel="preload" as="font">` in index.html — browser native
- woff2 format first (smallest), then woff fallback

### Claude's Discretion
- Specific sharp script optimization flags beyond quality setting
- Exact hero image selection for preloading
- Font subset ranges (if any) for League Spartan

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/LazyImage.tsx` — has lazy loading, skeleton placeholder, fade-in animation with framer-motion
- ARES brand colors: marble, obsidian, ares-red, ares-gold, ares-bronze

### Established Patterns
- Motion animations for smooth transitions (duration: 0.5-0.8s, easeOut)
- Skeleton with backdrop-blur and animate-pulse
- Error handling with fallbackSrc

### Integration Points
- `src/pages/Gallery.tsx` — uses LazyImage
- `src/components/AdminUsers.tsx` — uses img tags (candidate for LazyImage)
- `src/index.css` — Inter (body), League Spartan (headings), Orbitron (tutorial)
- `index.html` — font loading, preload hints location

</code_context>

<specifics>
## Specific Ideas

- Extend LazyImage with srcset prop instead of creating new ResponsiveImage component
- Keep existing fade-in animation and skeleton behavior
- Use sharp for image processing (already used in other parts of codebase)

</specifics>

<deferred>
## Deferred Ideas

- AVIF format conversion — next-gen format but lower browser support
- Critical CSS extraction — defer to Phase 03 (Loading Strategy)
- Image CDN integration — out of scope for this phase

</deferred>
