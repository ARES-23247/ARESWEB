# Waggle Way art direction

Updated 2026-09-07. The user rejected the overall prototype presentation.

## Current visual contract: pixel art

Follow the [pixel-art redesign decision](PIXEL_ART_PIVOT.md): strict top-down
tiles and sprites with a coherent 8-bit-inspired palette, crisp edges and
matching game-owned typography, icons, HUD, menus and workshop. Website chrome
must not define the game's appearance. Preserve one embedded window and
fullscreen, with aspect-correct scaling and readable keyboard/touch controls.
Choose sprite resolution and scaling through the first complete level review;
do not add fake CRT distortion or tiny unreadable text merely to imply 8-bit.

The local renderer now uses original pixel sprites and ground patterns. The
painterly backgrounds and smooth SVG artwork described below are historical
implementation/provenance, not the new target. Overall visual acceptance remains open.
Preserve their source records; no asset deletion is authorized by this document.

### Local typography and compact controls — 2026-09-07

Game/workshop CSS now bundles unmodified Pixelify Sans locally (400–700 weights),
replacing the typewriter-style fallback as the primary face. Its SIL OFL 1.1
license, author metadata, pinned source and file hash are retained in
[font provenance](../../packages/waggle-way/src/assets/fonts/README.md).
The sound/motion panel links the shipped license. No remote font service is
needed at runtime. Assess small labels, numbers and zoom with real players;
successful font loading alone does not prove readability.

The version-6 play dock keeps supply and helper actions visible. Coordinate
placement and detailed tool settings open over the game without resizing the
board; Escape/Done restore focus to their trigger, and opening a panel pauses
flight. Desktop puts the dock on one row when space allows; mobile uses two
short rows. The frame preserves the world aspect ratio, with internal scrolling
available where viewport height or text zoom requires it. Focus uses the game's
light-paper color rather than the website accent. Legacy game controls retain
their existing structure. Full workshop control redesign and matching pixel
control icons remain unfinished.

## Historical prototype revision (2026-09-05–06)

## Camera and readability

The game uses a strict overhead view. Ground fills the frame at one scale. There is no horizon, sky, landscape perspective, or side-view staging. The rejected landscape v1 assets are not referenced or included in the package. Original generation files remain outside the repository.

Backgrounds use quiet central ground texture with detail at the margins. Actual obstacles, flowers, bees, arrows and rain fields are rendered above them. Decorative flowers in the background do not count as rescue destinations. Direction means movement across the garden plane, not altitude. Existing deterministic sprinkler rules are unchanged; their directional field is shown explicitly on the board.

All eleven piece types were redrawn in native SVG with overhead silhouettes, short shadows, leaf veins, honey rings, fan blades, water ripples and readable state labels. Bees have paired wings and eyes and rotate with their heading. The palette and supply tray reuse the board artwork. Native vector art remains editable and scales independently of the ground image.

## UI contract

The game and workshop own their screen, with a direct Arcade exit and preserved skip navigation and route announcements. The playfield comes before editing forms. Drag arrows to turn, drag tools from the tray with mouse/pen/touch pointer capture, drag movable pieces with a visible preview, or tap a piece and its destination. Native HTML drag/drop is not required; Escape cancels a tray drag. Direction buttons and optional coordinate forms preserve keyboard access. Detailed object editing and the campaign chooser use centered dialogs. Selecting a level restores focus to its heading; dismissing a dialog restores its opener. Opening the campaign chooser pauses the run.

## Generated assets and prompts

Created with the built-in image_gen tool (not the CLI). PNG masters and WebP runtime copies are stored under `packages/waggle-way/src/assets/`. Runtime copies use Sharp WebP encoding at quality 85 without cropping or recoloring. All five variants are wired to their campaign gardens. Version-5 workshop files also select these built-in themes; presentation never changes the authored collision map. Pollen uses matching gold hexagonal SVG art in the tray, scene and carried-bee marker.

### sunny

Files: `sunny-overhead-v2.png` and `sunny-overhead-v2.webp`.

Prompt:

> Use case: stylized-concept. Asset: actual top-down 2D game ground background for Waggle Way, a bee swarm puzzle. Camera: strict orthographic 90-degree overhead, looking STRAIGHT DOWN at the ground, like a beautifully crafted overhead strategy game board. Every leaf and flower is seen from above. Wide 16:9 rectangular image. Entire image is ground at the same scale: rich soft mossy sage-green grass, tiny clover leaves, subtle earthy variation. Quiet central 85% with low contrast fine ground texture so small bees and tool sprites will be legible. Delightful detailed small daisy heads and round clover clusters at the outer edges and corners only, soft dappled sunlight coming from upper left, gentle short contact shadows. Premium hand-painted stylized game art, tactile plants, inviting honey-gold green palette, sophisticated color variation. Absolutely NO sky, horizon, mountains, distant scenery, side-view trees, vertical vista, perspective convergence, isometric camera, buildings, paths, ponds, platforms, bees, tools, text, UI, grid or frames. This is flat overhead garden terrain underneath gameplay, NOT landscape scenery or a website banner.

