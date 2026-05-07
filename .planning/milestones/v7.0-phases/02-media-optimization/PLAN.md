---
gsd_plan_version: 1.0
phase: 02
phase_name: Media Optimization
milestone: v7.0
status: planned
parent_plan: null
---

# Phase 02: Media Optimization

## Goal

Reduce image payload by 30%+ through WebP conversion, responsive images, and improved font loading.

## Context

Current state:
- Images are PNG/JPG format (larger than WebP)
- No responsive image sources (single size for all screens)
- Fonts loaded without `font-display: swap`
- No image optimization in build pipeline

## Requirements

### IMG-01: WebP Conversion
- All site images support WebP with PNG/JPG fallback
- Build pipeline automatically converts to WebP
- Existing LazyImage component updated to handle WebP

### IMG-02: Responsive Images
- Hero images have multiple sizes for different viewports
- Use `srcset` for optimal image selection
- LazyImage component supports responsive loading

### IMG-03: Font Loading Strategy
- All fonts use `font-display: swap`
- Critical fonts preloaded
- FOIT (Flash of Invisible Text) eliminated

## Tasks

### Plan 02-01: WebP Conversion Pipeline

**Files to create/modify**:
- `scripts/optimize-images.mjs` (new)
- `vite.config.ts` - add image optimization plugin
- `src/components/LazyImage.tsx` - WebP support
- `package.json` - add sharp or vite-imagetools

**Implementation options**:

**Option A: Build-time conversion (recommended)**
```bash
# Add to package.json
"scripts": {
  "optimize-images": "node scripts/optimize-images.mjs",
  "prebuild": "npm run optimize-images"
}
```

```javascript
// scripts/optimize-images.mjs
import sharp from 'sharp';
import { glob } from 'glob';

const images = await glob('public/**/*.{png,jpg,jpeg}');

for (const image of images) {
  await sharp(image)
    .webp({ quality: 85 })
    .toFile(image.replace(/\.(png|jpg|jpeg)$/, '.webp'));
}
```

**Option B: Runtime conversion with Vite plugin**
```typescript
// vite.config.ts
import { imagetools } from 'vite-imagetools';

plugins: [
  imagetools({
    include: ['**/*.{png,jpg,jpeg}'],
    presets: {
      default: {
        formats: ['webp', 'original'],
        preload: false,
        enforce: 'pre'
      }
    }
  })
]
```

**Update LazyImage component**:
```typescript
interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  sizes?: string; // For responsive images
}

// Add picture element for WebP fallback
<picture>
  <source srcSet={`${src}.webp`} type="image/webp" />
  <img src={src} alt={alt} loading="lazy" />
</picture>
```

---

### Plan 02-02: Responsive Images Implementation

**Target images**:
- `public/ares_hero.png` - Hero image (needs: 192w, 512w, 1024w, 1920w)
- Blog post thumbnails
- Gallery images
- Event banners

**Implementation**:
```typescript
// src/components/ResponsiveImage.tsx (new)
interface ResponsiveImageProps {
  src: string;
  alt: string;
  sizes?: {
    mobile: string;
    tablet: string;
    desktop: string;
  };
}

// Generate srcset from image variants
const srcset = [
  `${src}-320w.webp 320w`,
  `${src}-640w.webp 640w`,
  `${src}-1024w.webp 1024w`,
  `${src}-1920w.webp 1920w`,
].join(', ');
```

**Script to generate variants**:
```javascript
// scripts/generate-image-variants.mjs
const sizes = [320, 640, 1024, 1920];

for (const image of images) {
  for (const size of sizes) {
    await sharp(image)
      .resize(size)
      .webp({ quality: 85 })
      .toFile(`${image}-${size}w.webp`);
  }
}
```

---

### Plan 02-03: Font Loading Strategy

**Files to modify**:
- `src/index.css` or global styles
- `index.html` - add preload links
- Font files (if self-hosted)

**Implementation**:

**1. Add font-display: swap**
```css
/* src/index.css */
@font-face {
  font-family: 'League Spartan';
  src: url('/fonts/league-spartan.woff2') format('woff2');
  font-weight: 400 700;
  font-display: swap; /* Add this */
}

@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter.woff2') format('woff2');
  font-weight: 400 600;
  font-display: swap; /* Add this */
}
```

**2. Preload critical fonts**
```html
<!-- index.html -->
<link rel="preload" href="/fonts/league-spartan.woff2" as="font" type="font/woff2" crossorigin />
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin />
```

**3. Consider font subsetting**
```javascript
// Subset fonts to only used characters
// League Spartan: only need A-Z, a-z, 0-9, basic punctuation
// Can reduce font size by 40-60%
```

---

## Success Criteria

1. All images available in WebP format
2. Responsive images use srcset with multiple sizes
3. LCP (Largest Contentful Paint) < 1s on 3G
4. No FOIT - text visible immediately with fallback font
5. Lighthouse "Efficiently encode images" score: 100

## Definition of Done

- [ ] Image optimization pipeline created
- [ ] All public images converted to WebP
- [ ] LazyImage component updated with WebP support
- [ ] ResponsiveImage component created
- [ ] Critical images have responsive variants
- [ ] Fonts use `font-display: swap`
- [ ] Critical fonts preloaded
- [ ] Build script runs image optimization
- [ ] Lighthouse score recorded (before/after)

## Estimated Effort

- Plan 02-01: 4 hours
- Plan 02-02: 3 hours
- Plan 02-03: 2 hours
- Testing and validation: 2 hours
- **Total: 11 hours**
