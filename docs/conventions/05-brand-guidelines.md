# Brand Guidelines

> ARES 23247 brand color palette and design system. Read before building UI components or making styling decisions.

## Authorized Palette (ONLY these)

- `ares-red` (`#C00000`) — Primary accents, buttons
- `ares-bronze` (`#CD7F32`) — Hover states, borders
- `ares-gold` (`#FFB81C`) — Premium indicators
- `ares-cyan` (`#00E5FF`) — `:focus-visible` rings (accessibility)
- `marble` (`#F9F9F9`) — Light component backgrounds
- `obsidian` (`#1A1A1A`) — Dark component backgrounds

## Forbidden

- ❌ Generic Tailwind colors: `text-red-500`, `bg-gray-900`
- ❌ Arbitrary hex codes: `bg-[#1A1A1A]`, `text-[#C00000]`
- ❌ Ghost classes: non-existent tokens like `ares-red-bright`

## Hero Card Geometry

- ❌ BANNED: `clip-path: polygon()` for dynamic cards (breaks box model, shadows)
- ✅ REQUIRED: Use global `.hero-card` class for cut-corner aesthetic

## Nomenclature

- **FIRST®** — Italicized with ® symbol
- **ARESLib** — One word, capital "L". Style: `ARES` (red) + `Lib` (white/marble)
- **Llama**, **LLaVA** — Exact casing (not LLaMa, Llava)
- Domain: `https://aresfirst.org` (not ares23247.com)
