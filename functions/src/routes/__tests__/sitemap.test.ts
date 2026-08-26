import { beforeEach, describe, expect, it, vi } from "vitest";
import sitemapRouter, {
  buildSitemapXml,
  isSitemapRecordIndexable,
  normalizeLastModified,
  refreshSitemapArtifact,
} from "../sitemap";

const mocks = vi.hoisted(() => ({
  documents: {
    posts: [
      {
        id: "blog & post",
        data: () => ({ updatedAt: "2026-08-01T12:30:00.000Z" })
      },
      { id: "test-blog-post", data: () => ({}) },
      { id: "system-error-wip", data: () => ({}) },
      { id: "screen-recording-2026-04-07", data: () => ({}) },
      { id: "contest-strategy", data: () => ({}) },
      { id: "approved-story", data: () => ({ searchIndexable: false }) }
    ],
    robots: [
      {
        id: "robot-1",
        data: () => ({
          updatedAt: { toDate: () => new Date("2026-07-01T10:00:00.000Z") }
        })
      }
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
      { id: "event-1", data: () => ({}) },
      { id: "event_1781817293896", data: () => ({}) },
      { id: "test-event-1", data: () => ({}) }
    ]
  } as Record<string, Array<{ id: string; data: () => Record<string, unknown> }>>,
  queries: new Map<string, {
    where: ReturnType<typeof vi.fn>;
    orderBy: ReturnType<typeof vi.fn>;
    startAfter: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  }>(),
  failCollection: null as string | null,
  cachedArtifact: null as null | {
    body: string;
    contentType: string;
    generatedAt: string;
    etag: string;
  },
  writeArtifact: vi.fn(),
}));

vi.mock("../../lib/publicArtifactCache", () => ({
  readPublicArtifact: vi.fn(async () => mocks.cachedArtifact),
  writePublicArtifact: mocks.writeArtifact,
}));

