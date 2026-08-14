import { beforeEach, describe, expect, it, vi } from "vitest";

const getDocsMock = vi.fn();

vi.mock("../../lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn(() => ({
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnValue({
        get: () => getDocsMock(),
      }),
    })),
  },
}));

import feedRouter from "../feed";

describe("RSS / Atom Feed Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serves an RSS 2.0 XML document for published posts", async () => {
    getDocsMock.mockResolvedValue({
      docs: [
        {
          id: "world-championship-qualification",
          data: () => ({
            title: "World Championship Qualification & Recap",
            snippet: "ARES 23247 qualified for the FIRST World Championship!",
            author: "ARES Robotics",
            createdAt: "2026-04-10T12:00:00Z",
          }),
        },
      ],
    });

    const handler = feedRouter.stack.find(
      (layer: { route?: { path: string | string[] } }) =>
        layer.route &&
        (Array.isArray(layer.route.path) ? layer.route.path.includes("/feed.xml") : layer.route.path === "/feed.xml"),
    )?.route?.stack?.[0]?.handle;

    expect(handler).toBeDefined();

    const req = {} as any;
    const res = {
      setHeader: vi.fn(),
      send: vi.fn(),
    } as any;
    const next = vi.fn();

    await handler(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/rss+xml; charset=utf-8");
    const xml = res.send.mock.calls[0][0] as string;
    expect(xml).toContain("<rss version=\"2.0\"");
    expect(xml).toContain("<title>World Championship Qualification &amp; Recap</title>");
    expect(xml).toContain("<link>https://aresfirst.org/blog/world-championship-qualification</link>");
    expect(xml).toContain("ARES 23247 qualified for the FIRST World Championship!");
  });
});
