import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workspaceRoot = resolve(import.meta.dirname, "../..");
const require = createRequire(import.meta.url);

describe("dependency security contracts", () => {
  it("keeps every qs resolution on the patched release line", () => {
    const workspace = readFileSync(resolve(workspaceRoot, "pnpm-workspace.yaml"), "utf8");
    const functionsPackage = JSON.parse(
      readFileSync(resolve(workspaceRoot, "functions/package.json"), "utf8"),
    ) as { overrides?: Record<string, string> };
    const functionsLock = JSON.parse(
      readFileSync(resolve(workspaceRoot, "functions/package-lock.json"), "utf8"),
    ) as { packages?: Record<string, { version?: string }> };

    expect(workspace).toMatch(/^\s+qs: \^6\.16\.0$/mu);
    expect(functionsPackage.overrides?.qs).toBe("^6.16.0");
    expect(functionsLock.packages?.["node_modules/qs"]?.version).toBe("6.16.0");
  });

  it("backports a bounded filter depth while firebase-tools requires stream-json 1.x", async () => {
    const workspace = readFileSync(resolve(workspaceRoot, "pnpm-workspace.yaml"), "utf8");
    const patch = readFileSync(
      resolve(workspaceRoot, "patches/stream-json@1.9.1.patch"),
      "utf8",
    );

    expect(workspace).toContain(
      "stream-json@1.9.1: patches/stream-json@1.9.1.patch",
    );
    expect(patch).toContain("DEFAULT_MAX_DEPTH = 1024");

    type FilterToken = { name: string; value?: string };
    type FilterStream = {
      once(event: "error", listener: (error: Error) => void): FilterStream;
      write(token: FilterToken): boolean;
    };
    const FilterBase = require("stream-json/filters/FilterBase") as new (
      options: { filter: string; maxDepth: number },
    ) => FilterStream;
    class TestFilter extends FilterBase {
      _checkChunk(): boolean {
        return false;
      }
    }

    expect(() => new TestFilter({ filter: "missing", maxDepth: -1 })).toThrow(RangeError);

    const stream = new TestFilter({ filter: "missing", maxDepth: 2 });
    const errorPromise = new Promise<Error>((resolveError) => {
      stream.once("error", resolveError);
    });
    for (const token of [
      { name: "startObject" },
      { name: "keyValue", value: "a" },
      { name: "startObject" },
      { name: "keyValue", value: "b" },
      { name: "startObject" },
      { name: "keyValue", value: "c" },
    ]) {
      stream.write(token);
    }

    const error = await errorPromise;
    expect(error).toBeInstanceOf(RangeError);
    expect(error.message).toContain("maxDepth (2)");
  });

  it("ignores Codex attachment staging without deleting user files", () => {
    const gitignore = readFileSync(resolve(workspaceRoot, ".gitignore"), "utf8");
    expect(gitignore).toMatch(/^\.codex-remote-attachments\/$/mu);
  });
});
