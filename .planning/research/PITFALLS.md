# Research: Pitfalls

## Performance & Rendering
- **Layout Shifts**: Masonry layouts without pre-calculated image heights cause severe layout shifts as images load. **Prevention**: Store `width` and `height` in the media table during Google Photo import to render placeholder bounds.
- **Marquee Tearing**: JavaScript-driven scrolling can cause jank. **Prevention**: Use pure CSS keyframes on the GPU (`translate3d`) with duplicated child nodes for seamless wrapping.

## Component Reusability
- Tying the Album object too closely to Google Photos. **Prevention**: The Album should only link to local ARESWEB `media` records. The Google Photo Picker remains just an ingestion tool that creates `media` records, keeping the domain boundary clean.
