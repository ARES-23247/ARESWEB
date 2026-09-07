import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const require = createRequire(import.meta.url);
const staticRequire = createRequire(require.resolve("superstatic", { paths: [require.resolve("firebase-tools")] }));
const { server } = staticRequire("./index");
const slash = staticRequire("glob-slasher");
const { configMatcher } = staticRequire("./utils/patterns");

it("matches real Hosting security headers with URL separators on every OS", async () => {
  const path = "/games/pollen/index.html";
  expect(slash(path)).toBe(path);
  expect(configMatcher(slash(path), { source: slash("/games/pollen/**") })).toBe(true);
  const root = mkdtempSync(resolve(tmpdir(), "ares-hosting-headers-"));
  let app;
  try {
    mkdirSync(resolve(root, "games/pollen"), { recursive: true });
    writeFileSync(resolve(root, "games/pollen/index.html"), "<!doctype html><title>Header fixture</title>");
    writeFileSync(resolve(root, "index.html"), "<!doctype html><title>Site fixture</title>");
    const hosting = JSON.parse(readFileSync("firebase.json", "utf8")).hosting;
    app = server({ config: { public: ".", headers: hosting.headers }, cwd: root, port: 0, hostname: "127.0.0.1", stack: "strict" }).listen();
    await new Promise(resolve => app.once("listening", resolve));
    const origin = `http://127.0.0.1:${app.address().port}`;
    const embedded = await fetch(origin + path);
    expect(embedded.status).toBe(200);
    expect(embedded.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(embedded.headers.get("content-security-policy")).toContain("frame-ancestors 'self'");
    expect(embedded.headers.get("content-security-policy")).not.toContain("frame-ancestors 'none'");
    expect(embedded.headers.get("content-security-policy")).not.toMatch(/script-src[^;]*'unsafe-inline'/u);
    expect(embedded.headers.get("x-content-type-options")).toBe("nosniff");
    await embedded.arrayBuffer();
    const site = await fetch(origin + "/index.html");
    expect(site.headers.get("x-frame-options")).toBe("DENY");
    expect(site.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    await site.arrayBuffer();
  } finally {
    if (app) await new Promise((resolve, reject) => app.close(error => error ? reject(error) : resolve()));
    rmSync(root, { recursive: true, force: true });
  }
});
