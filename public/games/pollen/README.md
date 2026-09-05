# Pollenator Pile-Up 🌸 — Appalachian Blossom Balance

An Appalachian summer-themed physics balancing web game designed for embedding into [aresfirst.org](https://aresfirst.org) (ARES FIRST Tech Challenge Team 23247, Morgantown, WV).

Inspired by the bright, welcoming, festive charm of **Dollywood** and the natural wonders of the Mountain State, players take turns stacking native pollinators—Honeybees, Tiger Swallowtails, Luna Moths, Little Brown Bats, and the legendary **Mothman**—onto a delicate, swaying rhododendron flower without tipping it over.

---

## Features

- **Physics-Driven Gameplay**: Powered by [Matter.js](https://brm.io/matter-js/) 2D rigid-body dynamics with realistic rotational inertia, spring-hinge flower stem mechanics, and stacking collisions.
- **Dynamic Appalachian Atmosphere**:
  - **Daytime**: Radiant Dollywood-inspired mountain sunshine, rolling Allegheny ridges, and drifting pollen motes.
  - **Sunset Transition**: When **Mothman** appears in the queue or on approach, the sky shifts into a fiery West Virginia mountain sunset of amber, gold, and violet.
  - **Night Scene**: When Mothman successfully lands, the scene transforms into a starry Appalachian night complete with blinking fireflies (lightning bugs), the **Green Bank Radio Telescope** dish pointing to the cosmos, and the **Point Pleasant Bridge** silhouette across the river mist.
- **Iconic Pollinators**:
  - 🐝 **Honeybee**: Light & nimble, great for balancing tight gaps.
  - 🦋 **Tiger Swallowtail**: Featherlight with a broad wingspan that serves as a landing platform.
  - 🌕 **Luna Moth**: Luminous pale lime wings with trailing tails.
  - 🦇 **Little Brown Bat**: Grippy feet and heavier nocturnal body.
  - 🔴🔴 **Mothman**: Heavy, top-heavy cryptid with glowing red eyes! Very difficult to place, but awards a massive **+500 points BONUS**!
- **Game Modes**:
  - **Solo High Score**: Push your balance skills to set high records saved in `localStorage`.
  - **Pass & Play (2 Players)**: Local duel on the same screen taking turns dropping critters.
  - **Vs. Ranger Dave Bot**: Turn-based match against an AI opponent featuring authentic Appalachian park ranger commentary and torque calculations.
- **Flexible Controls**:
  - **Mouse (Desktop)**: Move cursor to aim, **Scroll Wheel** (or `Q`/`E`) to rotate, **Left Click** to drop.
  - **Touch (Mobile/Tablet)**: Drag to position, tap on-screen `↺` / `↻` buttons to rotate, tap `DROP`.
  - **Keyboard**: Arrow keys or `A`/`D` to position, `W`/`S` or `Q`/`E` to rotate, `Space` to drop.
- **Procedural Web Audio**: Zero external `.mp3` downloads required—custom synthesized acoustic banjo plucks, gentle landing chimes, spring wobbles, and eerie Mothman cryptid drones.

---

## How to Run Locally

You can run the game immediately with zero build tools or dependencies:

1. **Directly in Browser**: Double-click `index.html` or open it with Microsoft Edge / Google Chrome:
   ```powershell
   Start-Process msedge "c:\Users\burdh\dev\pollen\index.html"
   ```
2. **Via Local Static Server** (Optional):
   You can serve the directory with any static server or PowerShell script.

---

## How to Embed into `aresfirst.org`

To add the game to `aresfirst.org`, you can host the `pollen` folder under your web root (for example `aresfirst.org/pollen/`) and embed it using a standard responsive `<iframe>`:

```html
<!-- Example iframe integration for aresfirst.org -->
<div style="position: relative; width: 100%; max-width: 800px; height: 850px; margin: 0 auto; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
  <iframe 
    src="/pollen/index.html" 
    title="Pollenator Pile-Up - Appalachian Blossom Balance"
    style="width: 100%; height: 100%; border: none;"
    allow="fullscreen">
  </iframe>
</div>
```

---

## Project Structure

```
pollen/
├── index.html          # Main application page, viewport & modals
├── README.md           # Documentation & embedding instructions
├── css/
│   └── style.css       # Dollywood/Appalachian styling, responsive canvas, and HUD
├── lib/
│   └── matter.min.js   # Offline Matter.js 2D physics engine
└── js/
    ├── audio.js        # Web Audio API synthesizer (banjo plucks, chime, cryptid sting)
    ├── background.js   # Dynamic Day/Sunset/Night with Green Bank Telescope & Point Pleasant Bridge
    ├── flower.js       # Rhododendron blossom with springy stem and physical landing bed
    ├── pollinators.js  # Bee, Swallowtail, Luna Moth, Bat, and Mothman entities & vector art
    ├── rangerDave.js   # Ranger Dave Bot AI with torque balance calculations & banter
    ├── ui.js           # HUD, preview queue, modals, and local storage high scores
    └── game.js         # Main game coordinator, collision events, and loop
```
