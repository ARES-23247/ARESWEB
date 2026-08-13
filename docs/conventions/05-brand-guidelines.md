# Brand Guidelines

> ARES 23247 brand color palette and design system. Read before building UI components or making styling decisions.

## Source of truth

The cross-product contract is [`design/ares-design-tokens.json`](../../design/ares-design-tokens.json).
The website mapping is generated as CSS variables in
[`src/styles/ares-design-tokens.css`](../../src/styles/ares-design-tokens.css). Analytics keeps a
versioned snapshot and verifies its Kotlin theme against the same values. Change the JSON contract
first, then update both product mappings and their contrast tests.

The website and Analytics should feel related, not identical. The public website is expressive and
red-led; Analytics is a dense technical tool and cyan-led. Both use the same team colors, logo,
typography families, focus color, and accessibility rules.

## Authorized brand palette

- `ares-red` (`#C00000`) — Primary accents, buttons
- `ares-bronze` (`#CD7F32`) — Hover states, borders
- `ares-gold` (`#FFB81C`) — Premium indicators
- `ares-cyan` (`#00E5FF`) — `:focus-visible` rings (accessibility)
- `marble` (`#F9F9F9`) — Light component backgrounds
- `obsidian` (`#1A1A1A`) — Dark component backgrounds

Brand colors identify ARES. They do not replace semantic status colors. Use `ares-danger`,
`ares-warning`, and `ares-success` for error, warning, and success. Always pair status color with a
word, icon, or pattern.

## Product roles

| Role | Website | Analytics |
|---|---|---|
| Primary action | ARES red with marble text | Technical cyan with near-black text |
| Technical/data accent | Technical cyan | Technical cyan |
| Brand moments | Red, gold, bronze, logo | Logo, red/gold accents in app chrome and learning surfaces |
| Focus indicator | Technical cyan | Technical cyan |
| Working foundation | Obsidian and marble | Dark neutral telemetry surfaces |

Do not use ARES red as a generic selected state or substitute it for error semantics. Do not copy
the website's oversized display typography into dense editors, tables, or telemetry controls.

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
