# Phase 46: Media Optimization - Context

**Status:** Ready for planning

<domain>
## Phase Boundary

Optimize media assets to improve page load times:
1. Convert images to WebP
2. Implement responsive images (srcset)
3. Add font-display: swap for web fonts
</domain>

<decisions>
## Implementation Decisions

### WebP Conversion
- Use a Vite plugin (e.g., `vite-plugin-image-optimizer` or `vite-plugin-webp-and-path`) or a simple pre-build script (e.g., `sharp`) to convert PNG/JPEG to WebP during the build or development process.
- Alternatively, write a small Node.js script using `sharp` to batch convert `public/images/` to WebP.

### Responsive Images
- Update image tags (`<img src="...">`) to use `<picture>` elements or `srcset` to serve appropriate WebP sizes (640w, 1024w, 1920w) based on viewport.

### Font Loading
- Update CSS or font links to include `font-display: swap;` ensuring text remains visible during font loading.
</decisions>
