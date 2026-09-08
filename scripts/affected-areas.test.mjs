import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, vi } from "vitest";
import {
  buildCommands,
  main,
  readChanges,
  selectAreas,
  validateManifest,
} from "./affected-areas.mjs";

const manifest = JSON.parse(
  readFileSync("infra/verification-areas.json", "utf8"),
);
const inventory = [
  "e2e/waggle-way.spec.ts",
  "e2e/arcade.spec.ts",
  "e2e/navigation.spec.ts",
  "e2e/auth.spec.ts",
  "e2e/academy.spec.ts",
  "e2e/editor.spec.ts",
  "e2e/tasks.spec.ts",
  "e2e/events.spec.ts",
  "e2e/email-roster.spec.ts",
  "packages/waggle-way/src/core/engine.test.ts",
  "functions/src/lib/__tests__/waggleCommunity.test.ts",
  "src/components/editor/code.test.ts",
];
const git = (args) => {
  if (args[0] === "rev-parse" || args[0] === "merge-base")
    return "a".repeat(40);
  if (args[0] === "diff") return "packages/waggle-way/src/core/engine.ts\0";
  if (args.includes("--cached")) return inventory.join("\0");
  return "";
};

describe("conservative affected-area selection", () => {
  it("selects a game, its Arcade integration, smoke checks and server tests", () => {
    const plan = selectAreas(
      manifest,
      ["packages/waggle-way/src/core/engine.ts"],
      inventory,
    );
    expect(plan.full).toBe(false);
    expect(plan.areas).toEqual(["arcade", "waggle"]);
    expect(plan.e2e).toEqual([
      "e2e/arcade.spec.ts",
      "e2e/auth.spec.ts",
      "e2e/navigation.spec.ts",
      "e2e/waggle-way.spec.ts",
    ]);
    expect(plan.unit).toContain(
      "functions/src/lib/__tests__/waggleCommunity.test.ts",
    );
    expect(plan.deploymentSelectionEnabled).toBe(false);
  });
  it("fans editor changes out to lessons and media, and integrations to team operations", () => {
    expect(
      selectAreas(manifest, ["src/components/editor/Compiler.ts"], inventory)
        .areas,
    ).toEqual(["academy", "editor", "media", "public"]);
    expect(
      selectAreas(
        manifest,
        ["functions/src/routes/studioIntegrations.ts"],
        inventory,
      ).areas,
    ).toEqual(["integrations", "team"]);
    expect(
      selectAreas(manifest, ["content/learning/catalog.json"], inventory).areas,
    ).toEqual(["academy"]);
  });
  it("never guesses unknown, generated, dependency or shared security changes are isolated", () => {
    for (const file of [
      "new-area/widget.ts",
      "src/lib/authorization.ts",
      "packages/waggle-way/package.json",
      "pnpm-lock.yaml",
      "functions/src/generated/games/waggle/index.ts",
      "public/games/pollen/game.js",
      ".github/workflows/ci.yml",
    ]) {
      const result = selectAreas(manifest, [file], inventory);
      expect(result.full, file).toBe(true);
      expect(result.e2e).toHaveLength(9);
    }
    expect(selectAreas(manifest, [], inventory).full).toBe(true);
    expect(
      selectAreas(manifest, [], inventory, "Missing base").reasons,
    ).toContain("Missing base");
    expect(() => selectAreas(manifest, ["../outside"], inventory)).toThrow(
      "path",
    );
    expect(() => selectAreas(manifest, ["src/unknown"], [])).toThrow(
      "No browser",
    );
  });
  it("validates configuration instead of allowing empty successful selection", () => {
    expect(validateManifest(manifest)).toBe(manifest);
    expect(() => validateManifest({})).toThrow("manifest");
    expect(() => validateManifest({ ...manifest, smoke: [] })).toThrow(
      "patterns",
    );
    expect(() =>
      validateManifest({
        ...manifest,
        areas: {
          bad: {
            paths: ["x"],
            e2e: ["x"],
            dependsOn: ["missing"],
            components: [],
          },
        },
      }),
    ).toThrow("dependencies");
  });
  it("uses a resolved merge base and includes deleted, staged and untracked files", () => {
    const stub = vi.fn(git);
    expect(readChanges("master", stub).changed).toEqual([
      "packages/waggle-way/src/core/engine.ts",
    ]);
    expect(stub).toHaveBeenCalledWith([
      "diff",
      "--no-renames",
      "--name-only",
      "-z",
      "a".repeat(40),
      "--",
    ]);
    expect(
      readChanges("missing", (args) =>
        args[0] === "rev-parse" ? "bad" : git(args),
      ).reason,
    ).toContain("unavailable");
    expect(
      readChanges("missing", (args) =>
        args[0] === "merge-base" ? "bad" : git(args),
      ).reason,
    ).toContain("unavailable");
    expect(readChanges("master").inventory.length).toBeGreaterThan(0);
  });
  it("constructs shell-free local commands and refuses an empty area test map", () => {
    const plan = selectAreas(
      manifest,
      ["packages/waggle-way/src/core/engine.ts"],
      inventory,
    );
    expect(buildCommands(plan, "e2e", process.cwd())).toHaveLength(1);
    expect(buildCommands(plan, "unit", process.cwd())).toHaveLength(3);
    expect(
      buildCommands({ ...plan, full: true }, "unit", process.cwd()),
    ).toHaveLength(3);
    expect(
      buildCommands(
        { ...plan, unit: [inventory.at(-1)] },
        "unit",
        process.cwd(),
      ),
    ).toHaveLength(1);
    expect(
      buildCommands(
        { ...plan, unit: [inventory.at(-2)] },
        "unit",
        process.cwd(),
      ),
    ).toHaveLength(2);
    expect(() =>
      buildCommands({ ...plan, unit: [] }, "unit", process.cwd()),
    ).toThrow("No area");
    expect(() => buildCommands(plan, "bogus", process.cwd())).toThrow("suite");
  });
  it("writes an inspectable plan and only executes tests when requested", () => {
    const dir = mkdtempSync(join(tmpdir(), "ares-areas-"));
    try {
      const execute = vi.fn();
      const options = { git, execute, log: vi.fn() };
      const output = join(dir, "plan.json");
      main(["--base", "master", "--output", output], process.cwd(), options);
      expect(JSON.parse(readFileSync(output, "utf8")).mode).toBe("observe");
      expect(execute).not.toHaveBeenCalled();
      main(["--suite", "unit", "--run"], process.cwd(), options);
      expect(execute).toHaveBeenCalledTimes(4);
      for (const args of [
        ["--wat"],
        ["--base"],
        ["--run"],
        ["--suite", "--run"],
      ])
        expect(() => main(args, process.cwd(), options)).toThrow();
      const fallback = main([], process.cwd(), {
        ...options,
        git: (args) => (args[0] === "rev-parse" ? "bad" : git(args)),
      });
      expect(fallback.mergeBase).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
