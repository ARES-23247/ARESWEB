import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import ogRouter from "../og";

function handler(path: string, method: string) {
  const layer = ogRouter.stack.find((entry) => entry.route?.path === path && entry.route.methods[method]);
  expect(layer).toBeDefined();
  return layer!.route!.stack.at(-1)!.handle;
}

function responseDouble() {
  return {
    set: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
  };
}

async function render(query: Record<string, string> = {}, headers: Record<string, string> = {}) {
  const res = responseDouble();
  const next = vi.fn();
  await handler("/", "get")({ query, headers }, res, next);
  return { res, next };
}

describe("GET /api/og dynamic OpenGraph generator", () => {
  it("keeps an abuse limiter in front of the raster renderer", () => {
    const routeIndex = ogRouter.stack.findIndex((entry) => entry.route?.path === "/");
    expect(routeIndex).toBeGreaterThan(0);
    expect(ogRouter.stack.slice(0, routeIndex)).toHaveLength(1);
    expect(ogRouter.stack[0].route).toBeUndefined();
    expect(ogRouter.stack[0].handle).toEqual(expect.any(Function));
  });

  it("renders a crawler-compatible 1200x630 PNG with immutable cache headers", { timeout: 20_000 }, async () => {
    const { res, next } = await render();

    expect(res.set).toHaveBeenCalledWith(expect.objectContaining({
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "ETag": expect.stringMatching(/^"[A-Za-z0-9_-]{43}"$/),
    }));
    const png = res.send.mock.calls[0][0] as Buffer;
    const metadata = await sharp(png).metadata();
    expect(metadata).toMatchObject({ format: "png", width: 1200, height: 630 });
    expect(next).not.toHaveBeenCalled();
  });

  it("renders bounded custom text and strips invalid XML control characters", { timeout: 20_000 }, async () => {
    const { res, next } = await render({
      title: `${'<script>alert("xss")</script>'} & Engineering\u0001 ${"x".repeat(200)}`,
      category: "Tournament",
      author: "Lead & Coach",
      date: "Feb 2026",
      theme: "cyan",
    });

    const metadata = await sharp(res.send.mock.calls[0][0] as Buffer).metadata();
    expect(metadata).toMatchObject({ format: "png", width: 1200, height: 630 });
    expect(next).not.toHaveBeenCalled();
  });

  it("uses a full-content digest so titles with the same prefix have different ETags", { timeout: 20_000 }, async () => {
    const sharedPrefix = "This title has a deliberately shared prefix ";
    const first = await render({ title: `${sharedPrefix}alpha` });
    const second = await render({ title: `${sharedPrefix}bravo` });

    expect(first.res.set.mock.calls[0][0].ETag).not.toBe(second.res.set.mock.calls[0][0].ETag);
  });

  it("returns 304 without rendering a body when the strong ETag matches", { timeout: 20_000 }, async () => {
    const first = await render({ title: "Cached Title" });
    const etag = first.res.set.mock.calls[0][0].ETag as string;
    const second = await render({ title: "Cached Title" }, { "if-none-match": etag });

    expect(second.res.set).toHaveBeenCalledWith(expect.objectContaining({ ETag: etag }));
    expect(second.res.status).toHaveBeenCalledWith(304);
    expect(second.res.end).toHaveBeenCalled();
    expect(second.res.send).not.toHaveBeenCalled();
  });
});
