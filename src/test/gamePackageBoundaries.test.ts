import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("game workspace boundaries", () => {
  it("keeps all workspace packages independent of website source and Firebase and declares external imports", () => {
    const packageDirs = readdirSync(resolve("packages"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(resolve("packages", entry.name, "src")))
      .map((entry) => entry.name)
      .sort();

    expect(packageDirs).toEqual(
      expect.arrayContaining([
        "biobuzz",
        "buzzle",
        "buzzello",
        "buzzhex",
        "game-common",
        "ui",
        "waggle-way",
      ]),
    );

    for (const name of packageDirs) {
      const root = resolve("packages", name);
      const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
      const allowed = new Set(
        Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies }),
      );
      for (const file of readdirSync(resolve(root, "src"), { recursive: true }).filter((entry) =>
        /\.tsx?$/u.test(String(entry)),
      )) {
        const source = readFileSync(resolve(root, "src", String(file)), "utf8");
        const staticImports = [
          ...source.matchAll(/(?:from\s*|import\s*)["']([^"']+)["']/gu),
        ].map((match) => match[1]);
        const dynamicImports = [
          ...source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/gu),
        ].map((match) => match[1]);
        const isTestFile = /\.test\.tsx?$/u.test(String(file));
        for (const specifier of [...staticImports, ...dynamicImports]) {
          expect(specifier, `${name}/${String(file)}`).not.toMatch(
            /^@\/|\.\.\/.*(?:src\/|functions\/)/u,
          );
          expect(specifier, `${name}/${String(file)}`).not.toMatch(
            /^firebase(?:\/|$)/u,
          );
          if (!specifier.startsWith(".")) {
            const dependency = specifier.startsWith("@")
              ? specifier.split("/").slice(0, 2).join("/")
              : specifier.split("/")[0];
            if (
              isTestFile &&
              (dependency === "vitest" ||
                dependency.startsWith("@testing-library/") ||
                dependency.startsWith("node:"))
            ) {
              continue;
            }
            expect(allowed.has(dependency), `${name} must declare ${dependency}`).toBe(true);
          }
        }
      }
    }
  });
  it("keeps cloud installation standalone and uses the verified compiled artifact", () => {
    const functions = JSON.parse(readFileSync("functions/package.json", "utf8"));
    expect(functions.scripts["gcp-build"]).toBe("");
    expect(functions.main).toBe("lib/index.js");
    expect(Object.values(functions.dependencies).some((value) => String(value).startsWith("workspace:"))).toBe(false);
    const docker = readFileSync("functions/Dockerfile.game", "utf8");
    expect(docker).toContain("COPY packages /workspace/packages");
    expect(docker).toContain("npm run build && npm prune --omit=dev");
    expect(readFileSync(".github/workflows/ci.yml", "utf8")).toContain('docker build --file functions/Dockerfile.game --tag "$game_image" .');
  });
});
