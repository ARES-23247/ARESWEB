import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface HostingHeaderRule {
  source: string;
  headers: Array<{ key: string; value: string }>;
}

describe("Firebase Hosting crawl configuration", () => {
  it("does not allow inline executable scripts", () => {
    const config = JSON.parse(
      readFileSync(resolve(process.cwd(), "firebase.json"), "utf8"),
    ) as { hosting: { headers: HostingHeaderRule[] } };
    const broadRule = config.hosting.headers.find((rule) => rule.source === "/!(assets){,/**}");
    const csp = broadRule?.headers.find((header) => header.key === "Content-Security-Policy")?.value;
    const indexHtml = readFileSync(resolve(process.cwd(), "index.html"), "utf8");

    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).toContain("object-src 'none'");
    expect(indexHtml).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/i);
  });

  it("applies the exact sitemap cache policy after the broad app-shell policy", () => {
    const config = JSON.parse(
      readFileSync(resolve(process.cwd(), "firebase.json"), "utf8"),
    ) as { hosting: { headers: HostingHeaderRule[] } };
    const broadRuleIndex = config.hosting.headers.findIndex((rule) => rule.source === "/!(assets){,/**}");
    const sitemapRuleIndex = config.hosting.headers.findIndex((rule) => rule.source === "/sitemap.xml");
    const sitemapRule = config.hosting.headers[sitemapRuleIndex];

    expect(broadRuleIndex).toBeGreaterThanOrEqual(0);
    expect(sitemapRuleIndex).toBeGreaterThan(broadRuleIndex);
    expect(sitemapRule.headers).toContainEqual({
      key: "Cache-Control",
      value: "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    });
  });
});
