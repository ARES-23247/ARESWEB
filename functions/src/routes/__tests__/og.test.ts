import { describe, expect, it, vi } from "vitest";
import ogRouter from "../og";

function handler(path: string, method: string) {
  const layer = ogRouter.stack.find((entry) => entry.route?.path === path && entry.route.methods[method]);
  expect(layer).toBeDefined();
  return layer!.route!.stack.at(-1)!.handle;
}

describe("GET /api/og dynamic OpenGraph generator", () => {
  it("renders a valid 1200x630 SVG social card with default values", async () => {
    const res = {
      set: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await handler("/", "get")({ query: {}, headers: {} }, res, next);

    expect(res.set).toHaveBeenCalledWith(expect.objectContaining({
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    }));

    const svg = res.send.mock.calls[0][0];
    expect(svg).toContain('<svg width="1200" height="630"');
    expect(svg).toContain("ARES 23247");
    expect(svg).toContain("aresfirst.org");
    expect(next).not.toHaveBeenCalled();
  });

  it("renders custom title, category, author, and theme", async () => {
    const res = {
      set: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await handler("/", "get")({
      query: {
        title: "2026 WV State Championship Victory",
        category: "Tournament",
        author: "David Mentor",
        date: "Feb 2026",
        theme: "cyan",
      },
      headers: {},
    }, res, next);

    const svg = res.send.mock.calls[0][0];
    expect(svg).toContain("2026 WV State Championship");
    expect(svg).toContain("TOURNAMENT");
    expect(svg).toContain("David Mentor");
    expect(svg).toContain("#00F0FF"); // Cyan theme accent
  });

  it("escapes unsafe XML characters in input parameters", async () => {
    const res = {
      set: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await handler("/", "get")({
      query: {
        title: '<script>alert("xss")</script> & Engineering',
        category: '<style>',
        author: 'Lead & Coach',
      },
      headers: {},
    }, res, next);

    const svg = res.send.mock.calls[0][0];
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
    expect(svg).toContain("&amp; Engineering");
  });

  it("returns 304 Not Modified when ETag matches", async () => {
    const res = {
      set: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    // First call to generate ETag
    await handler("/", "get")({ query: { title: "Cached Title" }, headers: {} }, res, next);
    const etag = res.set.mock.calls[0][0].ETag;

    const res2 = {
      set: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
    };

    await handler("/", "get")({
      query: { title: "Cached Title" },
      headers: { "if-none-match": etag },
    }, res2, next);

    expect(res2.status).toHaveBeenCalledWith(304);
    expect(res2.end).toHaveBeenCalled();
    expect(res2.send).not.toHaveBeenCalled();
  });
});
