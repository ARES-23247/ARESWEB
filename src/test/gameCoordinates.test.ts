import { describe, expect, it } from "vitest";
import { axialKey, createHexCoordinates } from "@ares/game-common/hex-grid";
import { BUZZELLO_COORDINATES } from "@ares/buzzello/rules";
import { BUZZLE_COORDINATES, BUZZLE_ONLINE_INDICES, getBuzzleCellIndex } from "@ares/buzzle/rules";

describe("persisted game coordinate compatibility", () => {
  it("preserves every BUZZELLO column-major cell identifier", () => {
    let index = 0;
    for (let q = -4; q <= 4; q += 1) {
      for (let r = Math.max(-4, -q - 4); r <= Math.min(4, -q + 4); r += 1) {
        expect(BUZZELLO_COORDINATES[index++]).toEqual({ q, r });
      }
    }
    expect(index).toBe(61);
  });
  it("round-trips every online BUZZLE slot at the same physical coordinate", () => {
    let onlineIndex = 0;
    for (let q = -8; q <= 8; q += 1) {
      for (let r = Math.max(-8, -q - 8); r <= Math.min(8, -q + 8); r += 1) {
        const localIndex = getBuzzleCellIndex(q, r)!;
        expect(BUZZLE_ONLINE_INDICES[onlineIndex]).toBe(localIndex);
        expect(BUZZLE_ONLINE_INDICES[localIndex]).toBe(onlineIndex++);
        expect(BUZZLE_COORDINATES[localIndex]).toEqual({ q, r });
      }
    }
    expect(onlineIndex).toBe(217);
    expect(BUZZLE_ONLINE_INDICES[109]).toBe(125); // one cell right of center
  });
  it("rejects invalid grid radii and supports a one-cell board", () => {
    for (const radius of [-1, 1.5, NaN, Infinity]) expect(() => createHexCoordinates(radius)).toThrow(RangeError);
    expect(createHexCoordinates(0).map(axialKey)).toEqual(["0,0"]);
  });
});
