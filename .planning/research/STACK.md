# Research: Stack Additions

## Dependencies
- **UI Layouts**: For the masonry layout, we can use CSS columns or CSS Grid, or rely on a lightweight library if complex packing is needed. However, modern CSS Grid (`grid-template-rows: masonry;` in some browsers, or standard multi-column layout) is often sufficient. If a library is needed, `react-photo-album` is an industry standard.
- **Animations**: For the "moving" layout (marquee or infinite scroll), CSS `@keyframes` with `transform: translate3d` provides the best hardware acceleration. We can also use `framer-motion` which is likely already in the stack for complex layout transitions.
- **Database**: Add tables to the existing Cloudflare D1 via Drizzle ORM (`albums`, `album_media`).

## Anti-Patterns
- Avoiding heavy JS-based masonry calculations on the client. Rely on server-provided aspect ratios to pre-allocate space.
