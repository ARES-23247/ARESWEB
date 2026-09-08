# Pixelify Sans

Unmodified variable TrueType font (weights 400–700), bundled locally for Waggle
Way's game and workshop UI. Downloaded 2026-09-07 from the official Google Fonts
repository at commit `8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5`:

- [Font](https://github.com/google/fonts/blob/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/pixelifysans/PixelifySans%5Bwght%5D.ttf)
- [License](https://github.com/google/fonts/blob/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/pixelifysans/OFL.txt)
- [Metadata](https://github.com/google/fonts/blob/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/pixelifysans/METADATA.pb)

Designer: Stefie Justprince. Copyright 2021 The Pixelify Sans Project Authors.
License: SIL Open Font License 1.1; full text is preserved in `OFL.txt` and linked
from the game's sound/motion panel so the production bundle includes it.

Upstream source commit recorded in `METADATA.pb`:
`39df74aba80df8157546034b878e8be1eb565ced` in `eifetx/Pixelify-Sans`.

Local `PixelifySans.ttf`: 79,160 bytes, SHA-256
`9ba86cd010a4de309d263ceff8e8044092c9db7efda869620cb9ff1c4389e8a5`.
Only the local filename changed. The font is referenced by the package CSS and
served by Vite; no Google Fonts request is made by the game.

The game CSS excludes ASCII digits from the pixel face with `unicode-range`.
Numbers use the monospace fallback so 2 and 5 remain distinct from letters in
level labels, rescue totals, tool quantities, and workshop controls. The bundled
font itself remains unmodified.
