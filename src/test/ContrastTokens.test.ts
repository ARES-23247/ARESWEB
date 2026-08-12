import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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
  it("keeps text red readable on obsidian and brand red readable on white", () => {
    const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");
    const token = (name: string) => {
      const value = css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
      if (!value) throw new Error(`Missing concrete ${name} token`);
      return value;
    };

    expect(contrastRatio(token("ares-red-light"), token("obsidian"))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(token("ares-red"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(css).toContain(".bg-obsidian .text-ares-red");
    expect(css).toContain("outline: 2px solid var(--ares-cyan) !important");
  });
});
