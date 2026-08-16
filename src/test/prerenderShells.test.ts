import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderStaticShell, staticPageMetadata } from "../../scripts/prerender-static-routes.mjs";

type RouteSection = [string, string];
type RouteMetadata =
  | [route: string, title: string, description: string]
  | [route: string, title: string, description: string, noindex: boolean]
  | [route: string, title: string, description: string, noindex: boolean, sections: RouteSection[]];

type ShellInput = Parameters<typeof renderStaticShell>[1];
const cast = (m: RouteMetadata) => m as unknown as ShellInput;
const routes = staticPageMetadata as unknown as RouteMetadata[];

const shell = readFileSync(resolve(process.cwd(), "index.html"), "utf8");

function bodyText(html: string) {
  const start = html.indexOf('<div id="root">');
  const end = html.lastIndexOf("</body>");
  const root = html.slice(start, end);
  return root.toLowerCase().replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

describe("prerendered route shells", () => {
  it("gives every non-home route unique crawlable body content", () => {
    const bodies = new Map();
    for (const metadata of routes) {
      const html = renderStaticShell(shell, cast(metadata));
      const body = bodyText(html);
      if (metadata[0] === "/") continue;
      expect(body.length, `${metadata[0]} body is too thin to avoid soft-404 classification`).toBeGreaterThan(200);
      for (const [route, existing] of bodies) {
        expect(body, `${metadata[0]} duplicates the shell body of ${route}`).not.toBe(existing);
      }
      bodies.set(metadata[0], body);
      expect(html).toContain(`<h1>${metadata[1].replace(/&/g, "&amp;")}</h1>`);
    }
    expect(bodies.size).toBe(routes.length - 1);
  });

  it("keeps the rich homepage fallback body for the home shell only", () => {
    const home = renderStaticShell(shell, cast(routes[0]));
    expect(bodyText(home)).toContain("ares analytics");
    const other = renderStaticShell(shell, cast(routes.find((m) => m[0] === "/about")!));
    expect(bodyText(other)).not.toContain("ares analytics");
  });

  it("emits each route's canonical URL and respects the noindex flag", () => {
    for (const metadata of routes) {
      const html = renderStaticShell(shell, cast(metadata));
      expect(html).toContain(`rel="canonical" href="https://aresfirst.org${metadata[0]}"`);
      expect(html.includes('name="robots"')).toBe(metadata.length > 3 && metadata[3] === true);
    }
  });
});