### meadow

Files: `meadow-overhead-v2.png` and `meadow-overhead-v2.webp`.

Prompt:

> Create a production game ground texture variant based on this reference. Preserve its STRICT 90-degree overhead orthographic camera, ground filling the entire 16:9 image at one scale, same polished hand-painted game art, quiet low contrast central 85% for bee and tool sprites. Environment variant: soft pale green fine grasses, scattered round clover flower heads at the margins, warm airy dappled sunlight. All plants viewed straight down. Only edges and corners have detailed foliage; no obstacles painted in the central playing space. NO sky, horizon, mountains, vertical vista, side-view scenery, perspective convergence, isometric camera, UI, text, grid, bees or tools. This image sits UNDER top-down gameplay.

### glasshouse

Files: `glasshouse-overhead-v2.png` and `glasshouse-overhead-v2.webp`.

Prompt:

> Create a production game ground texture variant based on this reference. Preserve its STRICT 90-degree overhead orthographic camera, ground filling the entire 16:9 image at one scale, same polished hand-painted game art, quiet low contrast central 85% for bee and tool sprites. Environment variant: muted mossy green ground with subtle earth, overhead fern rosettes and tiny terracotta pot rims just in corners, a very soft faint greenhouse lattice SHADOW on the ground; no glass structure in view. All plants viewed straight down. Only edges and corners have detailed foliage; no obstacles painted in the central playing space. NO sky, horizon, mountains, vertical vista, side-view scenery, perspective convergence, isometric camera, UI, text, grid, bees or tools. This image sits UNDER top-down gameplay.

### rainy

Files: `rainy-overhead-v2.png` and `rainy-overhead-v2.webp`.

Prompt:

> Create a production game ground texture variant based on this reference. Preserve its STRICT 90-degree overhead orthographic camera, ground filling the entire 16:9 image at one scale, same polished hand-painted game art, quiet low contrast central 85% for bee and tool sprites. Environment variant: cool sage damp mossy ground, softly glistening tiny leaves, dew droplets on clover foliage at margins, cool overcast light, no puddles or falling rain or water hazards. All plants viewed straight down. Only edges and corners have detailed foliage; no obstacles painted in the central playing space. NO sky, horizon, mountains, vertical vista, side-view scenery, perspective convergence, isometric camera, UI, text, grid, bees or tools. This image sits UNDER top-down gameplay.

### wildflower

Files: `wildflower-overhead-v2.png` and `wildflower-overhead-v2.webp`.

Prompt:

> Create a production game ground texture variant based on this reference. Preserve its STRICT 90-degree overhead orthographic camera, ground filling the entire 16:9 image at one scale, same polished hand-painted game art, quiet low contrast central 85% for bee and tool sprites. Environment variant: warm sage clover floor, colorful small coral, violet and cream flower heads viewed overhead around the margins, celebratory summer palette. All plants viewed straight down. Only edges and corners have detailed foliage; no obstacles painted in the central playing space. NO sky, horizon, mountains, vertical vista, side-view scenery, perspective convergence, isometric camera, UI, text, grid, bees or tools. This image sits UNDER top-down gameplay.

## Acceptance

Automated interaction checks and visual inspection support this revision. Player approval of the revised look and usability is still open. No AAA-quality or accessibility-conformance claim is made.


Wide or tall hives, flowers, perches, fans, rallies, switches, sprinklers and pollen
keep their artwork proportions centered within the authored rectangle. A subtle
outline marks the full footprint. Terrain, water, gates and shelter leaves still
span their authored dimensions. This corrects stretched flowers/nozzles observed
in the Wildflower finale screenshot without changing collision or interaction.


## Embedded game frame — 2026-09-06

The previous revision kept campaign play within one rounded, framed game surface using the established
garden/gold palette. The website supplies a restrained title and Arcade/Workshop
links outside it. Playback, objective counts and contextual controls belong inside
the frame. Supplemental explanations open over it. Preserve the overhead board's
aspect ratio in both embedded and fullscreen views; never stretch its coordinates
to fill the available screen. Use internal scrolling on short screens so tools and
labels remain reachable. This layout revision does not imply player art approval.
