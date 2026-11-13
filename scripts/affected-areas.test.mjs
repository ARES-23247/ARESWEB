import { readFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
  "e2e/biobuzz.spec.ts",
  "e2e/arcade.spec.ts",
  "e2e/navigation.spec.ts",
  "e2e/auth.spec.ts",
  "e2e/academy.spec.ts",
  "e2e/editor.spec.ts",
  "e2e/public-routes.spec.ts",
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
    expect(plan.mode).toBe("enforce");
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
    expect(plan.needsGameContainer).toBe(true);
    expect(plan.deploymentSelectionEnabled).toBe(true);
  });
  it("fans editor changes out to lessons and media, integrations to team, and isolates docs and biobuzz", () => {
    expect(
      selectAreas(manifest, ["src/components/editor/Compiler.ts"], inventory)
        .areas,
    ).toEqual(["academy", "editor", "media", "public"]);
    const simDashPlan = selectAreas(
      manifest,
      ["src/app/dashboard/simulations/page.tsx"],
      inventory,
    );
    expect(simDashPlan.areas).toEqual(["academy", "editor", "media", "public"]);
    expect(simDashPlan.e2e).toContain("e2e/editor.spec.ts");
    expect(
      selectAreas(manifest, ["src/lib/biobuzzOnline.ts"], inventory).areas,
    ).toEqual(["arcade", "biobuzz"]);
    expect(
      selectAreas(
        manifest,
        ["functions/src/routes/studioIntegrations.ts"],
        inventory,
      ).areas,
    ).toEqual(["integrations", "team"]);
    const academyPlan = selectAreas(
      manifest,
      ["content/learning/catalog.json"],
      inventory,
    );
    expect(academyPlan.areas).toEqual(["academy"]);
    expect(academyPlan.needsGameContainer).toBe(false);
    const docsPlan = selectAreas(
      manifest,
      ["docs/SITE_OPERATIONS_CHECKLIST.md"],
      inventory,
    );
    expect(docsPlan.full).toBe(false);
    expect(docsPlan.areas).toEqual(["docs"]);
    expect(docsPlan.needsGameContainer).toBe(false);
    const biobuzzPlan = selectAreas(
      manifest,
      ["packages/biobuzz/src/core/engine.ts"],
      inventory,
    );
    expect(biobuzzPlan.areas).toEqual(["arcade", "biobuzz"]);
    expect(biobuzzPlan.needsGameContainer).toBe(false);
    expect(
      selectAreas(
        manifest,
        ["src/app/dashboard/portfolio/page.tsx"],
        [...inventory, "e2e/championship.spec.ts"],
      ).areas,
    ).toEqual(["team"]);
    expect(
      selectAreas(
        manifest,
        ["src/app/seasons/page.tsx"],
        [...inventory, "e2e/championship.spec.ts"],
      ).areas,
    ).toEqual(["public"]);
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
      expect(result.needsGameContainer, file).toBe(true);
      expect(result.e2e).toHaveLength(11);
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
    expect(validateManifest({ ...manifest, mode: "observe" }).mode).toBe(
      "observe",
    );
    expect(() => validateManifest({})).toThrow("manifest");
    expect(() => validateManifest({ ...manifest, mode: "invalid" })).toThrow(
      "manifest",
    );
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
    const e2eCommands = buildCommands(plan, "e2e", process.cwd(), [
      "--shard=1/2",
      "--workers=3",
    ]);
    expect(e2eCommands).toHaveLength(1);
    expect(e2eCommands[0].args.slice(-2)).toEqual([
      "--shard=1/2",
      "--workers=3",
    ]);
    expect(
      buildCommands({ ...plan, full: true }, "e2e", process.cwd())[0].args,
    ).not.toContain("e2e/waggle-way.spec.ts");
    expect(() => buildCommands({ ...plan, e2e: [] }, "e2e", process.cwd())).toThrow(
      "No browser",
    );
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
  it("writes an inspectable plan, GitHub outputs, and E2E inventories and executes tests when requested", () => {
    const dir = mkdtempSync(join(tmpdir(), "ares-areas-"));
    try {
      const execute = vi.fn(() => '{"suites":[]}\n');
      const options = { git, execute, log: vi.fn() };
      const output = join(dir, "plan.json");
      const ghOutput = join(dir, "github-output.txt");
      const inventoryOut = join(dir, "inventory.json");
      main(
        ["--base", "master", "--output", output, "--github-output", ghOutput],
        process.cwd(),
        options,
      );
      expect(JSON.parse(readFileSync(output, "utf8")).mode).toBe("enforce");
      expect(readFileSync(ghOutput, "utf8")).toBe(
        "full=false\nneeds_game_container=true\n",
      );
      expect(execute).not.toHaveBeenCalled();

      main(
        ["--plan", output, "--list-e2e", inventoryOut],
        process.cwd(),
        options,
      );
      expect(readFileSync(inventoryOut, "utf8")).toBe('{"suites":[]}\n');
      expect(execute).toHaveBeenCalledTimes(1);

      const fullPlan = join(dir, "full-plan.json");
      writeFileSync(
        fullPlan,
        JSON.stringify({ full: true, e2e: ["e2e/navigation.spec.ts"] }),
      );
      main(
        ["--plan", fullPlan, "--list-e2e", inventoryOut],
        process.cwd(),
        options,
      );
      expect(execute).toHaveBeenCalledTimes(2);

      execute.mockClear();
      main(
        [
          "--plan",
          output,
          "--suite",
          "e2e",
          "--run",
          "--playwright-arg=--shard=1/2",
          "--playwright-arg",
          "--workers=3",
        ],
        process.cwd(),
        options,
      );
      expect(execute).toHaveBeenCalledTimes(2);

      execute.mockClear();
      main(["--suite", "unit", "--run"], process.cwd(), options);
      expect(execute).toHaveBeenCalledTimes(4);

      const badPlan = join(dir, "bad-plan.json");
      writeFileSync(badPlan, '{"e2e":[]}');
      expect(() => main(["--plan", badPlan], process.cwd(), options)).toThrow(
        "Invalid area plan",
      );

      for (const args of [
        ["--wat"],
        ["--base"],
        ["--run"],
        ["--suite", "--run"],
        ["--playwright-arg="],
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
