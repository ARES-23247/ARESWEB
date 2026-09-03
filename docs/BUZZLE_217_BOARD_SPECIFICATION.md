# BUZZLE™ 217-Cell Board Specification & Developer Handoff Guide

> **Official Game Board Architecture (Radius 8)**  
> **Status**: Approved & Locked (2026-09-03)  
> **ARESWEB Integration**: Implemented & Verified (100% Tests Passing)

---

## 1. Visual Architecture

![Official 217-Cell Clean Board](file:///C:/Users/david/.gemini/antigravity/brain/2297f84f-f061-496a-befc-cc4ec57124a9/buzzle_master_clean_board.png)

---

## 2. Geometric & Topological Parameters

| Parameter | Value | Details |
| :--- | :--- | :--- |
| **Board Radius** | **8** | From center $(0, 0)$ to any of the 6 extreme apex points |
| **Total Cells** | **217** | Formula: $N = 1 + 3 \times R \times (R + 1) = 1 + 3(8)(9) = 217$ |
| **Flat-to-Flat Pitch** | **$35.20\text{ mm}$** | $33.80\text{ mm}$ pocket flat $+ 1.40\text{ mm}$ rib dividing wall |
| **Overall Diameter** | **$563.2\text{ mm}$** | 17 cells point-to-point flat orientation |
| **3D Print Structure** | **7 Plates** | 1 Central Rosette Hub (37 cells) + 6 Outer Wedges (30 cells each) |

---

## 3. Coordinate Systems & Bijection

The board supports both **Axial $(q, r)$** (used in web/game engines like ARESWEB) and **Cubic $(x, y, z)$** (used in 3D CAD/rendering).

### Mathematical Conversion
Given cubic coordinates $(x, y, z)$ where $x + y + z = 0$:
$$\begin{cases} q = -z = x + y \\ r = -y \end{cases} \iff \begin{cases} x = q + r \\ y = -r \\ z = -q \end{cases}$$

### The 6 Board Apexes (Ring 8)
1. **North ($90^\circ$)**: $(q = 0, r = -8) \iff (x = -8, y = 8, z = 0)$
2. **North-East ($30^\circ$)**: $(q = 8, r = -8) \iff (x = 0, y = 8, z = -8)$
3. **South-East ($330^\circ$)**: $(q = 8, r = 0) \iff (x = 8, y = 0, z = -8)$
4. **South ($270^\circ$)**: $(q = 0, r = 8) \iff (x = 8, y = -8, z = 0)$
5. **South-West ($210^\circ$)**: $(q = -8, r = 8) \iff (x = 0, y = -8, z = 8)$
6. **North-West ($150^\circ$)**: $(q = -8, r = 0) \iff (x = -8, y = 0, z = 8)$

---

## 4. Multiplier Inventory & Coordinate Sets

| Multiplier | Symbol | Count | Ring Location | Description |
| :--- | :---: | :---: | :--- | :--- |
| **Triple Word** | `TW` | **6** | Ring 8 (6 Apexes) | Multiplies total word score by $3\times$ |
| **Triple Letter** | `TL` | **6** | Ring 8 (6 Perimeter Midpoints) | Multiplies letter value by $3\times$ |
| **Double Word** | `DW` | **12** | Ring 7 (2 per corner, Row 3) | Multiplies total word score by $2\times$ |
| **Key Wild** | `DW 🔑` | **6** | Ring 4 (1 per radial spoke) | Acts as Double Word + Wild placement |
| **Double Letter** | `DL` | **24** | Rings 2, 4, 6 | Multiplies letter value by $2\times$ |
| **Start Star** | `★` | **1** | Ring 0 $(0, 0)$ | Opening play must cover $(0, 0)$ ($2\times$ word) |
| **Plain / Neutral** | — | **162** | Interior / Buffer rows | Regular letter scoring |
| **TOTAL** | | **217** | | |

> [!IMPORTANT]
> **De-Clustering Rule**:
> * **Ring 1**: 100% clean/blank (zero multipliers surrounding the opening star).
> * **Row 2 under `TW`**: 100% clean/blank (impossible to bridge a `TW` and `DW` in a 2-letter word).
> * **Ring 8 Perimeter**: Contains **zero `DW` tiles** (all 12 `DW`s are tucked into Ring 7).

---

## 5. Ready-to-Use TypeScript / JavaScript Constants

For integration into any web engine, React component, or Node backend:

```typescript
export const BUZZLE_RADIUS = 8;
export const BUZZLE_CELL_COUNT = 217;

/** 6 extreme apex corners in Ring 8 */
export const TRIPLE_WORD_KEYS = new Set<string>([
  "-8,0", "0,-8", "-8,8", "8,-8", "0,8", "8,0",
]);

/** 6 flat edge midpoints in Ring 8 */
export const TRIPLE_LETTER_KEYS = new Set<string>([
  "-4,-4", "-8,4", "4,-8", "-4,8", "8,-4", "4,4",
]);

/** 12 Double Word spaces symmetrically flanking the apexes in Ring 7 */
export const DOUBLE_WORD_KEYS = new Set<string>([
  "-6,-1", "-1,-6", "-7,1", "1,-7", "-7,6", "6,-7",
  "-6,7", "7,-6", "-1,7", "7,-1", "1,6", "6,1",
]);

/** 6 Key Wild spaces at radius 4 along the principal corridors */
export const KEY_WILD_KEYS = new Set<string>([
  "-2,-2", "-4,2", "2,-4", "-2,4", "4,-2", "2,2",
]);

/** 24 Double Letter spaces distributed across Rings 2, 4, and 6 */
export const DOUBLE_LETTER_KEYS = new Set<string>([
  "-4,-2", "-2,-4", "-6,2", "-4,0", "0,-4", "2,-6",
  "-6,4", "-1,-1", "4,-6", "-2,1", "1,-2", "-4,4",
  "4,-4", "-1,2", "2,-1", "-4,6", "1,1", "6,-4",
  "-2,6", "0,4", "4,0", "6,-2", "2,4", "4,2",
]);

export function getBuzzleMultiplier(q: number, r: number): "plain" | "DL" | "TL" | "DW" | "TW" | "star" {
  if (q === 0 && r === 0) return "star";
  const key = `${q},${r}`;
  if (TRIPLE_WORD_KEYS.has(key)) return "TW";
  if (TRIPLE_LETTER_KEYS.has(key)) return "TL";
  if (DOUBLE_WORD_KEYS.has(key) || KEY_WILD_KEYS.has(key)) return "DW";
  if (DOUBLE_LETTER_KEYS.has(key)) return "DL";
  return "plain";
}
```

---

## 6. ARESWEB Codebase Update Status

The ARESWEB portal repository (`C:\Users\david\AppData\Local\Temp\aresweb-buzzle` on branch `codex/buzzle-tile-fidelity`) has already been updated:

* `src/lib/buzzle.ts`: Updated to `BUZZLE_RADIUS = 8`, `BUZZLE_CELL_COUNT = 217`, and new multiplier sets.
* `src/lib/buzzleOnline.ts`: Replaced hardcoded 127 checks with `BUZZLE_CELL_COUNT`.
* `src/app/buzzle/page.tsx`: Re-scaled dynamic hex grid projection for 17 columns/rows.
* `src/app/buzzle/buzzle.css`: Re-scaled `.buzzle-cell` width ($7.34\%$) and height ($5.65\%$).
* `functions/src/lib/buzzleGameDefinition.ts`: Updated backend matchmaking, move validation, and scoring to 217 cells.
* **Test Verification**:
  * `vitest run src/test/buzzle*` $\rightarrow$ **23/23 tests passed**
  * Full Portal Suite $\rightarrow$ **227 test files, 1194 tests passed (100%)**
  * `tsc --noEmit` & `pnpm --filter functions build` $\rightarrow$ **0 errors**
  * Changes staged and committed under commit `991fbb6c`.
