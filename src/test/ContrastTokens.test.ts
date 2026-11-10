import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      results.push(...collectSourceFiles(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      results.push(fullPath);
    }
  }
  return results;
}

function luminance(hex: string) {
  const channels = hex.match(/[0-9a-f]{2}/gi)?.map((channel) => Number.parseInt(channel, 16) / 255);
  if (!channels || channels.length !== 3) throw new Error(`Invalid color: ${hex}`);
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first: string, second: string) {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("semantic contrast tokens", () => {
  const contract = JSON.parse(
    readFileSync(join(process.cwd(), "design", "ares-design-tokens.json"), "utf8"),
  ) as {
    brand: Record<string, string>;
    semanticDark: Record<string, string>;
    accessibility: { normalTextMinimumContrast: number };
  };

  it("keeps CSS brand and semantic tokens synchronized with the shared contract", () => {
    const css = readFileSync(join(process.cwd(), "src", "styles", "ares-design-tokens.css"), "utf8");
    const globalCss = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");
    const cssToken = (name: string) => {
      const value = css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
      if (!value) throw new Error(`Missing concrete ${name} token`);
      return value.toUpperCase();
    };

    expect(cssToken("ares-red")).toBe(contract.brand.red);
    expect(cssToken("ares-red-light")).toBe(contract.brand.redReadableOnDark);
    expect(cssToken("ares-bronze")).toBe(contract.brand.bronze);
    expect(cssToken("ares-gold")).toBe(contract.brand.gold);
    expect(cssToken("ares-cyan")).toBe(contract.brand.technicalCyan);
    expect(cssToken("obsidian")).toBe(contract.brand.obsidian);
    expect(cssToken("marble")).toBe(contract.brand.marble);
    expect(cssToken("ares-on-bright-accent")).toBe(contract.semanticDark.onBrightAccent);
    expect(cssToken("ares-danger")).toBe(contract.semanticDark.error);
    expect(cssToken("ares-success")).toBe(contract.semanticDark.success);
    expect(globalCss).toContain('@import "../styles/ares-design-tokens.css";');
  });

  it("keeps text red readable on obsidian and brand red readable on marble", () => {
    const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");

    expect(
      contrastRatio(contract.brand.redReadableOnDark, contract.brand.obsidian),
    ).toBeGreaterThanOrEqual(contract.accessibility.normalTextMinimumContrast);
    expect(contrastRatio(contract.brand.red, contract.brand.marble)).toBeGreaterThanOrEqual(
      contract.accessibility.normalTextMinimumContrast,
    );
    expect(css).toContain(".bg-obsidian .text-ares-red");
    expect(css).toContain(".marble-band .text-ares-red");
    expect(css).toContain("outline: 2px solid var(--ares-cyan) !important");
  });

  it("uses dark text on every bright shared action and status fill", () => {
    const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");

    for (const [name, fill] of Object.entries({
      technicalCyan: contract.brand.technicalCyan,
      gold: contract.brand.gold,
      bronze: contract.brand.bronze,
      error: contract.semanticDark.error,
      warning: contract.semanticDark.warning,
      success: contract.semanticDark.success,
    })) {
      expect(
        contrastRatio(contract.semanticDark.onBrightAccent, fill),
        `${name} must remain readable with the shared bright-accent foreground`,
      ).toBeGreaterThanOrEqual(contract.accessibility.normalTextMinimumContrast);
    }

    expect(css).toContain('.clipped-button:hover:not([class*="hover:text-"])');
    expect(css).toContain('.clipped-button-sm:hover:not([class*="hover:text-"])');
    expect(css).toContain('.hover\\:bg-ares-bronze:hover:not([class*="hover:text-"])');
    expect(css).toContain("color: var(--ares-on-bright-accent);");
  });

  it("forbids arbitrary hex Tailwind color classes across src/app and src/components", () => {
    const files = [
      ...collectSourceFiles(join(process.cwd(), "src", "app")),
      ...collectSourceFiles(join(process.cwd(), "src", "components")),
    ];
    const forbiddenPattern = /(bg-\[#[0-9a-f]{3,8}\]|text-\[#[0-9a-f]{3,8}\]|border-\[#[0-9a-f]{3,8}\]|#fa6831|#e05620|#07343b|#3d2b00)/i;
    const violations: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, "utf8");
      const match = content.match(forbiddenPattern);
      if (match) {
        violations.push(`${file}: ${match[0]}`);
      }
    }

    expect(violations).toEqual([]);
  });
});
