# Phase 51: UI fixes: Header ARES Academy and Social Media manager nesting

## 1. Social Media Manager Nesting
- [x] Completed in Phase 50 context and finalized here. Ensured `SocialHub.tsx` avoids double padding and utilizes the exact UI structure as the rest of the dashboard components (`ares-cut-sm`, standard top margin, matching headers).

## 2. Header ARES Academy
- [x] Verified `src/pages/Academy.tsx` used a legacy link structure.
- [x] Replaced the simple textual `Academy` link in `Academy.tsx` with the unified brand badge `ARES Academy` (a split badge with `ARES` in red and `Academy` in transparent background on hover). This matches the visual design language established in `Docs.tsx` (`ARESLib`).

## 3. General Validation
- [x] UI matches design intentions for both modules.
- [x] TypeScript builds successfully regarding these specific components.
