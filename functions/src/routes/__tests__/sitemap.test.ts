import { beforeEach, describe, expect, it, vi } from "vitest";
import sitemapRouter, { normalizeLastModified } from "../sitemap";

const mocks = vi.hoisted(() => ({
  documents: {
    posts: [
      {
        id: "blog & post",
        data: () => ({ updatedAt: "2026-08-01T12:30:00.000Z" })
      }
    ],
    robots: [
      {
        id: "robot-1",
        data: () => ({
          updatedAt: { toDate: () => new Date("2026-07-01T10:00:00.000Z") }
        })
      }
    ],
    academy: [
      { id: "tutorial-1", data: () => ({ updatedAt: "not-a-date" }) }
    ],
    docs: [
      {
        id: "math-lesson",
        data: () => ({ displayInMathCorner: 1, publishedAt: "2026-06-01" })
      },
      {
        id: "areslib-doc",
        data: () => ({ displayInAreslib: 1, datePublished: "2026-05-01" })
      },
      {
        id: "hidden-doc",
        data: () => ({ displayInAreslib: 0 })
      }
    ],
    events: [
      { id: "event-1", data: () => ({}) }
    ]
  } as Record<string, Array<{ id: string; data: () => Record<string, unknown> }>>,
  queries: new Map<string, {
    where: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  }>(),
  failCollection: null as string | null
}));

vi.mock("../../lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn((collectionName: string) => {
      const query = {
        where: vi.fn(),
        limit: vi.fn(),
        get: vi.fn(async () => {
          if (mocks.failCollection === collectionName) {
            throw new Error("Firestore unavailable");
          }
          return {
            forEach: (callback: (doc: { id: string; data: () => Record<string, unknown> }) => void) => {
              mocks.documents[collectionName]?.forEach(callback);
            }
          };
        })
      };
      query.where.mockReturnValue(query);
      query.limit.mockReturnValue(query);
      mocks.queries.set(collectionName, query);
      return query;
    })
  }
}));

function getHandler() {
  const routeLayer = sitemapRouter.stack.find(
    (layer) => layer.route && layer.route.path === "/"
  );
  expect(routeLayer).toBeDefined();
  return routeLayer!.route!.stack[0].handle;
}

describe("sitemap route", () => {
  let res: {
    setHeader: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
  };
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queries.clear();
    mocks.failCollection = null;
    res = { setHeader: vi.fn(), send: vi.fn() };
    next = vi.fn();
  });

  it("returns bounded, cached XML with only real last-modified values", async () => {
    await getHandler()({}, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/xml; charset=utf-8");
    expect(res.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"
    );

    const xml = res.send.mock.calls[0][0] as string;
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain("<loc>https://aresfirst.org/</loc>");
    expect(xml).toContain("<loc>https://aresfirst.org/tournaments</loc>");
    expect(xml).toContain("<loc>https://aresfirst.org/blog/blog%20%26%20post</loc>");
    expect(xml).toContain("<lastmod>2026-08-01T12:30:00.000Z</lastmod>");
    expect(xml).toContain("<loc>https://aresfirst.org/robots/robot-1</loc>");
    expect(xml).toContain("<lastmod>2026-07-01T10:00:00.000Z</lastmod>");
    expect(xml).toContain("<loc>https://aresfirst.org/academy/tutorial-1</loc>");
    expect(xml).toContain("<loc>https://aresfirst.org/academy/math-lesson</loc>");
    expect(xml).toContain("<loc>https://aresfirst.org/docs/areslib-doc</loc>");
    expect(xml).not.toContain("hidden-doc");
    expect(xml).toContain("<loc>https://aresfirst.org/events/event-1</loc>");
    expect(xml).toContain("</urlset>");

    expect(mocks.queries.size).toBe(5);
    for (const query of mocks.queries.values()) {
      expect(query.limit).toHaveBeenCalledWith(500);
    }
  });

  it("forwards a diagnosable 503 instead of returning a partial sitemap", async () => {
    mocks.failCollection = "events";

    await getHandler()({}, res, next);

    expect(res.send).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 503,
      code: "SITEMAP_QUERY_FAILED",
      message: "Sitemap is temporarily unavailable."
    }));
  });
});

describe("normalizeLastModified", () => {
  it("normalizes supported date values", () => {
    expect(normalizeLastModified("2026-08-10")).toBe("2026-08-10T00:00:00.000Z");
    expect(normalizeLastModified(new Date("2026-08-11T02:03:04.000Z"))).toBe("2026-08-11T02:03:04.000Z");
    expect(normalizeLastModified({ toDate: () => new Date("2026-08-12T00:00:00.000Z") }))
      .toBe("2026-08-12T00:00:00.000Z");
  });

  it("omits invalid or unsafe values", () => {
    expect(normalizeLastModified("not-a-date")).toBeUndefined();
    expect(normalizeLastModified(1234)).toBeUndefined();
    expect(normalizeLastModified({ toDate: () => { throw new Error("invalid timestamp"); } }))
      .toBeUndefined();
  });
});
