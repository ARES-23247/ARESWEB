# Pollinator Pile-Up

Public game page: `/pollen`. Start the repository with `pnpm dev` and open that
route to exercise the same integration used in production.

Balance Appalachian critters and folklore characters on a flower. Solo high
score, pass and play, and the Ranger Dave computer opponent all run on this
device. There is no remote multiplayer, account, leaderboard, or game-server API.
The characters and physics are playful representations, not biology lessons.

Physics advances at a fixed 120 steps per second with interpolated rendering,
independent of display refresh rate. A paused tab discards elapsed background
time. Turns advance only after sustained supported, slow contact. Physical mass
follows the roster weight ratios, including the heavy Mothman piece.
The blossom's visible petals and collision surface widen together, up to 360
pixels, with room at the edges on phones. Off-center loads lean the flower toward
the heavier side; placing weight on the opposite side brings it back toward
level. The damped stem and firmer support on smaller screens limit impact wobble.

## Controls

Aim with the pointer, touch drag, arrow keys, or A/D. Rotate with the wheel,
Q/E, or the on-screen controls. Drop with Space/Enter, click, or the Drop button.
The site provides fullscreen entry and exit without restarting the game.

## Integration and security

`src/app/pollen/page.tsx` hosts the static game in an opaque `allow-scripts`
sandbox. Keep `allow-same-origin` absent. The parent accepts bounded high-score
messages only from its own opaque frame and exposes one device-storage key.
Blocked storage leaves the current game playable and displays a session-only
notice. Neither scores nor gameplay are sent to the existing game backend.

Firebase gives `/games/pollen/**` a specific, same-site framing policy after the
site-wide headers. Scripts are self-hosted; script attributes and network
connections are blocked. Google Fonts supplies optional styling. The public
page is prerendered and linked from the website navigation. README and the
standalone development server script are excluded from Hosting deployment.

## Physics dependency

`lib/matter.min.js` is Matter.js 0.19.0 from the official npm package
`https://registry.npmjs.org/matter-js/-/matter-js-0.19.0.tgz`. Its bytes match the
package build after CRLF/LF normalization. Official build SHA-256:
`bdf68e297d6c4ec85b8dd693b8781d99db0090449c9a3ba69948eede08c9275a`.
The upstream MIT license is retained in `lib/LICENSE-Matter.txt`.

## Verification

`src/test/PollenPage.test.tsx` checks score validation, source isolation, and
storage failures. `src/test/pollenPhysics.test.ts` exercises the shipped Matter.js
engine at multiple display rates, all five critters, stacks, missed drops,
restart, heavy-piece settling, sustained weight-driven tilt, counterbalancing,
and responsive flower sizing. The fixed-step clock has a coverage ratchet.
`e2e/pollen.spec.ts` covers public entry, keyboard play,
turns, fullscreen, small screens, the local opponent, and sandboxed score saving.
`check-hosting-emulator.mjs` checks the deployed route and framing headers.