vi.mock("../../lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn((collectionName: string) => {
      let cursorId: string | null = null;
      let requestedLimit = 250;
      const query = {
        where: vi.fn(),
        orderBy: vi.fn(),
        startAfter: vi.fn((document: { id: string }) => {
          cursorId = document.id;
          return query;
        }),
        limit: vi.fn((value: number) => {
          requestedLimit = value;
          return query;
        }),
        get: vi.fn(async () => {
          if (mocks.failCollection === collectionName) {
            throw new Error("Firestore unavailable");
          }
          const documents = mocks.documents[collectionName] ?? [];
          const cursorIndex = cursorId === null
            ? -1
            : documents.findIndex((document) => document.id === cursorId);
          return { docs: documents.slice(cursorIndex + 1, cursorIndex + 1 + requestedLimit) };
        })
      };
      query.where.mockReturnValue(query);
      query.orderBy.mockReturnValue(query);
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
    status: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
  };
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queries.clear();
    mocks.failCollection = null;
    mocks.cachedArtifact = null;
    mocks.writeArtifact.mockResolvedValue(undefined);
    res = {
      setHeader: vi.fn(),
      send: vi.fn(),
      status: vi.fn().mockReturnThis(),
      end: vi.fn(),
    };
    next = vi.fn();
  });

  it("returns bounded, cached XML with only real last-modified values", async () => {
    const generatedXml = await buildSitemapXml();
    mocks.cachedArtifact = {
      body: generatedXml,
      contentType: "application/xml; charset=utf-8",
      generatedAt: "2026-08-26T00:00:00.000Z",
      etag: '"durable-etag"',
    };
    const sourceReads = [...mocks.queries.values()].reduce(
      (sum, query) => sum + query.get.mock.calls.length,
      0,
    );
    await getHandler()({ get: vi.fn() }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/xml; charset=utf-8");
    expect(res.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400"
    );
    expect(res.setHeader).toHaveBeenCalledWith("ETag", '"durable-etag"');

    const xml = res.send.mock.calls[0][0] as string;
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain("<loc>https://aresfirst.org/</loc>");
    expect(xml).toContain("<loc>https://aresfirst.org/leaderboard</loc>");
    expect(xml).toContain("<loc>https://aresfirst.org/store</loc>");
    expect(xml).toContain("<loc>https://aresfirst.org/docs</loc>");
    expect(xml).toContain("<loc>https://aresfirst.org/tournaments</loc>");
    expect(xml).toContain("<loc>https://aresfirst.org/blog/blog%20%26%20post</loc>");
    expect(xml).toContain("<lastmod>2026-08-01T12:30:00.000Z</lastmod>");
    expect(xml).toContain("<loc>https://aresfirst.org/robots/robot-1</loc>");
    expect(xml).toContain("<lastmod>2026-07-01T10:00:00.000Z</lastmod>");
    expect(xml).toContain("<loc>https://aresfirst.org/academy/math-lesson</loc>");
    expect(xml).toContain("<loc>https://aresfirst.org/docs/areslib-doc</loc>");
    expect(xml).not.toContain("hidden-doc");
    expect(xml).toContain("<loc>https://aresfirst.org/events/event-1</loc>");
    expect(xml).toContain("<loc>https://aresfirst.org/blog/contest-strategy</loc>");
    expect(xml).not.toContain("test-blog-post");
    expect(xml).not.toContain("system-error-wip");
    expect(xml).not.toContain("screen-recording-2026-04-07");
    expect(xml).not.toContain("approved-story");
    expect(xml).not.toContain("e2e-test-quick-start");
    expect(xml).not.toContain("event_1781817293896");
    expect(xml).not.toContain("test-event-1");
    expect(xml).toContain("</urlset>");

    expect(mocks.queries.size).toBe(4);
    for (const query of mocks.queries.values()) {
      expect(query.orderBy).toHaveBeenCalledWith(expect.anything(), "asc");
      expect(query.limit).toHaveBeenCalledWith(250);
    }
    expect([...mocks.queries.values()].reduce(
      (sum, query) => sum + query.get.mock.calls.length,
      0,
    )).toBe(sourceReads);
  });

  it("reads deterministic query pages beyond the former 500-record ceiling", async () => {
    const originalPosts = mocks.documents.posts;
    mocks.documents.posts = Array.from({ length: 501 }, (_, index) => ({
      id: `published-post-${String(index).padStart(3, "0")}`,
      data: () => ({ updatedAt: "2026-08-01T12:30:00.000Z" }),
    }));

    try {
      const xml = await buildSitemapXml();
      expect(xml).toContain("/blog/published-post-500</loc>");
      const postsQuery = mocks.queries.get("posts")!;
      expect(postsQuery.get).toHaveBeenCalledTimes(3);
      expect(postsQuery.startAfter).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ id: "published-post-249" }),
      );
      expect(postsQuery.startAfter).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ id: "published-post-499" }),
      );
    } finally {
      mocks.documents.posts = originalPosts;
    }
  });

  it("stops at the per-collection safety cap before the sitemap protocol limit", async () => {
    const originalPosts = mocks.documents.posts;
    mocks.documents.posts = Array.from({ length: 5_001 }, (_, index) => ({
      id: `bounded-post-${String(index).padStart(4, "0")}`,
      data: () => ({}),
    }));

    try {
      const xml = await buildSitemapXml();
      expect(xml).toContain("/blog/bounded-post-4999</loc>");
      expect(xml).not.toContain("/blog/bounded-post-5000</loc>");
      const postsQuery = mocks.queries.get("posts")!;
      expect(postsQuery.get).toHaveBeenCalledTimes(21);
      expect(postsQuery.limit).toHaveBeenLastCalledWith(1);
    } finally {
      mocks.documents.posts = originalPosts;
    }
  });

  it("forwards a diagnosable 503 instead of returning a partial sitemap", async () => {
    mocks.failCollection = "events";

    await expect(buildSitemapXml()).rejects.toEqual(expect.objectContaining({
      status: 503,
      code: "SITEMAP_QUERY_FAILED",
      message: "Sitemap is temporarily unavailable."
    }));
  });

  it("serves the static inventory without scanning source collections when the artifact is absent", async () => {
    await getHandler()({ get: vi.fn() }, res, next);

    expect(res.send).toHaveBeenCalledWith(expect.stringContaining("<loc>https://aresfirst.org/</loc>"));
    expect(res.send).toHaveBeenCalledWith(expect.not.stringContaining("/blog/blog%20%26%20post"));
    expect(mocks.queries.size).toBe(0);
  });

  it("refreshes the durable artifact only from the scheduled build path", async () => {
    await refreshSitemapArtifact();

    expect(mocks.writeArtifact).toHaveBeenCalledWith(
      "sitemap",
      expect.stringContaining("/blog/blog%20%26%20post"),
      "application/xml; charset=utf-8",
    );
  });
});

describe("isSitemapRecordIndexable", () => {
  it.each([
    "test",
    "test1",
    "test-blog-post",
    "video-embed-test",
    "e2e-valid-slug-123",
    "fixture_event",
    "system-error-wip",
    "event_1781817293896",
    "screen-recording-2026-04-07-110546",
  ])("rejects the non-production identifier %s", (id) => {
    expect(isSitemapRecordIndexable(id)).toBe(false);
  });

  it.each([
    "contest-strategy",
    "latest-news",
    "testing-robot-code",
    "event-2026-championship",
  ])("does not reject the legitimate identifier %s", (id) => {
    expect(isSitemapRecordIndexable(id)).toBe(true);
  });

  it("honors an explicit record-level search opt-out", () => {
    expect(isSitemapRecordIndexable("published-story", { searchIndexable: false })).toBe(false);
    expect(isSitemapRecordIndexable("published-story", { searchIndexable: true })).toBe(true);
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
