---
name: aresweb-brand-enforcement
description: Dictates the absolute enforcement of the ARES 23247 FIRST Robotics core brand color palette, banning the use of generic tailwind scales and arbitrary hex codes to ensure championship-tier design system consistency.
---

# ARES 23247 Brand Enforcement Protocol

When building, auditing, or refactoring UI components for the ARES Web Portal, you **MUST** strictly adhere to the established ARES Design System.

Your primary directive is to eliminate color entropy. A championship-grade portal cannot have five different shades of red or arbitrary grays scattered across the codebase.

## 1. The Authorized Palette
You are strictly authorized to use ONLY the following Tailwind tokens mapped in `tailwind.config.ts`:

- `ares-red` (`#C00000`): The primary brand identifier. Used for core accents, primary buttons, and critical highlights.
- `ares-bronze` (`#CD7F32`): The secondary brand identifier. Used for hovering ares-red elements, sub-borders, or the meander-strip.
- `ares-gold` (`#FFB81C`): Used strictly for high-visibility UI accents and premium indicators.
- `ares-cyan` (`#00E5FF`): Used ONLY for accessibility `:focus-visible` ring targeting to guarantee maximum WCAG contrast.
- `marble` (`#F9F9F9`): The mandatory background for "Light" components (e.g. About Pages, standard text docs).
- `obsidian` (`#1A1A1A`): The mandatory background for "Dark" components (e.g. Hero Sections, Dashboards, Events).

## 2. The Golden Rule of Rejection
If a user asks you to "make this text green" or "use a cool gray for the background", you must **REJECT** the generic color request. Explain that ARES WEB strictly utilizes `ares-red`, `ares-gold`, `marble`, and `obsidian`. Find a way to structure their request using the authorized palette.

## 3. Ban on Generic Tailwind Tokens
You must **NEVER** write utility classes containing the default Tailwind RGB spectrum unless it is `black`, `white`, or `transparent`.
- ❌ **BANNED**: `text-red-500`, `bg-gray-900`, `border-blue-400`, `hover:text-amber-500`
- ✅ **AUTHORIZED**: `text-ares-red`, `bg-obsidian`, `border-ares-bronze`, `hover:text-ares-gold`

## 4. Ban on Ghost Classes and Arbitrary Strings
You must **NEVER** use bracket-syntax arbitrary hex codes in the JSX.
- ❌ **BANNED**: `bg-[#1A1A1A]`, `text-[#C00000]`
- ✅ **AUTHORIZED**: `bg-obsidian`, `text-ares-red`

Additionally, you ensure that if you use `-bright`, `-dark`, or opacities (e.g., `text-marble/70`), the base class *actually exists* in the tailwind configuration. "Ghost classes" like `ares-red-bright` that don't exist default to nothing and destroy the UI. If you need a variation, either add it to the tailwind config or use native tailwind opacity dividers (e.g., `bg-ares-red/80`).

## 5. Geometric UI Constraints (The Hero Card)
In addition to color, structural geometry must be globally consistent across all modular components.

You must **NEVER** use `clip-path` polygon cuts to achieve diagonal corners on dynamic cards. `clip-path` mathematically destroys the CSS Box Model, completely nullifying native CSS shadows (`hover:shadow-2xl`) and CSS border bounds. 
- ❌ **BANNED**: `clip-path: polygon(...)` for dynamic hover interaction containers.

Instead, you must utilize the global `.hero-card` class defined in `index.css`. This class organically simulates the geometric "cut corner" aesthetic across the portal using extremely heavy, asymmetrical border-radiuses (a "leaf-shape").
- ✅ **AUTHORIZED**: `<div className="hero-card group">`
- The intrinsic padding, geometric radiuses, and dynamic "bubble" hover behaviors (upward translation, massive drop shadows, and glowing red borders) are all built centrally into `.hero-card`. 

## 7. Nomenclature & Corporate Branding
To maintain championship-level professionalism, specific organizations and technologies must be referred to using precise nomenclature:

- **FIRST® Branding**: Always refer to the organization as *FIRST*® (italicized with the registered trademark symbol `®`). This applies to every mention in body text, headers, and metadata.
- **AI Model Consistency**: Use consistent and technically accurate casing for standard models:
  - ✅ **AUTHORIZED**: `Llama` (Meta's Large Language Model)
  - ✅ **AUTHORIZED**: `LLaVA` (Large Language-and-Vision Assistant)
  - ❌ **BANNED**: `LLaMa`, `LLava`, `llama`

## 8. Execution
Whenever you encounter UI files that violate these protocols, treat it as a critical architectural defect. You must proactively sweep the file and replace the banned colors, nomenclature, or fractured geometry containers with their authorized ARES equivalents before declaring the task complete.
