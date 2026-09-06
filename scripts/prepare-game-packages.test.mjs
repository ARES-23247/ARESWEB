import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { prepareGamePackages } from "./prepare-game-packages.mjs";

const temporary = [];
afterEach(() => { for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true }); });
describe("workspace game deployment inputs", () => {
  it("stages canonical rules and identical assets, and refreshes changed source", () => {
    const root = mkdtempSync(resolve(tmpdir(), "ares-game-packages-"));
    temporary.push(root);
    for (const file of ["game-common/src/hexGrid.ts", "buzzello/src/rules.ts", "buzzle/src/rules.ts",
      "buzzle/data/buzzle-words.txt", "buzzle/data/buzzle-words.meta.json", "pollinator/public/js/game.js"]) {
      const target = resolve(root, "packages", file);
      mkdirSync(resolve(target, ".."), { recursive: true });
      cpSync(resolve("packages", file), target);
    }
    prepareGamePackages(root);
    for (const target of ["public/data/buzzle-words.txt", "functions/data/buzzle-words.txt"]) {
      expect(readFileSync(resolve(root, target)).equals(readFileSync(resolve(root, "packages/buzzle/data/buzzle-words.txt")))).toBe(true);
    }
    expect(readFileSync(resolve(root, "public/games/pollen/js/game.js")).equals(readFileSync(resolve(root, "packages/pollinator/public/js/game.js")))).toBe(true);
    const staged = resolve(root, "functions/src/generated/games/buzzle.ts");
    expect(readFileSync(staged, "utf8")).toContain('from "./hexGrid"');
    expect(readFileSync(staged, "utf8")).not.toContain("@ares/");
    writeFileSync(resolve(root, "packages/buzzle/src/rules.ts"), "export const changed = true;\n");
    prepareGamePackages(root);
    expect(readFileSync(staged, "utf8")).toContain("export const changed = true;");
  });
  it("fails when a canonical input is missing instead of accepting stale output", () => {
    const root = mkdtempSync(resolve(tmpdir(), "ares-game-missing-"));
    temporary.push(root);
    mkdirSync(resolve(root, "functions/src/generated/games"), { recursive: true });
    writeFileSync(resolve(root, "functions/src/generated/games/buzzle.ts"), "stale");
    expect(() => prepareGamePackages(root)).toThrow();
  });
  it("prepares the current repository independently of a caller-supplied root", () => {
    prepareGamePackages();
    expect(readFileSync("functions/src/generated/games/hexGrid.ts", "utf8")).toContain("export function createHexCoordinates");
  });
});
