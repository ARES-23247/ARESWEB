import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Mechanical enforcement of the coverage ratchet: AGENTS.md requires 85% line
 * and 100% function coverage for new utilities, but the coverage include list
 * in vite.config.ts is hand-maintained. This test fails when a NEW file under
 * src/lib is absent from that list, so its coverage becomes enforced instead
 * of invisible. Legacy modules predating the ratchet are exempt only by
 * appearing in the snapshot below; remove entries as they are onboarded.
 */
const LEGACY_EXEMPT_LIB = new Set([
  "financeCsv.ts",
  "firebaseAuth.ts",
  "firebaseCore.ts",
  "firebaseDevBootstrap.ts",
  "firebaseEnvironment.ts",
  "firebaseFirestore.ts",
  "firebaseFirestoreEmulator.ts",
  "googleDrivePicker.ts",
  "image.ts",
  "media.ts",
  "site-config.ts",
  "tournamentMatchCsv.ts",
  "tournamentScoutingCsv.ts",
  "useFocusTrap.ts",
  "utils.ts",
]);

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\/\*/g, "[^/]+/[^/]+")
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, "[^/]*")
    .replace(
      /\{([^}]+)\}/g,
      (_match, group: string) =>
        `(?:${group
          .split(",")
          .map((part) => part.trim())
          .join("|")})`,
    );
  return new RegExp(`^${escaped}$`);
}

function coverageIncludeList(): string[] {
  const config = readFileSync(resolve(process.cwd(), "vite.config.ts"), "utf8");
  const includeBlock =
    config.match(/coverage:\s*\{[\s\S]*?include:\s*\[([\s\S]*?)\]/)?.[1] ?? "";
  if (!includeBlock)
    throw new Error("vite.config.ts coverage include list not found");
  return [...includeBlock.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

describe("coverage ratchet inventory", () => {
  it("requires every src/lib module to be covered or deliberately exempt", () => {
    const includes = coverageIncludeList();
    const libFiles = readdirSync(resolve(process.cwd(), "src/lib")).filter(
      (file) => file.endsWith(".ts") && !file.endsWith(".test.ts"),
    );

    expect(libFiles.length).toBeGreaterThan(10);
    const violations: string[] = [];
    for (const file of libFiles) {
      const path = `src/lib/${file}`;
      const listed = includes.some((pattern) =>
        globToRegExp(pattern).test(path),
      );
      if (!listed && !LEGACY_EXEMPT_LIB.has(file)) {
        violations.push(
          `${path} is new but missing from vite.config.ts coverage.include — add it (and tests) or consciously record it as legacy-exempt`,
        );
      }
      if (listed && LEGACY_EXEMPT_LIB.has(file)) {
        violations.push(
          `${path} is covered by the include list; remove its stale legacy exemption`,
        );
      }
    }
    expect(violations).toEqual([]);
  });

  it("does not silently drop legacy exemptions from the snapshot", () => {
    const includes = coverageIncludeList();
    for (const file of LEGACY_EXEMPT_LIB) {
      const path = `src/lib/${file}`;
      if (includes.some((pattern) => globToRegExp(pattern).test(path))) {
        throw new Error(`${path} is listed; update the snapshot in this test`);
      }
    }
  });
});
