import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface HostingHeaderRule {
  source: string;
  headers: Array<{ key: string; value: string }>;
}

interface HostingRewrite {
  source: string;
  destination?: string;
  function?: string;
}

describe("Firebase Hosting crawl configuration", () => {
  it("keeps the raw and prerendered homepage identified as the ARES team", () => {
    const indexHtml = readFileSync(
      resolve(process.cwd(), "index.html"),
      "utf8",
    );
    const prerenderSource = readFileSync(
      resolve(process.cwd(), "scripts/prerender-static-routes.mjs"),
      "utf8",
    );

    expect(indexHtml).toContain(
      "<title>ARES 23247 | West Virginia Robotics Team (Morgantown, WV)</title>",
    );
    expect(indexHtml).toContain(
      "<h1>ARES 23247 — West Virginia Robotics Team in Morgantown</h1>",
    );
    expect(indexHtml).not.toContain("<title>ARES Analytics</title>");
    expect(indexHtml).toMatch(
      /rel="alternate"\s+type="application\/rss\+xml"/u,
    );
    expect(prerenderSource).toContain(
      '? "ARES 23247 | West Virginia Robotics Team (Morgantown, WV)"',
    );
  });

  it("does not allow inline executable scripts", () => {
    const config = JSON.parse(
      readFileSync(resolve(process.cwd(), "firebase.json"), "utf8"),
    ) as { hosting: { headers: HostingHeaderRule[] } };
    const broadRule = config.hosting.headers.find(
      (rule) => rule.source === "/!(assets){,/**}",
    );
    const csp = broadRule?.headers.find(
      (header) => header.key === "Content-Security-Policy",
    )?.value;
    const indexHtml = readFileSync(
      resolve(process.cwd(), "index.html"),
      "utf8",
    );

    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).toContain("script-src-attr 'none'");
    expect(csp).toContain(
      "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com",
    );
    expect(csp).toContain("style-src-attr 'unsafe-inline'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).toContain("object-src 'none'");
    expect(indexHtml).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/i);
  });

  it("applies the exact sitemap cache policy after the broad app-shell policy", () => {
    const config = JSON.parse(
      readFileSync(resolve(process.cwd(), "firebase.json"), "utf8"),
    ) as { hosting: { headers: HostingHeaderRule[] } };
    const broadRuleIndex = config.hosting.headers.findIndex(
      (rule) => rule.source === "/!(assets){,/**}",
    );
    const sitemapRuleIndex = config.hosting.headers.findIndex(
      (rule) => rule.source === "/sitemap.xml",
    );
    const sitemapRule = config.hosting.headers[sitemapRuleIndex];

    expect(broadRuleIndex).toBeGreaterThanOrEqual(0);
    expect(sitemapRuleIndex).toBeGreaterThan(broadRuleIndex);
    expect(sitemapRule.headers).toContainEqual({
      key: "Cache-Control",
      value: "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    });
  });

  it("applies the bounded feed cache policy after the broad app-shell policy", () => {
    const config = JSON.parse(
      readFileSync(resolve(process.cwd(), "firebase.json"), "utf8"),
    ) as { hosting: { headers: HostingHeaderRule[] } };
    const broadRuleIndex = config.hosting.headers.findIndex(
      (rule) => rule.source === "/!(assets){,/**}",
    );

    for (const source of ["/feed.xml", "/api/feed.xml"]) {
      const ruleIndex = config.hosting.headers.findIndex(
        (rule) => rule.source === source,
      );
      expect(ruleIndex).toBeGreaterThan(broadRuleIndex);
      expect(config.hosting.headers[ruleIndex].headers).toEqual(
        expect.arrayContaining([
          {
            key: "Cache-Control",
            value:
              "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ]),
      );
    }
  });

  it("allows immutable caching only for query-addressed raster social cards", () => {
    const config = JSON.parse(
      readFileSync(resolve(process.cwd(), "firebase.json"), "utf8"),
    ) as {
      hosting: { headers: HostingHeaderRule[]; rewrites: HostingRewrite[] };
    };
    const broadRuleIndex = config.hosting.headers.findIndex(
      (rule) => rule.source === "/!(assets){,/**}",
    );
    const ogRuleIndex = config.hosting.headers.findIndex(
      (rule) => rule.source === "/api/og",
    );
    const ogRule = config.hosting.headers[ogRuleIndex];

    expect(ogRuleIndex).toBeGreaterThan(broadRuleIndex);
    expect(ogRule.headers).toContainEqual({
      key: "Cache-Control",
      value: "public, max-age=86400, s-maxage=31536000, immutable",
    });
    expect(config.hosting.rewrites).toContainEqual({
      source: "/api/og{,/**}",
      function: "publicApi",
    });
  });

  it("applies a bounded public media cache policy after the broad no-store policy", () => {
    const config = JSON.parse(
      readFileSync(resolve(process.cwd(), "firebase.json"), "utf8"),
    ) as { hosting: { headers: HostingHeaderRule[] } };
    const broadRuleIndex = config.hosting.headers.findIndex(
      (rule) => rule.source === "/!(assets){,/**}",
    );
    const mediaRuleIndex = config.hosting.headers.findIndex(
      (rule) => rule.source === "/api/photos/public/media/**",
    );
    const mediaRule = config.hosting.headers[mediaRuleIndex];

    expect(broadRuleIndex).toBeGreaterThanOrEqual(0);
    expect(mediaRuleIndex).toBeGreaterThan(broadRuleIndex);
    expect(mediaRule.headers).toContainEqual({
      key: "Cache-Control",
      value: "public, max-age=300, s-maxage=300, must-revalidate",
    });
    expect(mediaRule.headers).not.toContainEqual(
      expect.objectContaining({ value: expect.stringContaining("immutable") }),
    );
  });

  it("routes each API family to a narrowly secret-bound function", () => {
    const config = JSON.parse(
      readFileSync(resolve(process.cwd(), "firebase.json"), "utf8"),
    ) as { hosting: { rewrites: HostingRewrite[] } };
    const rewriteMap = new Map(
      config.hosting.rewrites.map((rewrite) => [
        rewrite.source,
        rewrite.function,
      ]),
    );

    expect(rewriteMap.get("/api/photos{,/**}")).toBe("mediaApi");
    expect(rewriteMap.get("/api/profiles{,/**}")).toBe("coreApi");
    expect(rewriteMap.get("/api/tasks{,/**}")).toBe("communicationsApi");
    expect(rewriteMap.get("/api/robots{,/**}")).toBe("publicApi");
    expect(rewriteMap.get("/api/og{,/**}")).toBe("publicApi");
    expect(rewriteMap.get("/feed.xml")).toBe("publicApi");
    expect(rewriteMap.get("/api/feed.xml")).toBe("publicApi");
    expect(rewriteMap.get("/api/**")).toBe("publicApi");
  });

  it("has no SPA catch-all and sends dynamic public records through the 404-aware renderer", () => {
    const config = JSON.parse(
      readFileSync(resolve(process.cwd(), "firebase.json"), "utf8"),
    ) as { hosting: { rewrites: HostingRewrite[] } };

    expect(config.hosting.rewrites).not.toContainEqual(
      expect.objectContaining({ source: "**" }),
    );
    for (const source of [
      "/blog/**",
      "/academy/**",
      "/docs/**",
      "/events/**",
      "/robots/**",
    ]) {
      expect(config.hosting.rewrites).toContainEqual({
        source,
        function: "web",
      });
    }
    expect(config.hosting.rewrites).toContainEqual({
      source: "/__deployment-health/web",
      function: "web",
    });
    expect(config.hosting.rewrites).toContainEqual({
      source: "/dashboard{,/**}",
      destination: "/index.html",
    });

    const viteConfig = readFileSync(
      resolve(process.cwd(), "vite.config.ts"),
      "utf8",
    );
    expect(viteConfig).toContain("navigateFallbackAllowlist");
    expect(viteConfig).not.toContain("navigateFallbackDenylist");
    expect(viteConfig).not.toMatch(
      /navigateFallbackAllowlist:[\s\S]{0,500}blog/,
    );
  });

  it("keeps the analytics loader and the CSP in sync", () => {
    const config = JSON.parse(
      readFileSync(resolve(process.cwd(), "firebase.json"), "utf8"),
    ) as { hosting: { headers: HostingHeaderRule[] } };
    const csp = config.hosting.headers
      .find((rule) => rule.source === "/!(assets){,/**}")
      ?.headers.find((header) => header.key === "Content-Security-Policy")
      ?.value;
    const envProduction = readFileSync(
      resolve(process.cwd(), ".env.production"),
      "utf8",
    );
    const analyticsTracker = readFileSync(
      resolve(process.cwd(), "src/components/AnalyticsTracker.tsx"),
      "utf8",
    );
    const analyticsActive =
      /NEXT_PUBLIC_GA_MEASUREMENT_ID=G-[A-Z0-9]+/.test(envProduction) &&
      analyticsTracker.includes("googletagmanager.com");

    // GA is either fully allowed by the CSP or fully removed from the build.
    expect(analyticsActive).toBe(true);
    expect(csp).toContain("https://www.googletagmanager.com");
    expect(csp).toContain("https://*.google-analytics.com");
  });

  it("blocks tournaments routes from indexing at the hosting layer", () => {
    const config = JSON.parse(
      readFileSync(resolve(process.cwd(), "firebase.json"), "utf8"),
    ) as { hosting: { headers: HostingHeaderRule[] } };
    const tournamentsRule = config.hosting.headers.find(
      (rule) => rule.source === "/tournaments{,/**}",
    );

    expect(tournamentsRule?.headers).toContainEqual({
      key: "X-Robots-Tag",
      value: "noindex, nofollow",
    });
  });

  it("replaces rather than duplicates the source canonical in prerendered shells", () => {
    const prerenderSource = readFileSync(
      resolve(process.cwd(), "scripts/prerender-static-routes.mjs"),
      "utf8",
    );

    // The source canonical must be stripped before the route canonical is
    // injected, and the build must fail on any shell emitting two canonicals.
    expect(prerenderSource).toContain(
      'rel=["\']canonical["\'][^>]*>/i, ""',
    );
    expect(prerenderSource).toContain("canonical tags");
  });

  it("keeps known static routes synchronized with the prerender build", () => {    const config = JSON.parse(
      readFileSync(resolve(process.cwd(), "firebase.json"), "utf8"),
    ) as { hosting: { rewrites: HostingRewrite[] } };
    const prerenderSource = readFileSync(
      resolve(process.cwd(), "scripts/prerender-static-routes.mjs"),
      "utf8",
    );
    const routes = [...prerenderSource.matchAll(/^\s*\["(\/[^"]*)",/gm)].map(
      (match) => match[1],
    );

    expect(routes.length).toBeGreaterThan(20);
    for (const route of routes) {
      const filename =
        route === "/" ? "home" : route.slice(1).replaceAll("/", "-");
      expect(config.hosting.rewrites).toContainEqual({
        source: route,
        destination: `/prerender/${filename}.html`,
      });
    }
  });
});
