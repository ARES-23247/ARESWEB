import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  collection: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  get: vi.fn(),
}));

vi.mock("../../lib/firebase-admin", () => {
  const query = {
    where: mocks.where,
    orderBy: mocks.orderBy,
    limit: mocks.limit,
    get: mocks.get,
  };
  mocks.collection.mockReturnValue(query);
  mocks.where.mockReturnValue(query);
  mocks.orderBy.mockReturnValue(query);
  mocks.limit.mockReturnValue(query);
  return { adminDb: { collection: mocks.collection } };
});

import feedRouter from "../feed";

function feedHandler() {
  const route = feedRouter.stack.find(
    (layer: { route?: { path: string } }) => layer.route?.path === "/",
  );
  return route?.route?.stack?.[0]?.handle;
}

function response() {
  return {
    setHeader: vi.fn(),
    send: vi.fn(),
  };
}

describe("RSS feed router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serves bounded, escaped RSS for published non-deleted posts", async () => {
    mocks.get.mockResolvedValue({
      docs: [
        {
          id: "world-championship-qualification",
          data: () => ({
            title: "World Championship Qualification & Recap\u0001",
            content: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "We qualified <again>!" }],
                },
              ],
            },
            author: "ARES Robotics",
            approvedAt: "2026-04-10T12:00:00Z",
            date: "April 10, 2026",
          }),
        },
      ],
    });
    const handler = feedHandler();
    expect(handler).toBeDefined();
    const res = response();

    await handler?.({} as never, res as never, vi.fn());

    expect(mocks.collection).toHaveBeenCalledWith("posts");
    expect(mocks.where).toHaveBeenNthCalledWith(1, "isDeleted", "==", 0);
    expect(mocks.where).toHaveBeenNthCalledWith(2, "status", "==", "published");
    expect(mocks.orderBy).toHaveBeenCalledWith("date", "desc");
    expect(mocks.limit).toHaveBeenCalledWith(50);
    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "application/rss+xml; charset=utf-8",
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      "X-Content-Type-Options",
      "nosniff",
    );

    const xml = res.send.mock.calls[0][0] as string;
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain("xmlns:dc=");
    expect(xml).toContain(
      "<title>World Championship Qualification &amp; Recap </title>",
    );
    expect(xml).toContain(
      "<link>https://aresfirst.org/blog/world-championship-qualification</link>",
    );
    expect(xml).toContain("We qualified &lt;again&gt;!");
    expect(xml).toContain("<dc:creator>ARES Robotics</dc:creator>");
    expect(xml).toContain("<pubDate>Fri, 10 Apr 2026 12:00:00 GMT</pubDate>");
    expect(xml).toContain(
      '<atom:link href="https://aresfirst.org/feed.xml" rel="self"',
    );
    expect(xml).not.toContain("\u0001");
  });

  it("supports Firestore timestamps and omits fabricated dates", async () => {
    mocks.get.mockResolvedValue({
      docs: [
        {
          id: "timestamped",
          data: () => ({
            title: "Timestamped",
            author: "",
            createdAt: { toDate: () => new Date("2026-05-01T10:30:00Z") },
          }),
        },
        {
          id: "no-date",
          data: () => ({
            title: 42,
            date: "not-a-date",
            createdAt: {
              toDate: () => {
                throw new Error("malformed timestamp");
              },
            },
            snippet: "Update",
          }),
        },
      ],
    });
    const res = response();

    await feedHandler()?.({} as never, res as never, vi.fn());

    const xml = res.send.mock.calls[0][0] as string;
    expect(xml).toContain("<pubDate>Fri, 01 May 2026 10:30:00 GMT</pubDate>");
    expect(xml).toContain("<title>Untitled Post</title>");
    expect(xml.match(/<pubDate>/gu)).toHaveLength(1);
    expect(xml).toContain("<dc:creator>ARES 23247 Team</dc:creator>");
  });

  it("returns a valid empty feed", async () => {
    mocks.get.mockResolvedValue({ docs: [] });
    const res = response();

    await feedHandler()?.({} as never, res as never, vi.fn());

    const xml = res.send.mock.calls[0][0] as string;
    expect(xml).toContain("<channel>");
    expect(xml).not.toContain("<item>");
  });
});
