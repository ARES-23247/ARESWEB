import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("retired telemetry ingestion copy", () => {
  it("does not advertise the retired upload feature on public pages", () => {
    const homePage = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");
    const techStackPage = readFileSync(resolve(process.cwd(), "src/app/tech-stack/page.tsx"), "utf8");

    expect(homePage).not.toMatch(
      /Hardware Telemetry Ingestion|Secure Endpoint Active|\/api\/upload|telemetry diagnostics/i,
    );
    expect(techStackPage).not.toMatch(
      /robotic log analytics|local logs and telemetry frames|full offline execution/i,
    );
  });
});
